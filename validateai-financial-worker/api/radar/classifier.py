"""
api/radar/classifier.py — Clasificador de señales del Radar Forense.

Etapa 1 — Keyword-first (~0ms):
  Evalúa el titular contra reglas estáticas de keywords → sector/tipo/severidad.
  Cubre el ~80% de titulares evidentes (multas CMF, caídas IPSA, etc.).

Etapa 2 — Claude Haiku fallback (~400ms, $0.0003/llamada):
  Activado solo cuando keyword_classify retorna None (titular ambiguo).
  Llama a Claude Haiku con un prompt de clasificación estructurada.
  Requiere ANTHROPIC_API_KEY en .env. Si no está configurado, retorna None
  y el titular se descarta (comportamiento seguro para producción).

Uso:
  signal = classify_headline("CMF multa a fintech por operar sin registro", source="df.cl")
  if signal and signal.severity >= SEVERITY_THRESHOLD:
      persist(signal)
"""
from __future__ import annotations
import json
import logging
import os
from datetime import datetime, timedelta, timezone

from api.radar.models import RadarSignal, SignalType, SEVERITY_THRESHOLD

log = logging.getLogger(__name__)

# ── Tabla de reglas keyword ───────────────────────────────────────────────────
# Formato: (keywords_es, affected_industries, signal_type, severity)
# Se evalúan en orden; la primera regla que hace match gana.
# keywords son substrings case-insensitive sobre el titular normalizado.

_KEYWORD_RULES: list[tuple[list[str], list[str], SignalType, float]] = [
    # ── Regulatorio crítico ───────────────────────────────────────────────────
    (
        ["multa", "sancionado", "sancionada", "clausura", "cierre forzado",
         "amonestación cmf", "cargo cmf", "resolución exenta"],
        ["fintech", "credito", "insurtech", "saas"],
        "REGULATORY_ACTION", 0.88,
    ),
    (
        ["inhabilitación", "cancelación de registro", "revocación de licencia",
         "suspensión de operaciones", "intervención regulatoria"],
        ["fintech", "credito", "insurtech"],
        "REGULATORY_ACTION", 0.91,
    ),
    (
        ["cmf", "comisión para el mercado financiero", "cmfchile",
         "svs chile", "superintendencia de valores"],
        ["fintech", "credito", "insurtech"],
        "REGULATORY_REVIEW", 0.62,
    ),
    (
        ["superintendencia de bancos", "sbif", "cmf bancaria"],
        ["fintech", "credito"],
        "REGULATORY_REVIEW", 0.65,
    ),
    # ── Quiebra / Insolvencia ─────────────────────────────────────────────────
    (
        ["quiebra", "insolvencia", "liquidación forzosa", "concurso de acreedores",
         "reestructuración de deuda", "acuerdo de reorganización",
         "superir", "superintendencia de insolvencia"],
        ["fintech", "credito", "saas", "marketplace", "retail"],
        "SECTOR_RISK", 0.92,
    ),
    (
        ["crisis bancaria", "banco quiebra", "corrida bancaria", "bank run",
         "banco intervenido", "banco en liquidación"],
        ["fintech", "credito", "saas"],
        "SECTOR_RISK", 0.95,
    ),
    # ── Ciberseguridad / Datos ────────────────────────────────────────────────
    (
        ["ciberseguridad", "hackeo", "ataque informático", "ataque informatico",
         "brecha de datos", "ransomware", "phishing masivo", "robo de datos",
         "filtración de datos", "data breach"],
        ["fintech", "b2b_saas", "healthtech", "b2g"],
        "SECTOR_RISK", 0.80,
    ),
    # ── M&A / Corporativo ─────────────────────────────────────────────────────
    (
        ["fusión", "fusion", "adquisición", "adquisicion", "opa ", "oferta pública de adquisición",
         "compra de empresa", "absorción empresarial"],
        ["saas", "fintech", "marketplace", "b2b_saas"],
        "SECTOR_RISK", 0.52,
    ),
    (
        ["despidos masivos", "layoffs", "reducción de plantilla", "cierre de operaciones",
         "plan de contingencia laboral", "huelga legal", "paralización de faenas"],
        ["fintech", "mineria", "retail", "logistica", "energia"],
        "SECTOR_RISK", 0.72,
    ),
    # ── Regulatorio moderado / nuevas leyes ───────────────────────────────────
    (
        ["nueva ley", "proyecto de ley aprobado", "regulación aprobada",
         "norma cmf", "circular cmf", "resolución cmf"],
        ["fintech", "credito", "saas"],
        "REGULATORY_REVIEW", 0.52,
    ),
    (
        ["ley 21", "ley fintech", "ley de datos", "ley de ciberseguridad",
         "ley marco ciberseguridad", "ley 21.663", "ley 21.521", "ley 21.719"],
        ["fintech", "credito", "b2b_saas", "saas"],
        "REGULATORY_REVIEW", 0.60,
    ),
    (
        ["reforma tributaria", "impuesto digital", "iva digital",
         "tasa impositiva sube", "sobretasa"],
        ["saas", "ecommerce", "marketplace", "fintech"],
        "REGULATORY_REVIEW", 0.58,
    ),
    # ── Mercados bursátiles ───────────────────────────────────────────────────
    (
        ["ipsa cae", "ipsa baja", "ipsa desploma", "bolsa chilena cae",
         "mercado bursátil cae", "baja generalizada bolsa", "pérdidas bolsa santiago"],
        ["saas", "marketplace", "ecommerce", "b2b_saas", "fintech"],
        "MARKET_DROP", 0.70,
    ),
    (
        ["wall street cae", "s&p 500 cae", "nasdaq baja", "dow jones cae",
         "mercados globales caen", "venta masiva acciones", "sell-off"],
        ["saas", "fintech", "b2b_saas", "credito"],
        "MARKET_DROP", 0.68,
    ),
    # ── Commodities ───────────────────────────────────────────────────────────
    (
        ["cobre cae", "precio del cobre baja", "cobre desploma",
         "lme cobre baja", "cobre mínimo"],
        ["mineria", "agro", "exportacion", "cleantech"],
        "MARKET_DROP", 0.75,
    ),
    (
        ["litio baja", "precio del litio cae", "litio desploma",
         "carbonato de litio baja", "litio mínimo histórico"],
        ["mineria", "cleantech"],
        "MARKET_DROP", 0.72,
    ),
    (
        ["petróleo sube", "petroleo sube", "wti alza", "brent sube",
         "energia cara", "combustibles suben", "precio bencina"],
        ["logistica", "agro", "cleantech", "energia"],
        "MACRO_ALERT", 0.60,
    ),
    (
        ["petróleo cae", "petroleo cae", "wti baja", "commodities bajan"],
        ["mineria", "energia", "exportacion"],
        "MARKET_DROP", 0.55,
    ),
    # ── Tipo de cambio / Forex ────────────────────────────────────────────────
    (
        ["dólar sube", "dolar sube", "clp se deprecia", "peso chileno cae",
         "dolar historico", "dolar máximo", "dolar record", "depreciación peso"],
        ["importacion", "retail", "ecommerce", "hardware"],
        "MARKET_DROP", 0.65,
    ),
    (
        ["dólar baja", "dolar baja", "peso chileno se aprecia",
         "clp se fortalece"],
        ["exportacion", "mineria"],
        "MARKET_DROP", 0.50,
    ),
    # ── Macro Chile específico ────────────────────────────────────────────────
    (
        ["imacec cae", "imacec negativo", "imacec bajo expectativas",
         "actividad económica cae", "contracción economía chilena"],
        ["fintech", "saas", "retail", "credito", "ecommerce"],
        "MACRO_ALERT", 0.75,
    ),
    (
        ["inflación sube", "ipc supera", "inflación alta", "cpi sorprende",
         "ipc chile", "inflación anual sube", "inflación mensual"],
        ["fintech", "credito", "retail", "ecommerce"],
        "MACRO_ALERT", 0.68,
    ),
    (
        ["bcch sube tasa", "banco central sube", "tasa de política monetaria sube",
         "tpm sube", "tpm al alza", "banco central alza tpm",
         "política monetaria restrictiva"],
        ["fintech", "credito", "proptech", "inmobiliaria"],
        "MACRO_ALERT", 0.72,
    ),
    (
        ["bcch baja tasa", "banco central baja tasa", "tpm baja",
         "recorte de tasa bcch", "política monetaria expansiva"],
        ["fintech", "credito", "proptech"],
        "MACRO_ALERT", 0.45,
    ),
    (
        ["desempleo sube", "tasa de desempleo aumenta", "cesantía aumenta",
         "desocupación sube", "mercado laboral se deteriora"],
        ["retail", "ecommerce", "b2c", "credito"],
        "MACRO_ALERT", 0.65,
    ),
    # ── Macro global ─────────────────────────────────────────────────────────
    (
        ["fed sube tasa", "reserva federal sube", "hawkish fed",
         "fed funds sube", "fomc sube", "jerome powell hawkish"],
        ["fintech", "credito", "saas"],
        "MACRO_ALERT", 0.65,
    ),
    (
        ["recesión", "contracción del pib", "pib negativo", "caída del pib",
         "recession usa", "recession global", "pib usa cae"],
        ["fintech", "saas", "marketplace", "credito", "retail"],
        "MACRO_ALERT", 0.82,
    ),
    (
        ["guerra comercial", "aranceles suben", "sanciones económicas",
         "bloqueo comercial", "restricciones exportación"],
        ["exportacion", "mineria", "agro", "hardware"],
        "MACRO_ALERT", 0.70,
    ),
    (
        ["crisis china", "pib china cae", "yuan se deprecia",
         "demanda china baja", "crisis inmobiliaria china"],
        ["mineria", "exportacion", "cleantech"],
        "MACRO_ALERT", 0.75,
    ),
    # ── Fraude / Reputación ───────────────────────────────────────────────────
    (
        ["fraude fintech", "estafa fintech", "startup fraudulenta",
         "esquema ponzi", "fraude financiero", "apropiación indebida",
         "lavado de activos fintech"],
        ["fintech", "credito", "marketplace"],
        "SECTOR_RISK", 0.85,
    ),
    (
        ["escándalo corporativo", "directorio investigado", "fraude contable",
         "estados financieros manipulados", "auditoría forense"],
        ["fintech", "saas", "b2b_saas", "marketplace"],
        "SECTOR_RISK", 0.80,
    ),

    # ── Português — Valor Econômico (Brasil) ─────────────────────────────────
    # Cobertura de señales críticas en PT para evitar escalar a Haiku.
    # Valor Econômico cubre macro Brasil + commodities regionales con impacto LatAm.
    (
        ["falência", "insolvência", "recuperação judicial", "concordata"],
        ["fintech", "credito", "saas", "marketplace"],
        "SECTOR_RISK", 0.90,
    ),
    (
        ["crise bancária", "banco quebrou", "corrida bancária", "intervenção banco"],
        ["fintech", "credito"],
        "SECTOR_RISK", 0.95,
    ),
    (
        ["multa", "sanção", "autuação", "bloqueio regulatório"],
        ["fintech", "credito", "saas"],
        "REGULATORY_ACTION", 0.85,
    ),
    (
        ["recessão", "contração do pib", "pib negativo", "queda do pib"],
        ["fintech", "saas", "marketplace", "exportacion"],
        "MACRO_ALERT", 0.80,
    ),
    (
        ["inflação sobe", "ipca acima", "inflação alta", "banco central sobe juros",
         "selic sobe", "política monetária restritiva"],
        ["fintech", "credito", "retail"],
        "MACRO_ALERT", 0.68,
    ),
    (
        ["dólar sobe", "real se desvaloriza", "câmbio dispara",
         "real cai", "maxidesvalorização"],
        ["importacion", "hardware", "ecommerce"],
        "MARKET_DROP", 0.65,
    ),
    (
        ["bolsa cai", "ibovespa cai", "mercado financeiro cai", "sell-off brasil"],
        ["saas", "fintech", "marketplace"],
        "MARKET_DROP", 0.68,
    ),
    (
        ["minério de ferro cai", "cobre cai", "commodities caem", "preço do cobre"],
        ["mineria", "exportacion", "cleantech"],
        "MARKET_DROP", 0.72,
    ),
    (
        ["fraude", "esquema ponzi", "golpe financeiro", "lavagem de dinheiro"],
        ["fintech", "credito", "marketplace"],
        "SECTOR_RISK", 0.85,
    ),
    (
        ["demissões em massa", "layoffs", "corte de empregos", "plano de demissão"],
        ["fintech", "saas", "retail"],
        "SECTOR_RISK", 0.70,
    ),
]


def classify_headline(
    headline: str,
    source: str,
    ttl_hours: int = 24,
    lang: str = "es",
) -> RadarSignal | None:
    """
    Punto de entrada principal. Intenta keyword primero; si falla, llama Haiku.
    lang: "es" | "pt" | "en" — solo informativo para logging.
    Retorna None si el titular no es relevante o si la clasificación falla.
    """
    result = _keyword_classify(headline, source, ttl_hours)
    if result is not None:
        return result

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key:
        try:
            result = _haiku_classify(headline, source, anthropic_key, ttl_hours)
        except Exception as exc:
            log.warning("[radar.classifier] Haiku falló (%s). Titular descartado.", exc)
    else:
        log.debug("[radar.classifier] ANTHROPIC_API_KEY no configurado. Solo keyword mode.")

    return result


# ── Etapa 1: Keyword classification ──────────────────────────────────────────

def _keyword_classify(
    headline: str,
    source: str,
    ttl_hours: int,
) -> RadarSignal | None:
    normalized = headline.lower().strip()
    for keywords, industries, signal_type, severity in _KEYWORD_RULES:
        if any(kw in normalized for kw in keywords):
            log.debug(
                "[radar.classifier] keyword match: '%s' → %s (%.2f)",
                headline[:60], signal_type, severity,
            )
            return RadarSignal(
                sector=_primary_sector(industries),
                affected_industries=industries,
                signal_type=signal_type,
                severity=severity,
                headline_preview=headline[:200],
                source=source,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
                classified_by="keyword",
            )
    return None


# ── Etapa 2: Claude Haiku fallback ────────────────────────────────────────────

_HAIKU_SYSTEM = """Eres un clasificador de noticias financieras para el mercado chileno y LatAm.
Dado un titular, determina si representa una señal NEGATIVA para startups tecnológicas.

Responde SOLO con JSON válido. Sin texto adicional. Sin comillas de código.

Schema exacto:
{
  "is_negative": true | false,
  "sector": "fintech" | "mineria" | "saas" | "agro" | "macro" | "global" | "otro",
  "affected_industries": ["fintech", "credito"],
  "signal_type": "REGULATORY_ACTION" | "REGULATORY_REVIEW" | "SECTOR_RISK" | "MARKET_DROP" | "MACRO_ALERT",
  "severity": 0.0
}

Reglas de severidad:
  0.9-1.0: quiebra masiva, crisis bancaria, ley que prohíbe actividad
  0.7-0.9: multa regulatoria, caída >5% mercado, nueva ley restrictiva
  0.5-0.7: regulación en revisión, caída leve, alerta macro moderada
  0.0-0.5: noticia de bajo impacto o positiva → is_negative: false"""

_HAIKU_MODEL = "claude-haiku-4-5-20251001"


def _haiku_classify(
    headline: str,
    source: str,
    api_key: str,
    ttl_hours: int,
) -> RadarSignal | None:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=_HAIKU_MODEL,
        max_tokens=150,
        system=_HAIKU_SYSTEM,
        messages=[{"role": "user", "content": f"Titular: {headline[:400]}"}],
    )

    raw = message.content[0].text.strip()
    data = json.loads(raw)

    if not data.get("is_negative", False):
        return None

    severity = float(data.get("severity", 0.0))
    if severity < SEVERITY_THRESHOLD:
        return None

    industries: list[str] = data.get("affected_industries", [])
    signal_type: SignalType = data.get("signal_type", "SECTOR_RISK")

    log.info(
        "[radar.classifier] Haiku: '%s' → %s sev=%.2f industries=%s",
        headline[:60], signal_type, severity, industries,
    )

    return RadarSignal(
        sector=data.get("sector", _primary_sector(industries)),
        affected_industries=industries,
        signal_type=signal_type,
        severity=severity,
        headline_preview=headline[:200],
        source=source,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
        classified_by="haiku",
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _primary_sector(industries: list[str]) -> str:
    """Infiere el sector principal desde la lista de industrias afectadas."""
    fintech_group = {"fintech", "credito", "insurtech"}
    mining_group = {"mineria", "agro", "exportacion", "cleantech"}
    saas_group = {"saas", "b2b_saas", "marketplace", "ecommerce"}

    industry_set = set(industries)
    if industry_set & fintech_group:
        return "fintech"
    if industry_set & mining_group:
        return "mineria"
    if industry_set & saas_group:
        return "saas"
    return "global"
