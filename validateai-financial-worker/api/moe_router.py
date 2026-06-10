"""
moe_router.py — Gating Network de 2 etapas para el sistema MoE.

Flujo:
  Etapa 1 — Keyword scan (O(keywords), ~0ms):
    Calcula un score normalizado por experto contando hits de keywords en la query.
    Resuelve el ~80% de las queries sin coste adicional.

  Etapa 2 — Semantic fallback (~5ms, solo cuando etapa 1 es ambigua):
    Calcula coseno entre el embedding de la query y el embedding de Expert.description.
    Reutiliza la función de embedding inyectada desde app.py para evitar import circular.
    El resultado se mezcla 30/70 con el score de keywords.

  Etapa 3 — Context boost (siempre, si se provee startup_context):
    Heurísticas de industria/etapa/geo amplifican el score de los expertos relevantes.
    Peso: +25% sobre el score combinado de etapas 1/2.

Diseño de bajo acoplamiento:
  - embedding_fn se inyecta en runtime → no hay import de rag.py aquí.
  - EXPERTS y ENTITY_GROUPS se importan solo desde api/experts.py y api/entity_router.py.
  - El singleton `gating_network` es seguro para uso concurrente (sin estado mutable).
"""
from __future__ import annotations
import logging
from dataclasses import dataclass, field

from api.experts import Expert, EXPERTS
from api.entity_router import STAGE_MODIFIER, GEO_MODIFIER, ENTITY_GROUPS
from api.radar.models import RadarSignal

log = logging.getLogger(__name__)

# ── Umbrales de decisión ──────────────────────────────────────────────────────
# Si el score máximo de keywords está por debajo de este umbral, la query es
# ambigua y se activa el fallback semántico.
_AMBIGUITY_THRESHOLD = 0.25

# El segundo experto se activa solo si su score es >= este porcentaje del primero.
# Evita activar un segundo experto marginalmente relacionado.
_MULTI_EXPERT_CUTOFF = 0.60


@dataclass
class MoERoutingResult:
    experts_activated: list[str]       # Ej: ["unit_economics", "legal"]
    expert_scores: dict[str, float]    # Score de cada experto antes de corte
    entities: list[str]                # Títulos combinados de todos los expertos activos
    routing_method: str                # "keyword" | "semantic" | "keyword+context" | "fallback"
    routing_reason: str
    active_radar_signals: list[str] = None  # Headlines que activaron radar boost


class GatingNetwork:
    """
    Router de dos etapas que selecciona qué Expert(s) manejan una query dada.
    Thread-safe: no tiene estado mutable después de __init__.
    """

    def __init__(self, experts: dict[str, Expert] | None = None) -> None:
        self.experts = experts or EXPERTS

    def route(
        self,
        query: str,
        industry: str | None = None,
        stage: str | None = None,
        geography: str | None = "chile",
        top_n: int = 2,
        embedding_fn=None,
        radar_signals: list[RadarSignal] | None = None,
    ) -> MoERoutingResult:
        """
        Parámetros:
          query        — Texto de la consulta del usuario.
          industry     — Industria del startup (ej: "fintech", "saas").
          stage        — Etapa del startup (ej: "seed", "series_a").
          geography    — Geografía principal (ej: "chile", "latam").
          top_n        — Máximo de expertos a activar simultáneamente.
          embedding_fn — Callable(str) → list[float]. Inyectado desde app.py.
                         Si es None, el fallback semántico queda desactivado.
        """
        query_lower = query.lower()

        # ── Etapa 1: Keyword scoring ──────────────────────────────────────────
        scores = self._keyword_score(query_lower)
        top_score = max(scores.values(), default=0.0)
        method = "keyword"

        # ── Etapa 2: Semantic fallback ────────────────────────────────────────
        if top_score < _AMBIGUITY_THRESHOLD and embedding_fn is not None:
            try:
                sem_scores = self._semantic_score(query, embedding_fn)
                # Mezcla: 30% keyword + 70% semántico
                for eid in self.experts:
                    scores[eid] = (
                        0.3 * scores.get(eid, 0.0)
                        + 0.7 * sem_scores.get(eid, 0.0)
                    )
                method = "semantic"
            except Exception as exc:
                log.warning(
                    "GatingNetwork: fallback semántico falló (%s). Usando solo keywords.", exc
                )

        # ── Etapa 3: Context boost (estático — heurísticas de industria/etapa/geo) ──
        if industry or stage or geography:
            boost = self._context_boost(industry, stage, geography)
            for eid in self.experts:
                scores[eid] = scores.get(eid, 0.0) + 0.25 * boost.get(eid, 0.0)
            if industry or stage:
                method = method + "+context"

        # ── Etapa 4: Radar boost (dinámico — señales activas del mercado) ─────
        active_signals: list[str] = []
        if radar_signals:
            radar_boost = self._radar_boost(industry, radar_signals)
            has_boost = any(v > 0 for v in radar_boost.values())
            if has_boost:
                for eid in self.experts:
                    scores[eid] = scores.get(eid, 0.0) + 0.35 * radar_boost.get(eid, 0.0)
                method = method + "+radar"
                active_signals = [
                    s.headline_preview[:80]
                    for s in radar_signals
                    if not industry or industry.lower() in s.affected_industries
                ]
                log.info(
                    "[moe] Radar boost activado: %d señales para industry=%s",
                    len(active_signals), industry,
                )

        # ── Selección de expertos activos ─────────────────────────────────────
        sorted_experts = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top = sorted_experts[0][1] if sorted_experts else 0.0

        active: list[str] = []
        for eid, score in sorted_experts[:top_n]:
            if score <= 0:
                continue
            if not active:
                active.append(eid)
            elif score >= top * _MULTI_EXPERT_CUTOFF:
                active.append(eid)

        if not active:
            active = ["macro"]
            method = "fallback"

        # ── Expandir entidades de los expertos activos ────────────────────────
        entities = self._merge_entities(active, stage, geography)

        reason = (
            f"method={method}; "
            f"experts={active}; "
            f"scores={{{', '.join(f'{e}: {s:.3f}' for e, s in sorted_experts[:3])}}}"
        )

        return MoERoutingResult(
            experts_activated=active,
            expert_scores=dict(sorted_experts),
            entities=entities,
            routing_method=method,
            routing_reason=reason,
            active_radar_signals=active_signals or None,
        )

    # ── Etapa 1: Keyword scoring ───────────────────────────────────────────────

    def _keyword_score(self, query_lower: str) -> dict[str, float]:
        """
        Score normalizado por experto: hits / total_keywords.
        Normalizar evita que expertos con más keywords dominen por volumen.
        """
        return {
            eid: sum(1 for kw in expert.keywords if kw in query_lower)
                 / max(len(expert.keywords), 1)
            for eid, expert in self.experts.items()
        }

    # ── Etapa 2: Semantic scoring ─────────────────────────────────────────────

    def _semantic_score(
        self, query: str, embedding_fn
    ) -> dict[str, float]:
        """
        Similitud coseno entre el embedding de la query y el de Expert.description.

        Los embeddings de description son estáticos (el texto no cambia), por lo que
        en producción deberían pre-calcularse y cachearse en __init__. Para el MVP
        se calculan en cada llamada (pocos expertos, bajo costo).

        Raises:
          Cualquier excepción de embedding_fn se propaga al caller, que la captura
          con log.warning y continúa con keyword scoring.
        """
        import numpy as np

        q_vec = embedding_fn(query)
        q_arr = np.array(q_vec, dtype=np.float32)
        q_norm = q_arr / (np.linalg.norm(q_arr) + 1e-10)

        scores: dict[str, float] = {}
        for eid, expert in self.experts.items():
            d_vec = embedding_fn(expert.description)
            d_arr = np.array(d_vec, dtype=np.float32)
            d_norm = d_arr / (np.linalg.norm(d_arr) + 1e-10)
            scores[eid] = float(np.dot(q_norm, d_norm))

        return scores

    # ── Etapa 3: Context boost ────────────────────────────────────────────────

    def _context_boost(
        self,
        industry: str | None,
        stage: str | None,
        geography: str | None,
    ) -> dict[str, float]:
        """
        Amplifica el score de expertos relevantes para la industria/etapa/geo.
        Los pesos son heurísticos calibrados para los casos de uso más comunes.
        """
        boost: dict[str, float] = {eid: 0.0 for eid in self.experts}

        _INDUSTRY_MAP: dict[str, list[str]] = {
            "fintech":      ["legal", "unit_economics", "mercados"],
            "credito":      ["legal", "unit_economics", "macro"],
            "insurtech":    ["legal", "unit_economics"],
            "saas":         ["unit_economics", "estrategia"],
            "b2b_saas":     ["unit_economics", "legal"],
            "b2c":          ["unit_economics", "estrategia", "mercados"],
            "ecommerce":    ["mercados", "unit_economics"],
            "retail":       ["mercados", "macro"],
            "marketplace":  ["unit_economics", "estrategia"],
            "agro":         ["mercados", "macro"],
            "agricultura":  ["mercados", "macro"],
            "mineria":      ["mercados", "macro"],
            "cleantech":    ["mercados", "macro"],
            "energia":      ["mercados", "macro"],
            "exportacion":  ["mercados", "macro"],
            "importacion":  ["mercados", "macro"],
            "logistica":    ["mercados", "macro"],
            "healthtech":   ["legal", "estrategia"],
            "salud":        ["legal", "macro"],
            "edtech":       ["legal", "estrategia"],
            "b2g":          ["legal", "unit_economics"],
            "gobierno":     ["legal", "macro"],
            "proptech":     ["mercados", "macro"],
            "inmobiliaria": ["mercados", "macro"],
            "turismo":      ["mercados", "macro"],
            "foodtech":     ["mercados", "macro"],
            "biotech":      ["estrategia", "mercados"],
            "hardware":     ["mercados", "macro"],
        }

        if industry:
            key = industry.lower().strip().replace(" ", "_").replace("-", "_")
            for eid in _INDUSTRY_MAP.get(key, ["macro"]):
                boost[eid] = min(boost[eid] + 0.5, 1.0)

        _STAGE_MAP: dict[str, list[str]] = {
            "pre_seed": ["estrategia", "unit_economics"],
            "seed":     ["unit_economics", "legal", "estrategia"],
            "series_a": ["unit_economics", "mercados"],
            "growth":   ["mercados", "unit_economics"],
            "ipo":      ["mercados", "legal"],
        }

        if stage:
            for eid in _STAGE_MAP.get(stage, []):
                boost[eid] = min(boost[eid] + 0.3, 1.0)

        # Chile siempre activa un leve boost a legal (CMF, INAPI, Ley 21.719)
        if geography and geography.lower() == "chile":
            boost["legal"] = min(boost["legal"] + 0.2, 1.0)

        return boost

    # ── Etapa 4: Radar boost ──────────────────────────────────────────────────

    def _radar_boost(
        self,
        industry: str | None,
        radar_signals: list[RadarSignal],
    ) -> dict[str, float]:
        """
        Amplifica experts conservadores (legal, unit_economics) cuando hay señales
        de mercado activas que afectan a la industria de la startup.

        El peso está calibrado para que una señal de severidad=0.9 (crisis bancaria)
        eleve legal hasta +0.315 (0.35 * 0.9) sobre el score base — suficiente para
        desplazar al experto legal a la primera posición en casi todos los casos.

        La señal actúa sobre TODAS las queries del sector afectado durante su TTL,
        no solo sobre queries que mencionen la señal explícitamente. Esto es el
        comportamiento de "alerta temprana" diseñado por la Mesa Directiva.
        """
        boost: dict[str, float] = {eid: 0.0 for eid in self.experts}

        for signal in radar_signals:
            # Verificar si la señal afecta a la industria actual
            if industry and industry.lower() not in signal.affected_industries:
                # Señales globales (macro) afectan a todos
                if signal.sector != "global" and signal.sector != "macro":
                    continue

            sev = signal.severity

            # Señales regulatorias → priorizar legal fuertemente
            if signal.signal_type in ("REGULATORY_ACTION", "REGULATORY_REVIEW"):
                boost["legal"] = min(boost["legal"] + sev * 0.6, 1.0)
                boost["unit_economics"] = min(boost["unit_economics"] + sev * 0.2, 1.0)

            # Riesgo de sector o caída de mercado → due diligence financiero conservador
            elif signal.signal_type in ("SECTOR_RISK", "MARKET_DROP"):
                boost["unit_economics"] = min(boost["unit_economics"] + sev * 0.5, 1.0)
                boost["legal"] = min(boost["legal"] + sev * 0.3, 1.0)

            # Alerta macro → contexto macroeconómico explícito
            elif signal.signal_type == "MACRO_ALERT":
                boost["macro"] = min(boost["macro"] + sev * 0.5, 1.0)
                boost["unit_economics"] = min(boost["unit_economics"] + sev * 0.3, 1.0)

        return boost

    # ── Expansión de entidades ────────────────────────────────────────────────

    def _merge_entities(
        self,
        expert_ids: list[str],
        stage: str | None,
        geography: str | None,
    ) -> list[str]:
        """
        Une los entity_titles de todos los expertos activos y añade los
        modificadores de etapa/geo del sistema original (backward compat con
        entity_router.py).

        El orden preservado garantiza que los nodos GRAPH del primer experto
        tengan mayor probabilidad de ranking alto en search_hybrid_graphrag.
        """
        seen: set[str] = set()
        result: list[str] = []

        for eid in expert_ids:
            expert = self.experts.get(eid)
            if expert is None:
                continue
            for title in expert.entity_titles:
                if title not in seen:
                    seen.add(title)
                    result.append(title)

        # Añadir modificadores del sistema original para no perder cobertura
        extra_groups: set[str] = set()
        if stage:
            extra_groups.update(STAGE_MODIFIER.get(stage, []))
        if geography:
            extra_groups.update(GEO_MODIFIER.get(geography.lower().strip(), []))

        for group in extra_groups:
            for title in ENTITY_GROUPS.get(group, []):
                if title not in seen:
                    seen.add(title)
                    result.append(title)

        return result


# ── Singleton ─────────────────────────────────────────────────────────────────
# Thread-safe: GatingNetwork no tiene estado mutable tras __init__.
gating_network = GatingNetwork()
