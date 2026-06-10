"""
src/extractors/bcch_sentiment.py — Scorer hawkish/dovish para documentos BCCH.

Escala de sentimiento: -1.0 (muy dovish) → 0.0 (neutral) → +1.0 (muy hawkish)
Tono categórico: "hawkish" | "neutral" | "dovish"

Pipeline de dos etapas:
  1. Keyword scoring — rápido, costo cero, cubre ~80% del señal.
     Cada regla tiene un peso (0.1–0.4). El score final se normaliza a [-1, 1].
  2. Haiku LLM (opcional) — solo para la sección "Perspectivas/Decisión"
     (~500 palabras), NO para cada chunk. Costo estimado: ~$0.001/documento.
     Se activa cuando el score keyword está entre -0.25 y +0.25 (zona gris).

La decisión de TPM (alza/baja/pausa) se infiere del texto antes del scoring
y tiene peso dominante si se detecta con certeza.
"""
from __future__ import annotations
import logging
import os
import re
from dataclasses import dataclass

log = logging.getLogger(__name__)

# ── Reglas keyword ────────────────────────────────────────────────────────────
# (patrones, peso): peso positivo = hawkish, negativo = dovish

_KEYWORD_RULES: list[tuple[list[str], float]] = [
    # ── Decisión explícita de TPM (peso dominante) ────────────────────────────
    (["subió la tasa", "incrementó la tasa", "alza de la tpm",
      "aumento de la tpm", "alzó la tasa de política", "subir la tpm"], +0.4),
    (["recortó la tasa", "bajó la tasa", "recorte de la tpm",
      "reducción de la tpm", "bajar la tpm", "disminuyó la tpm"], -0.4),
    (["mantuvo la tasa", "mantuvo la tpm sin cambios",
      "sin variación en la tpm", "tasa se mantiene"], 0.0),

    # ── Forward guidance hawkish ──────────────────────────────────────────────
    (["alzas adicionales", "nuevas alzas no se descartan",
      "espacio para alzas", "sesgo restrictivo",
      "política monetaria restrictiva se mantendrá",
      "convergencia más lenta de lo previsto",
      "retorno más gradual a la neutralidad"], +0.3),
    (["expectativas de inflación desancladas",
      "riesgos al alza para la inflación",
      "presiones inflacionarias persistentes",
      "inflación supera expectativas",
      "inflación por sobre la meta"], +0.25),
    (["vigilará estrechamente", "atento a nuevos antecedentes",
      "sin espacio para relajar", "postura más restrictiva"], +0.2),
    (["inflación subyacente elevada", "ipe al alza",
      "inflación de servicios persistente"], +0.2),

    # ── Forward guidance dovish ───────────────────────────────────────────────
    (["recortes adicionales", "mayor recorte de lo previsto",
      "espacio para recortes", "sesgo expansivo",
      "normalización más acelerada",
      "corredor de tasas se inclina a la baja"], -0.3),
    (["inflación converge más rápido",
      "presiones inflacionarias moderadas",
      "inflación cede", "inflación desciende hacia la meta",
      "dinámica inflacionaria mejora"], -0.25),
    (["actividad se desacelera más de lo previsto",
      "brecha de actividad negativa", "crecimiento por debajo del potencial",
      "mercado laboral se debilita", "consumo privado cae"], -0.25),
    (["riesgos a la baja para la actividad",
      "escenario de mayor holgura", "capacidad ociosa aumenta"], -0.2),

    # ── Tono general ──────────────────────────────────────────────────────────
    (["cautela", "incertidumbre elevada", "volatilidad externa"],  0.0),
    (["balance de riesgos sesgado al alza para inflación"], +0.2),
    (["balance de riesgos sesgado a la baja para actividad"], -0.15),
]

# ── TPM decision detector ─────────────────────────────────────────────────────

_RE_ALZA = re.compile(
    r"(subió|incrementó|alzó|aumentó).{0,40}(tasa|tpm)|"
    r"(alza|aumento).{0,20}(de la tpm|de la tasa de política)",
    re.IGNORECASE,
)
_RE_BAJA = re.compile(
    r"(recortó|bajó|redujo|disminuyó).{0,40}(tasa|tpm)|"
    r"(recorte|reducción|baja).{0,20}(de la tpm|de la tasa de política)",
    re.IGNORECASE,
)
_RE_PAUSA = re.compile(
    r"(mantuvo|mantiene|sin cambios).{0,40}(tasa|tpm)|"
    r"tpm.{0,20}(sin variación|sin cambios)",
    re.IGNORECASE,
)


@dataclass
class SentimentResult:
    score: float                  # -1.0 a +1.0
    tono: str                     # "hawkish" | "neutral" | "dovish"
    tpm_decision: str             # "alza" | "baja" | "pausa" | "desconocida"
    classified_by: str            # "keyword" | "haiku" | "keyword+haiku"
    top_signals: list[str]        # hasta 3 frases que más influyeron


def score_document(text: str, seccion_clave: str = "") -> SentimentResult:
    """
    Puntúa el documento completo y opcionalmente usa Haiku para la sección clave.

    text: texto completo extraído del PDF
    seccion_clave: sección de perspectivas/decisión (si se extrajo por separado)
    """
    full_text = text.lower()

    # 1. Detectar decisión TPM
    tpm_decision = _detect_tpm_decision(full_text)

    # 2. Keyword scoring
    raw_score, signals = _keyword_score(full_text)

    # 3. Haiku si score está en zona gris y hay key configurada
    classified_by = "keyword"
    if abs(raw_score) < 0.25 and os.getenv("ANTHROPIC_API_KEY"):
        target = seccion_clave or text[-3000:]  # últimas 3000 chars si no hay sección
        try:
            haiku_score = _haiku_score(target)
            raw_score = (raw_score + haiku_score) / 2
            classified_by = "keyword+haiku"
        except Exception as exc:
            log.warning("[bcch_sentiment] Haiku falló (%s). Usando solo keyword.", exc)

    # 4. Override de score si la decisión TPM es explícita
    if tpm_decision == "alza" and raw_score < 0.2:
        raw_score = max(raw_score, 0.35)
    elif tpm_decision == "baja" and raw_score > -0.2:
        raw_score = min(raw_score, -0.35)

    # 5. Normalizar a [-1, 1]
    score = max(-1.0, min(1.0, raw_score))

    tono = "hawkish" if score > 0.20 else ("dovish" if score < -0.20 else "neutral")

    return SentimentResult(
        score=round(score, 3),
        tono=tono,
        tpm_decision=tpm_decision,
        classified_by=classified_by,
        top_signals=signals[:3],
    )


def _detect_tpm_decision(text: str) -> str:
    if _RE_ALZA.search(text):
        return "alza"
    if _RE_BAJA.search(text):
        return "baja"
    if _RE_PAUSA.search(text):
        return "pausa"
    return "desconocida"


def _keyword_score(text: str) -> tuple[float, list[str]]:
    total = 0.0
    hit_signals: list[str] = []

    for patterns, weight in _KEYWORD_RULES:
        if weight == 0.0:
            continue
        for pat in patterns:
            if pat in text:
                total += weight
                hit_signals.append(f"[{'+' if weight > 0 else ''}{weight:.1f}] «{pat}»")
                break  # una regla cuenta una vez

    return total, sorted(hit_signals, key=lambda s: abs(float(s.split("]")[0][1:])), reverse=True)


_HAIKU_SYSTEM = """Eres un analista del Banco Central de Chile.
Dado un fragmento de una Minuta o Comunicado del BCCh, determina el tono de política monetaria.

Responde SOLO con JSON válido:
{"score": 0.0, "razon": "una frase breve"}

score: -1.0 (muy dovish: recortes inminentes, inflación cedió)
       -0.5 (dovish moderado: espacio para bajar, actividad débil)
        0.0 (neutral: pausa, sin señal clara)
       +0.5 (hawkish moderado: vigilancia, sin descartar alzas)
       +1.0 (muy hawkish: alza inminente, inflación fuera de meta)"""


def _haiku_score(text: str) -> float:
    import anthropic, json

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=80,
        system=_HAIKU_SYSTEM,
        messages=[{"role": "user", "content": text[:1500]}],
    )
    data = json.loads(msg.content[0].text.strip())
    return float(data.get("score", 0.0))
