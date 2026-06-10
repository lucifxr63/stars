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
    # Riesgo regulatorio crítico (alta severidad)
    (
        ["multa", "sancionado", "sancionada", "clausura", "cierre forzado"],
        ["fintech", "credito", "insurtech", "saas"],
        "REGULATORY_ACTION", 0.88,
    ),
    (
        ["cmf", "comisión para el mercado financiero"],
        ["fintech", "credito", "insurtech"],
        "REGULATORY_REVIEW", 0.62,
    ),
    (
        ["quiebra", "insolvencia", "liquidación forzosa", "concurso de acreedores"],
        ["fintech", "credito", "saas", "marketplace"],
        "SECTOR_RISK", 0.92,
    ),
    (
        ["ciberseguridad", "hackeo", "ataque informático", "brecha de datos", "ransomware"],
        ["fintech", "b2b_saas", "healthtech", "b2g"],
        "SECTOR_RISK", 0.80,
    ),
    # Regulatorio moderado
    (
        ["nueva ley", "proyecto de ley", "regulación aprobada", "norma cmf"],
        ["fintech", "credito", "saas"],
        "REGULATORY_REVIEW", 0.52,
    ),
    (
        ["superintendencia", "svs", "cmfchile"],
        ["fintech", "credito"],
        "REGULATORY_REVIEW", 0.48,
    ),
    (
        ["ley 21", "ley fintech", "ley de datos", "ley de ciberseguridad"],
        ["fintech", "credito", "b2b_saas", "saas"],
        "REGULATORY_REVIEW", 0.60,
    ),
    # Mercados y commodities
    (
        ["ipsa cae", "ipsa baja", "bolsa chilena cae", "mercado bursátil cae"],
        ["saas", "marketplace", "ecommerce", "b2b_saas"],
        "MARKET_DROP", 0.70,
    ),
    (
        ["cobre cae", "precio del cobre baja", "cobre desploma"],
        ["mineria", "agro", "exportacion", "cleantech"],
        "MARKET_DROP", 0.75,
    ),
    (
        ["litio baja", "precio del litio cae", "litio desploma"],
        ["mineria", "cleantech"],
        "MARKET_DROP", 0.72,
    ),
    (
        ["dólar sube", "dolar sube", "clp se deprecia", "peso chileno cae"],
        ["importacion", "retail", "ecommerce", "hardware"],
        "MARKET_DROP", 0.65,
    ),
    (
        ["petróleo sube", "petroleo sube", "wti alza", "energia cara"],
        ["logistica", "agro", "cleantech", "energia"],
        "MACRO_ALERT", 0.60,
    ),
    # Macro Chile y global
    (
        ["inflación sube", "ipc supera", "inflación alta", "cpi sorprende"],
        ["fintech", "credito", "retail", "ecommerce"],
        "MACRO_ALERT", 0.68,
    ),
    (
        ["bcch sube tasa", "banco central sube", "tasa de política monetaria sube", "tpm sube"],
        ["fintech", "credito", "proptech", "inmobiliaria"],
        "MACRO_ALERT", 0.72,
    ),
    (
        ["fed sube tasa", "reserva federal sube", "hawkish", "fed funds sube"],
        ["fintech", "credito", "saas"],
        "MACRO_ALERT", 0.65,
    ),
    (
        ["recesión", "contracción del pib", "pib negativo", "caída del pib"],
        ["fintech", "saas", "marketplace", "credito", "retail"],
        "MACRO_ALERT", 0.82,
    ),
    (
        ["crisis bancaria", "banco quiebra", "corrida bancaria", "bank run"],
        ["fintech", "credito", "saas"],
        "SECTOR_RISK", 0.95,
    ),
    # Riesgo específico fintech LatAm
    (
        ["fraude fintech", "estafa fintech", "startup fraudulenta"],
        ["fintech", "credito", "marketplace"],
        "SECTOR_RISK", 0.85,
    ),
]


def classify_headline(
    headline: str,
    source: str,
    ttl_hours: int = 24,
) -> RadarSignal | None:
    """
    Punto de entrada principal. Intenta keyword primero; si falla, llama Haiku.
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
