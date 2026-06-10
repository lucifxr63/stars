"""
api/health_monitor.py — Monitor de salud para jobs del scheduler.

Problema que resuelve: un job puede correr, no dar error, y retornar 0 nodos
repetidamente (HTML cambió, URL bloqueada, PDF vacío). Sin detección activa,
esto se ve como éxito en los logs y el KG silenciosamente deja de crecer.

Solución: un contador de "fallos silenciosos" por job. Cuando un job retorna
0 resultados K veces seguidas, se persiste una alerta en `radar_signals`
con signal_type SECTOR_RISK para que aparezca en el Radar Forense y sea
visible para el equipo de desarrollo.

Uso en scheduler:
    from api.health_monitor import job_health
    job_health.report("seia_sync", n_results=len(nodes))
"""
from __future__ import annotations
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

log = logging.getLogger(__name__)

# Cuántas corridas vacías consecutivas antes de disparar alerta
EMPTY_RUNS_THRESHOLD = 3


@dataclass
class _JobState:
    consecutive_empty: int = 0
    last_success: datetime | None = None
    last_alert_at: datetime | None = None
    total_runs: int = 0
    total_results: int = 0


class JobHealthMonitor:
    """
    Monitor en memoria. Se inicializa con el proceso FastAPI y vive mientras
    el servidor está activo. Los contadores se resetean al reiniciar.
    """

    def __init__(self) -> None:
        self._state: dict[str, _JobState] = defaultdict(_JobState)

    def report(self, job_id: str, n_results: int) -> None:
        """
        Llamar al final de cada job con cuántos ítems produjo (nodos, señales, etc.).
        n_results = 0 cuenta como fallo silencioso.
        """
        state = self._state[job_id]
        state.total_runs += 1
        state.total_results += n_results

        if n_results > 0:
            state.consecutive_empty = 0
            state.last_success = datetime.now(timezone.utc)
            log.debug("[health] %s: %d resultados. Streak OK.", job_id, n_results)
        else:
            state.consecutive_empty += 1
            log.warning(
                "[health] %s: 0 resultados (run #%d vacía consecutiva).",
                job_id, state.consecutive_empty,
            )
            if state.consecutive_empty >= EMPTY_RUNS_THRESHOLD:
                self._fire_alert(job_id, state)

    def _fire_alert(self, job_id: str, state: _JobState) -> None:
        now = datetime.now(timezone.utc)

        # Anti-spam: no más de una alerta cada 6 horas por job
        if state.last_alert_at and (now - state.last_alert_at).total_seconds() < 21600:
            return

        state.last_alert_at = now
        log.error(
            "[health] ALERTA FALLO SILENCIOSO: job '%s' lleva %d corridas consecutivas "
            "sin producir resultados. Posible URL bloqueada, HTML cambiado o PDF vacío. "
            "Revisar logs del job.",
            job_id, state.consecutive_empty,
        )

        # Persistir en radar_signals para visibilidad inmediata
        self._persist_alert(job_id, state, now)

    def _persist_alert(self, job_id: str, state: _JobState, now: datetime) -> None:
        try:
            from src.db.supabase_client import get_client
            client = get_client()
            client.table("radar_signals").insert({
                "sector": "infra",
                "affected_industries": ["all"],
                "signal_type": "SECTOR_RISK",
                "severity": 0.55,
                "headline_preview": (
                    f"[SISTEMA] Job '{job_id}' lleva {state.consecutive_empty} corridas "
                    f"consecutivas sin resultados. Fuente posiblemente bloqueada o inaccesible."
                )[:300],
                "source": f"health_monitor:{job_id}",
                "expires_at": (now + timedelta(hours=48)).isoformat(),
                "classified_by": "health_monitor",
            }).execute()
        except Exception as exc:
            log.warning("[health] No se pudo persistir alerta en radar_signals: %s", exc)

    def status(self) -> dict[str, dict]:
        """Retorna el estado actual de todos los jobs para el endpoint /health."""
        return {
            job_id: {
                "consecutive_empty": s.consecutive_empty,
                "last_success": s.last_success.isoformat() if s.last_success else None,
                "total_runs": s.total_runs,
                "total_results": s.total_results,
                "healthy": s.consecutive_empty < EMPTY_RUNS_THRESHOLD,
            }
            for job_id, s in self._state.items()
        }


# Singleton global — importado por scheduler y por /health endpoint
job_health = JobHealthMonitor()
