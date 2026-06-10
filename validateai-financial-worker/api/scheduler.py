"""
scheduler.py — APScheduler para ingesta automática de datos.

Jobs configurados:
  - FRED sync:      Domingos 03:00 (datos macroeconómicos)
  - yfinance sync:  Día 1 de cada mes, 04:00 (evita horario de mercado)
  - Cache sweep:    Cada 2 horas (limpia entradas expiradas)

APScheduler corre integrado en el proceso FastAPI (AsyncIOScheduler).
No requiere proceso separado ni Celery.
"""
from __future__ import annotations
import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

log = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="America/Santiago")

WORKER_CATEGORIES = [
    "Macroeconomia", "Mercados", "Mercados Chile", "Mercados LATAM",
    "Commodities", "Forex Chile", "Riesgo", "Tasas USA",
]


# ── Jobs ─────────────────────────────────────────────────────────────────────

async def _job_fred_sync() -> None:
    """
    Sincroniza FRED (GDP, CPI, FEDFUNDS) y genera embeddings pendientes.
    Idempotente: upsert por (document_title, header_path).
    """
    log.info("[scheduler] FRED sync iniciado...")
    try:
        from src.db.supabase_client import (
            get_client, bulk_insert_nodes,
            fetch_nodes_pending_embedding, bulk_update_embeddings,
        )
        from src.extractors.fred import fetch_all as fred_fetch_all
        from src.embeddings.openai_embedder import embed_nodes

        client = get_client()
        nodes = await asyncio.to_thread(fred_fetch_all)
        inserted = await asyncio.to_thread(bulk_insert_nodes, client, nodes)
        log.info("[scheduler] FRED: %d/%d nodos upserted.", inserted, len(nodes))

        pending = await asyncio.to_thread(
            fetch_nodes_pending_embedding, client, None, ["Macroeconomia"]
        )
        if pending:
            vectors = await asyncio.to_thread(embed_nodes, pending)
            updates = [{"id": n["id"], "embedding": v} for n, v in zip(pending, vectors)]
            await asyncio.to_thread(bulk_update_embeddings, client, updates)
            log.info("[scheduler] %d embeddings actualizados.", len(updates))

        log.info("[scheduler] FRED sync completado.")
    except Exception:
        log.exception("[scheduler] Error en FRED sync.")


async def _job_yfinance_sync() -> None:
    """
    Sincroniza yfinance (batch download de 12 tickers).
    Se ejecuta el día 1 de cada mes a las 4AM para evitar rate limits
    de Yahoo Finance durante el horario de mercado activo.
    """
    log.info("[scheduler] yfinance sync iniciado...")
    try:
        from src.db.supabase_client import (
            get_client, bulk_insert_nodes,
            fetch_nodes_pending_embedding, bulk_update_embeddings,
        )
        from src.extractors.yfinance_extractor import fetch_all as yf_fetch_all
        from src.embeddings.openai_embedder import embed_nodes

        client = get_client()
        nodes = await asyncio.to_thread(yf_fetch_all)
        inserted = await asyncio.to_thread(bulk_insert_nodes, client, nodes)
        log.info("[scheduler] yfinance: %d/%d nodos upserted.", inserted, len(nodes))

        pending = await asyncio.to_thread(
            fetch_nodes_pending_embedding, client, None,
            [c for c in WORKER_CATEGORIES if c != "Macroeconomia"],
        )
        if pending:
            vectors = await asyncio.to_thread(embed_nodes, pending)
            updates = [{"id": n["id"], "embedding": v} for n, v in zip(pending, vectors)]
            await asyncio.to_thread(bulk_update_embeddings, client, updates)

        log.info("[scheduler] yfinance sync completado.")
    except Exception:
        log.exception("[scheduler] Error en yfinance sync (posible rate limit).")


async def _job_cache_sweep() -> None:
    """Limpia entradas expiradas del cache de embeddings."""
    from api import cache
    import time

    with cache._lock:
        expired = [k for k, (_, exp) in cache._cache.items() if time.monotonic() > exp]
        for k in expired:
            del cache._cache[k]

    if expired:
        log.debug("[scheduler] cache sweep: %d entradas expiradas eliminadas.", len(expired))


# ── Registro de jobs ──────────────────────────────────────────────────────────

scheduler.add_job(
    _job_fred_sync,
    CronTrigger(day_of_week="sun", hour=3, minute=0),
    id="fred_sync",
    name="FRED weekly sync",
    misfire_grace_time=3600,  # si el server estaba caído, ejecuta hasta 1h después
    replace_existing=True,
)

scheduler.add_job(
    _job_yfinance_sync,
    CronTrigger(day=1, hour=4, minute=0),
    id="yfinance_sync",
    name="yfinance monthly sync",
    misfire_grace_time=3600,
    replace_existing=True,
)

scheduler.add_job(
    _job_cache_sweep,
    CronTrigger(hour="*/2"),  # cada 2 horas
    id="cache_sweep",
    name="Cache sweep",
    replace_existing=True,
)
