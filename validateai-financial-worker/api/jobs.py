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

from fastapi import APIRouter, Header, HTTPException

from api.scheduler import (
    _job_bcch_sync,
    _job_cache_sweep,
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
    await job()
    return {"ok": True, "job": job_id}
