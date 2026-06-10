"""
api/radar/signal_cache.py — Cache en memoria de señales activas del Radar Forense.

Por qué cache en memoria y no Supabase directo:
  El GatingNetwork corre en cada POST /query/moe (~100ms P95).
  Consultar Supabase en cada request añadiría 20-50ms de I/O de red.
  Con TTL de 5 minutos, el cache se vuelve a cargar solo 12 veces/hora
  en lugar de ~600 veces/hora — una reducción de 98% en llamadas a Supabase.

Arquitectura multi-instancia (Railway horizontal scaling):
  Cada instancia tiene su propio cache en memoria. Los writes (insert de señales
  del scheduler) van a Supabase y se propagan al cache de cada instancia
  en el siguiente ciclo de refresh (máximo 5 min de desfase entre instancias).
  Aceptable para señales de mercado que viven 24h.

Thread-safety:
  La lectura es thread-safe (Python GIL + assignment atómica de lista).
  El refresh usa un lock para evitar doble-refresh concurrente.
"""
from __future__ import annotations
import logging
import time
from datetime import datetime, timezone
from threading import Lock

from api.radar.models import RadarSignal, SEVERITY_THRESHOLD

log = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 300  # 5 minutos — balance entre frescura y costo de I/O


class SignalCache:
    """
    Cache en memoria de RadarSignals activos. Thread-safe para lectura concurrente.
    El refresh es lazy: ocurre en la primera llamada después de que el TTL expira.
    """

    def __init__(self, ttl_seconds: int = _CACHE_TTL_SECONDS) -> None:
        self._ttl = ttl_seconds
        self._signals: list[RadarSignal] = []
        self._last_refresh: float = 0.0
        self._lock = Lock()

    def get_active(self, supabase_client=None) -> list[RadarSignal]:
        """
        Retorna la lista de señales activas. Si el cache expiró y se provee
        un cliente Supabase, hace refresh. Sin cliente, retorna el cache stale.
        """
        now = time.monotonic()
        if now - self._last_refresh > self._ttl and supabase_client is not None:
            with self._lock:
                # Double-check dentro del lock (otro hilo puede haber refrescado)
                if time.monotonic() - self._last_refresh > self._ttl:
                    self._refresh(supabase_client)
        return self._signals

    def inject(self, signals: list[RadarSignal]) -> None:
        """
        Inyecta señales directamente (usado por el scheduler tras escribir en Supabase).
        Evita tener que esperar el próximo ciclo de refresh del cache.
        """
        with self._lock:
            self._signals = [s for s in signals if s.is_active() and s.severity >= SEVERITY_THRESHOLD]
            self._last_refresh = time.monotonic()
            log.info("[radar.cache] %d señales activas en cache.", len(self._signals))

    def clear(self) -> None:
        with self._lock:
            self._signals = []
            self._last_refresh = 0.0

    def _refresh(self, client) -> None:
        """
        Lee radar_signals de Supabase filtrando por expires_at > NOW() y
        severity >= SEVERITY_THRESHOLD. Falla silenciosamente si la tabla
        no existe aún (sprint_moe8_radar.sql pendiente de aplicar).
        """
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            result = (
                client.table("radar_signals")
                .select("*")
                .gt("expires_at", now_iso)
                .gte("severity", SEVERITY_THRESHOLD)
                .order("severity", desc=True)
                .limit(50)
                .execute()
            )
            rows = result.data or []
            self._signals = [_row_to_signal(r) for r in rows]
            self._last_refresh = time.monotonic()
            log.info(
                "[radar.cache] Refresh: %d señales activas cargadas desde Supabase.",
                len(self._signals),
            )
        except Exception as exc:
            log.warning(
                "[radar.cache] Refresh falló (%s). Usando cache stale (%d señales).",
                exc, len(self._signals),
            )
            # No actualizar _last_refresh → reintentará en el próximo request


def _row_to_signal(row: dict) -> RadarSignal:
    expires_raw = row.get("expires_at")
    expires_at = (
        datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
        if expires_raw else None
    )
    return RadarSignal(
        sector=row["sector"],
        affected_industries=row.get("affected_industries") or [],
        signal_type=row["signal_type"],
        severity=float(row["severity"]),
        headline_preview=row.get("headline_preview", ""),
        source=row.get("source", ""),
        expires_at=expires_at,
        classified_by=row.get("classified_by", "keyword"),
        signal_id=str(row.get("id", "")),
    )


# Singleton — compartido entre el scheduler y el endpoint /query/moe
signal_cache = SignalCache()
