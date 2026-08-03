"""
api/jobs.py — Disparadores HTTP de los jobs del scheduler.

En serverless (Vercel) el APScheduler está deshabilitado (ver lifespan en app.py),
así que los 9 jobs de ingesta/radar se disparan por HTTP desde un cron externo
(GitHub Actions), igual que el patrón de S-Pulse. Cada endpoint invoca la misma
función `_job_*` que registraba el scheduler.

Protegido por CRON_SECRET (Bearer), separado de BRALIDUS_API_KEY: un secreto de
cron filtrado sólo permite disparar jobs, no consultar el RAG. Si CRON_SECRET no
está configurado, el check se saltea (sólo dev — nunca dejar sin setear en prod).
"""

import os
import time

from fastapi import APIRouter, Header, HTTPException

from api.ops_alert import send_ops_alert
from api.scheduler import (
    _job_bcch_sync,
    _job_cache_sweep,
    _job_embeddings_pendientes,
    _job_cmf_sync,
    _job_concursal_sync,
    _job_empleo_sync,
    _job_fred_sync,
    _job_radar_refresh,
    _job_seia_sync,
    _job_yfinance_sync,
)

# job_id (mismo que en scheduler.add_job) → coroutine a ejecutar.
_JOBS = {
    "fred_sync": _job_fred_sync,
    "yfinance_sync": _job_yfinance_sync,
    "cache_sweep": _job_cache_sweep,
    # Vectoriza nodos de cualquier categoria. Sin el, un nodo de una categoria
    # nueva se inserta y nunca recibe embedding: invisible para el RAG.
    "embeddings_pendientes": _job_embeddings_pendientes,
    "radar_refresh": _job_radar_refresh,
    "cmf_sync": _job_cmf_sync,
    "seia_sync": _job_seia_sync,
    "concursal_sync": _job_concursal_sync,
    "empleo_sync": _job_empleo_sync,
    "bcch_sync": _job_bcch_sync,
}

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _require_cron_secret(authorization: str | None) -> None:
    secret = os.getenv("CRON_SECRET")
    if not secret:
        return  # dev: sin secret configurado no se exige; NUNCA dejar así en prod
    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer ") :].strip()
    if token != secret:
        raise HTTPException(status_code=401, detail="CRON_SECRET inválido o ausente")


@router.get("/list", summary="Lista los job_id disparables")
async def list_jobs(authorization: str | None = Header(default=None)):
    _require_cron_secret(authorization)
    return {"jobs": sorted(_JOBS.keys())}


@router.post("/run/{job_id}", summary="Ejecuta un job del scheduler por HTTP")
async def run_job(job_id: str, authorization: str | None = Header(default=None)):
    _require_cron_secret(authorization)
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"job desconocido: {job_id}")

    # Se reporta TODA corrida, no sólo las que fallan. Un canal que sólo habla
    # cuando algo se rompe deja un silencio indistinguible de "todo bien": la
    # ingesta de Mercado Público estuvo tres días detenida así. Con un latido por
    # corrida, la ausencia de mensajes pasa a ser una señal.
    inicio = time.monotonic()
    try:
        await job()
    except Exception as err:
        duracion = time.monotonic() - inicio
        send_ops_alert(
            nivel="error",
            canal="incidentes",
            titulo=f"Job '{job_id}' falló",
            detalle=f"```\n{type(err).__name__}: {str(err)[:300]}\n```",
            campos=[("Job", job_id), ("Duración", f"{duracion:.1f}s")],
            footer="bralidus",
            # Cada corrida es un hecho distinto, pero un job que falla en bucle
            # no debe inundar el canal: la clave es por job, no por corrida.
            dedupe_key=f"job-failed:{job_id}",
        )
        raise

    duracion = time.monotonic() - inicio
    send_ops_alert(
        nivel="info",
        canal="latido",
        titulo=f"{job_id} — success",
        campos=[("Job", job_id), ("Duración", f"{duracion:.1f}s")],
        footer="bralidus",
        # Sin dedupe efectivo: cada corrida exitosa es un latido y se quiere ver.
        dedupe_key=f"job-ok:{job_id}:{int(inicio)}",
    )
    return {"ok": True, "job": job_id, "duracion_s": round(duracion, 1)}
