"""
api/health_monitor.py — Monitor de salud para jobs del scheduler.

Problema que resuelve: un job puede correr, no dar error, y retornar 0 nodos
repetidamente (HTML cambió, URL bloqueada, PDF vacío). Sin detección activa,
esto se ve como éxito en los logs y el KG silenciosamente deja de crecer.

Solución: un contador de "fallos silenciosos" por job. Cuando un job retorna
0 resultados K veces seguidas, se avisa por Discord y se persiste en
`radar_signals`.

POR QUÉ EL ESTADO VIVE EN LA BASE Y NO EN MEMORIA
-------------------------------------------------
Hasta el 2026-08-04 este contador era un dict en el proceso. Funcionó mientras el
worker corría persistente: hay 64 señales `health_monitor:cmf_sync` en
radar_signals, la última del 2026-07-13.

El 2026-07-14 el worker se desplegó en Vercel (62991f2) y el 15 se le agregaron
triggers HTTP para el scheduler en serverless (258c6f5). Desde entonces cada
`/jobs/run/*` es un proceso nuevo: el contador vuelve a 0 en cada invocación y el
umbral de 3 corridas consecutivas quedó matemáticamente inalcanzable.

Nadie rompió nada. Una migración de arquitectura invalidó el detector en
silencio, y por eso cuatro extractores llevan meses muertos sin una sola alerta.
El estado ahora vive en `job_health` (ver migración 20260805000001), que es lo
único que sobrevive entre invocaciones, y el umbral y el anti-spam se deciden en
la misma operación atómica que acumula — dos invocaciones solapadas no pueden
perder cuentas ni alertar dos veces por el mismo evento.

Uso en scheduler:
    from api.health_monitor import job_health
    job_health.report("seia_sync", n_results=len(nodes))
"""
from __future__ import annotations
import logging
from datetime import datetime, timedelta, timezone

log = logging.getLogger(__name__)

# Cuántas corridas vacías consecutivas antes de disparar alerta
EMPTY_RUNS_THRESHOLD = 3


class JobHealthMonitor:
    """
    Monitor SIN estado local: todo vive en la tabla `job_health`.

    No tiene `__init__` a propósito. Antes guardaba un dict por proceso y eso fue
    exactamente lo que lo dejó inútil al pasar a serverless: cada invocación
    arrancaba con los contadores en cero. Si alguien vuelve a agregar estado de
    instancia acá, el detector deja de detectar sin que nada falle.
    """

    def report(self, job_id: str, n_results: int) -> None:
        """
        Llamar al final de cada job con cuántos ítems produjo (nodos, señales…).

        n_results = 0 cuenta como fallo silencioso. El acumulado y la decisión de
        alertar los resuelve `job_health_report` en la base, en una sola
        operación: si se hiciera leer-modificar-escribir desde acá, dos
        invocaciones solapadas perderían cuentas y podrían alertar dos veces.

        Nunca lanza: un fallo del monitor no puede tumbar el job que monitorea.
        """
        try:
            from src.db.supabase_client import get_client
            resp = get_client().rpc(
                "job_health_report",
                {"p_job_id": job_id, "p_results": int(n_results)},
            ).execute()
            fila = (resp.data or [{}])[0] if isinstance(resp.data, list) else (resp.data or {})
        except Exception as exc:
            # Se degrada a log y sigue. Antes esto vivía en memoria y no podía
            # fallar; ahora depende de la BD, así que el job no puede depender de él.
            log.warning("[health] No se pudo registrar salud de '%s': %s", job_id, exc)
            return

        vacias = int(fila.get("consecutive_empty") or 0)
        ultimo_exito = fila.get("last_success")

        if n_results > 0:
            log.debug("[health] %s: %d resultados. Streak OK.", job_id, n_results)
            return

        log.warning("[health] %s: 0 resultados (corrida vacía #%d).", job_id, vacias)

        if fila.get("debe_alertar"):
            self._alertar(job_id, vacias, ultimo_exito)

    def _alertar(self, job_id: str, vacias: int, ultimo_exito) -> None:
        """
        Avisa por Discord y deja rastro en radar_signals.

        El canal importa: va a `degradacion`, no al latido. El latido reporta que
        un job TERMINÓ —y por eso `cmf_sync` se veía verde durante meses mientras
        producía cero—; esto reporta que no SIRVIÓ, que es lo que hay que mirar.
        """
        detalle = (
            f"El job corrió {vacias} veces seguidas sin producir un solo resultado. "
            "No lanza error: la fuente cambió de formato, quedó bloqueada o devuelve vacío. "
            + (f"Último resultado real: {ultimo_exito}." if ultimo_exito else "NUNCA ha producido resultados.")
        )
        log.error("[health] FALLO SILENCIOSO en '%s': %s", job_id, detalle)

        try:
            from api.ops_alert import send_ops_alert
            send_ops_alert(
                nivel="error",
                titulo=f"Fallo silencioso: {job_id}",
                detalle=detalle,
                campos=[
                    ("Job", job_id),
                    ("Corridas vacías", str(vacias)),
                    ("Último resultado", str(ultimo_exito) if ultimo_exito else "nunca"),
                ],
                canal="degradacion",
                dedupe_key=f"health-{job_id}",
            )
        except Exception as exc:
            log.warning("[health] No se pudo enviar la alerta a Discord: %s", exc)

        self._persist_alert_simple(job_id, vacias)

    def _persist_alert_simple(self, job_id: str, vacias: int) -> None:
        """Deja la alerta en radar_signals para que aparezca en el Radar Forense."""
        try:
            from src.db.supabase_client import get_client
            now = datetime.now(timezone.utc)
            get_client().table("radar_signals").insert({
                "sector": "infra",
                "affected_industries": ["all"],
                "signal_type": "SECTOR_RISK",
                "severity": 0.55,
                "headline_preview": (
                    f"[SISTEMA] Job '{job_id}' lleva {vacias} corridas consecutivas "
                    f"sin resultados. Fuente posiblemente bloqueada o cambiada."
                )[:300],
                "source": f"health_monitor:{job_id}",
                "expires_at": (now + timedelta(hours=48)).isoformat(),
                "classified_by": "health_monitor",
            }).execute()
        except Exception as exc:
            log.warning("[health] No se pudo persistir alerta en radar_signals: %s", exc)

    def status(self) -> dict[str, dict]:
        """
        Estado de todos los jobs para el endpoint /health.

        Lee de `job_health_resumen`, no de memoria: en serverless la memoria de
        esta invocación no sabe nada de las anteriores, así que un status local
        habría reportado siempre "todo bien, 0 corridas".
        """
        try:
            from src.db.supabase_client import get_client
            filas = get_client().table("job_health_resumen").select("*").execute().data or []
        except Exception as exc:
            log.warning("[health] No se pudo leer job_health_resumen: %s", exc)
            return {}

        return {
            f["job_id"]: {
                "consecutive_empty": f.get("consecutive_empty"),
                "total_runs": f.get("total_runs"),
                "total_results": f.get("total_results"),
                "last_success": f.get("last_success"),
                "dias_sin_producir": f.get("dias_sin_producir"),
                "estado": f.get("estado"),
                "healthy": f.get("estado") == "ok",
            }
            for f in filas
        }

job_health = JobHealthMonitor()
