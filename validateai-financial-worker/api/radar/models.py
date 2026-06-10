"""
api/radar/models.py — Modelos de datos del Radar Forense.

RadarSignal es la unidad fundamental: representa una señal negativa detectada
en noticias financieras que afecta a uno o más sectores del mercado chileno.

El campo `severity` (0.0–1.0) calibra cuánto amplifica el Context Boost:
  0.0–0.4  → señal débil, solo logging
  0.4–0.7  → boost moderado en experts legal/unit_economics
  0.7–1.0  → boost fuerte → due diligence más conservador
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

SignalType = Literal[
    "REGULATORY_ACTION",   # CMF multa, sanción, resolución vinculante
    "REGULATORY_REVIEW",   # Investigación, proyecto de ley, audiencia pública
    "SECTOR_RISK",         # Quiebra sector, crisis de confianza, escándalo
    "MARKET_DROP",         # Caída índice, colapso commodity, crash
    "MACRO_ALERT",         # Inflación sorprende, Fed hawkish, BCCh sube tasa
]

# Umbral mínimo: señales bajo esto se loguean pero no afectan el routing
SEVERITY_THRESHOLD = 0.40


@dataclass
class RadarSignal:
    sector: str                          # "fintech" | "mineria" | "macro" | "global"
    affected_industries: list[str]       # ["fintech", "credito", "insurtech"]
    signal_type: SignalType
    severity: float                      # 0.0–1.0
    headline_preview: str                # Primeros 200 chars del titular
    source: str                          # "df.cl" | "emol.com" | "marketaux"
    detected_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    expires_at: datetime | None = None   # None → usar TTL por defecto (24h)
    classified_by: str = "keyword"       # "keyword" | "haiku"
    signal_id: str = ""                  # UUID asignado por Supabase tras insert

    def is_active(self) -> bool:
        if self.expires_at is None:
            return True
        return datetime.now(timezone.utc) < self.expires_at

    def to_supabase_row(self) -> dict:
        return {
            "sector": self.sector,
            "affected_industries": self.affected_industries,
            "signal_type": self.signal_type,
            "severity": round(self.severity, 4),
            "headline_preview": self.headline_preview[:300],
            "source": self.source,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "classified_by": self.classified_by,
        }
