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
from api.health_monitor import job_health

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


async def _job_radar_refresh() -> None:
    """
    Ciclo completo del Radar Forense (cada 30 min):
      1. Scrapea RSS + Marketaux → titulares frescos
      2. Clasifica cada titular: keyword-first, Haiku si ambiguo
      3. Persiste señales nuevas (severity >= SEVERITY_THRESHOLD) en radar_signals
      4. Inyecta señales activas en el SignalCache en memoria
         (evita que /query/moe tenga que esperar el próximo refresh de cache)
    """
    log.info("[scheduler] Radar Forense refresh iniciado...")
    try:
        from api.radar.scraper import fetch_all_headlines
        from api.radar.classifier import classify_headline
        from api.radar.models import SEVERITY_THRESHOLD
        from api.radar.signal_cache import signal_cache
        from src.db.supabase_client import get_client
        from datetime import datetime, timezone

        client = get_client()
        headlines = await asyncio.to_thread(fetch_all_headlines)
        log.info("[scheduler] Radar: %d titulares obtenidos.", len(headlines))

        new_signals = []
        for headline in headlines:
            signal = await asyncio.to_thread(
                classify_headline, headline.text, headline.source,
                24, getattr(headline, "lang", "es"),
            )
            if signal and signal.severity >= SEVERITY_THRESHOLD:
                new_signals.append(signal)

        log.info("[scheduler] Radar: %d señales nuevas (severity >= %.2f).", len(new_signals), SEVERITY_THRESHOLD)

        # Persistir en Supabase (idempotente: el clasificador produce señales frescas cada ciclo)
        if new_signals:
            rows = [s.to_supabase_row() for s in new_signals]
            try:
                client.table("radar_signals").insert(rows).execute()
                log.info("[scheduler] Radar: %d señales persistidas en radar_signals.", len(rows))
            except Exception as exc:
                log.warning("[scheduler] Radar: insert falló (%s). ¿sprint_moe8_radar.sql aplicado?", exc)

        # Refrescar el cache en memoria con todas las señales activas
        # (incluye las anteriores que aún no expiraron)
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            result = (
                client.table("radar_signals")
                .select("*")
                .gt("expires_at", now_iso)
                .gte("severity", SEVERITY_THRESHOLD)
                .order("severity", desc=True)
                .limit(50)
                .execute()
            )
            from api.radar.signal_cache import _row_to_signal
            all_active = [_row_to_signal(r) for r in (result.data or [])]
            signal_cache.inject(all_active)
        except Exception as exc:
            log.warning("[scheduler] Radar: cache refresh desde DB falló (%s).", exc)
            # Inyectar al menos las señales nuevas de este ciclo
            signal_cache.inject(new_signals)

        log.info("[scheduler] Radar Forense refresh completado.")
        job_health.report("radar_refresh", len(new_signals))
    except Exception:
        log.exception("[scheduler] Error en Radar Forense refresh.")
        job_health.report("radar_refresh", 0)


async def _job_cmf_sync() -> None:
    """
    Sincroniza Hechos Esenciales CMF (cada 4 horas, horario bursátil Santiago).
    Produce:
      - Nodos PERMANENTES en knowledge_nodes (category='Regulatorio CMF')
      - RadarSignals para HEs materialmente negativos (multas, quiebras)
    """
    log.info("[scheduler] CMF sync iniciado...")
    try:
        from src.db.supabase_client import (
            get_client, bulk_insert_nodes,
            fetch_nodes_pending_embedding, bulk_update_embeddings,
        )
        from src.extractors.cmf_extractor import (
            fetch_all_as_nodes, fetch_all_as_signals,
        )
        from src.embeddings.openai_embedder import embed_nodes
        from api.radar.models import SEVERITY_THRESHOLD
        from api.radar.signal_cache import signal_cache

        client = get_client()

        # Nodos KG permanentes
        nodes = await asyncio.to_thread(fetch_all_as_nodes)
        if nodes:
            inserted = await asyncio.to_thread(bulk_insert_nodes, client, nodes)
            log.info("[scheduler] CMF: %d/%d nodos upserted.", inserted, len(nodes))

            pending = await asyncio.to_thread(
                fetch_nodes_pending_embedding, client, "Regulatorio CMF"
            )
            if pending:
                vectors = await asyncio.to_thread(embed_nodes, pending)
                updates = [{"id": n["id"], "embedding": v} for n, v in zip(pending, vectors)]
                await asyncio.to_thread(bulk_update_embeddings, client, updates)
                log.info("[scheduler] CMF: %d embeddings actualizados.", len(updates))

        # RadarSignals para HEs materiales
        signals = await asyncio.to_thread(fetch_all_as_signals)
        active = [s for s in signals if s.severity >= SEVERITY_THRESHOLD]
        if active:
            rows = [s.to_supabase_row() for s in active]
            try:
                client.table("radar_signals").insert(rows).execute()
                log.info("[scheduler] CMF: %d señales radar insertadas.", len(rows))
            except Exception as exc:
                log.warning("[scheduler] CMF radar insert falló: %s", exc)
            signal_cache.inject(active)

        log.info("[scheduler] CMF sync completado.")
        job_health.report("cmf_sync", len(nodes) + len(active))
    except Exception:
        log.exception("[scheduler] Error en CMF sync.")
        job_health.report("cmf_sync", 0)


async def _job_mp_sync() -> None:
    """
    Sincroniza licitaciones ADJUDICADAS desde Mercado Público (diario 06:00).
    Produce nodos PERMANENTES en knowledge_nodes (category='Mercado Público').
    """
    log.info("[scheduler] Mercado Público sync iniciado...")
    try:
        from src.db.supabase_client import (
            get_client, bulk_insert_nodes,
            fetch_nodes_pending_embedding, bulk_update_embeddings,
        )
        from src.extractors.mercadopublico_extractor import fetch_all_as_nodes
        from src.embeddings.openai_embedder import embed_nodes

        client = get_client()
        nodes = await asyncio.to_thread(fetch_all_as_nodes)

        if nodes:
            inserted = await asyncio.to_thread(bulk_insert_nodes, client, nodes)
            log.info("[scheduler] MP: %d/%d licitaciones upserted.", inserted, len(nodes))

            pending = await asyncio.to_thread(
                fetch_nodes_pending_embedding, client, "Mercado Público"
            )
            if pending:
                vectors = await asyncio.to_thread(embed_nodes, pending)
                updates = [{"id": n["id"], "embedding": v} for n, v in zip(pending, vectors)]
                await asyncio.to_thread(bulk_update_embeddings, client, updates)
                log.info("[scheduler] MP: %d embeddings actualizados.", len(updates))
        else:
            log.info("[scheduler] MP: sin licitaciones adjudicadas hoy.")

        log.info("[scheduler] Mercado Público sync completado.")
    except Exception:
        log.exception("[scheduler] Error en Mercado Público sync.")


async def _job_bcch_sync() -> None:
    """
    Sprint 3 — Procesa los documentos BCCH más recientes (Comunicados + Minutas).
    Corre los lunes 07:00 hora Santiago: captura reuniones del jueves/viernes previo.

    Produce:
      - Nodos PERMANENTES en knowledge_nodes (category='Banco Central Chile')
      - Nodo ancla 'BCCH Política Monetaria Chile — Estado Actual' (upsert)
      - RadarSignals si la decisión TPM o el tono es material
    """
    log.info("[scheduler] BCCH sync iniciado...")
    try:
        from src.db.supabase_client import (
            get_client, bulk_insert_nodes,
            fetch_nodes_pending_embedding, bulk_update_embeddings,
        )
        from src.extractors.bcch_extractor import fetch_all_as_nodes, fetch_all_as_signals
        from src.embeddings.openai_embedder import embed_nodes
        from api.radar.models import SEVERITY_THRESHOLD
        from api.radar.signal_cache import signal_cache

        client = get_client()

        nodes = await asyncio.to_thread(fetch_all_as_nodes)
        if nodes:
            inserted = await asyncio.to_thread(bulk_insert_nodes, client, nodes)
            log.info("[scheduler] BCCH: %d/%d nodos upserted.", inserted, len(nodes))

            pending = await asyncio.to_thread(
                fetch_nodes_pending_embedding, client, CATEGORY
            )
            if pending:
                vectors = await asyncio.to_thread(embed_nodes, pending)
                updates = [{"id": n["id"], "embedding": v} for n, v in zip(pending, vectors)]
                await asyncio.to_thread(bulk_update_embeddings, client, updates)
                log.info("[scheduler] BCCH: %d embeddings actualizados.", len(updates))

        signals = await asyncio.to_thread(fetch_all_as_signals)
        active = [s for s in signals if s.severity >= SEVERITY_THRESHOLD]
        if active:
            rows = [s.to_supabase_row() for s in active]
            try:
                client.table("radar_signals").insert(rows).execute()
                log.info("[scheduler] BCCH: %d señales radar insertadas.", len(rows))
            except Exception as exc:
                log.warning("[scheduler] BCCH radar insert falló: %s", exc)
            signal_cache.inject(active)

        log.info("[scheduler] BCCH sync completado.")
        job_health.report("bcch_sync", len(nodes) + len(active))
    except Exception:
        log.exception("[scheduler] Error en BCCH sync.")
        job_health.report("bcch_sync", 0)


CATEGORY = "Banco Central Chile"


async def _job_seia_sync() -> None:
    """
    Sprint 4 — SEIA: proyectos aprobados/rechazados (cada 3 días, 08:00 Santiago).
    Produce nodos KG + RadarSignals para rechazos.
    """
    log.info("[scheduler] SEIA sync iniciado...")
    try:
        from src.db.supabase_client import (
            get_client, bulk_insert_nodes,
            fetch_nodes_pending_embedding, bulk_update_embeddings,
        )
        from src.extractors.seia_extractor import fetch_all_as_nodes, fetch_all_as_signals
        from src.embeddings.openai_embedder import embed_nodes
        from api.radar.signal_cache import signal_cache
        from api.radar.models import SEVERITY_THRESHOLD

        client = get_client()
        nodes = await asyncio.to_thread(fetch_all_as_nodes)
        if nodes:
            await asyncio.to_thread(bulk_insert_nodes, client, nodes)
            pending = await asyncio.to_thread(
                fetch_nodes_pending_embedding, client, "SEIA"
            )
            if pending:
                vectors = await asyncio.to_thread(embed_nodes, pending)
                updates = [{"id": n["id"], "embedding": v} for n, v in zip(pending, vectors)]
                await asyncio.to_thread(bulk_update_embeddings, client, updates)
                log.info("[scheduler] SEIA: %d embeddings actualizados.", len(updates))

        signals = await asyncio.to_thread(fetch_all_as_signals)
        active = [s for s in signals if s.severity >= SEVERITY_THRESHOLD]
        if active:
            rows = [s.to_supabase_row() for s in active]
            try:
                client.table("radar_signals").insert(rows).execute()
            except Exception as exc:
                log.warning("[scheduler] SEIA radar insert falló: %s", exc)
            signal_cache.inject(active)

        log.info("[scheduler] SEIA sync completado.")
        job_health.report("seia_sync", len(nodes) + len(active))
    except Exception:
        log.exception("[scheduler] Error en SEIA sync.")
        job_health.report("seia_sync", 0)


async def _job_concursal_sync() -> None:
    """
    Sprint 4 — SUPERIR Boletín Concursal + Diario Oficial (diario 07:30 Santiago).
    Produce nodos KG + RadarSignals de alta severidad para liquidaciones.
    """
    log.info("[scheduler] Boletín Concursal sync iniciado...")
    try:
        from src.db.supabase_client import (
            get_client, bulk_insert_nodes,
            fetch_nodes_pending_embedding, bulk_update_embeddings,
        )
        from src.extractors.diario_oficial_extractor import (
            fetch_all_as_nodes, fetch_all_as_signals,
        )
        from src.embeddings.openai_embedder import embed_nodes
        from api.radar.signal_cache import signal_cache
        from api.radar.models import SEVERITY_THRESHOLD

        client = get_client()
        nodes = await asyncio.to_thread(fetch_all_as_nodes)
        if nodes:
            await asyncio.to_thread(bulk_insert_nodes, client, nodes)
            cats = ["Boletín Concursal", "Diario Oficial"]
            pending = await asyncio.to_thread(
                fetch_nodes_pending_embedding, client, categories=cats
            )
            if pending:
                vectors = await asyncio.to_thread(embed_nodes, pending)
                updates = [{"id": n["id"], "embedding": v} for n, v in zip(pending, vectors)]
                await asyncio.to_thread(bulk_update_embeddings, client, updates)

        signals = await asyncio.to_thread(fetch_all_as_signals)
        active = [s for s in signals if s.severity >= SEVERITY_THRESHOLD]
        if active:
            rows = [s.to_supabase_row() for s in active]
            try:
                client.table("radar_signals").insert(rows).execute()
                log.info("[scheduler] Concursal: %d señales insertadas.", len(rows))
            except Exception as exc:
                log.warning("[scheduler] Concursal radar insert falló: %s", exc)
            signal_cache.inject(active)

        log.info("[scheduler] Boletín Concursal sync completado.")
        job_health.report("concursal_sync", len(nodes) + len(active))
    except Exception:
        log.exception("[scheduler] Error en Concursal sync.")
        job_health.report("concursal_sync", 0)


async def _job_empleo_sync() -> None:
    """
    Sprint 4 — Señal de empleo sectorial (sábados 09:00 Santiago).
    Proxy de expansión/contracción por sector.
    """
    log.info("[scheduler] Empleo sync iniciado...")
    try:
        from src.db.supabase_client import (
            get_client, bulk_insert_nodes,
            fetch_nodes_pending_embedding, bulk_update_embeddings,
        )
        from src.extractors.empleo_extractor import (
            fetch_all_as_nodes, fetch_all_as_signals,
        )
        from src.embeddings.openai_embedder import embed_nodes
        from api.radar.signal_cache import signal_cache
        from api.radar.models import SEVERITY_THRESHOLD

        client = get_client()
        nodes = await asyncio.to_thread(fetch_all_as_nodes, client)
        if nodes:
            await asyncio.to_thread(bulk_insert_nodes, client, nodes)
            pending = await asyncio.to_thread(
                fetch_nodes_pending_embedding, client, "Señal Empleo"
            )
            if pending:
                vectors = await asyncio.to_thread(embed_nodes, pending)
                updates = [{"id": n["id"], "embedding": v} for n, v in zip(pending, vectors)]
                await asyncio.to_thread(bulk_update_embeddings, client, updates)

        signals = await asyncio.to_thread(fetch_all_as_signals, client)
        active = [s for s in signals if s.severity >= SEVERITY_THRESHOLD]
        if active:
            rows = [s.to_supabase_row() for s in active]
            try:
                client.table("radar_signals").insert(rows).execute()
            except Exception as exc:
                log.warning("[scheduler] Empleo radar insert falló: %s", exc)
            signal_cache.inject(active)

        log.info("[scheduler] Empleo sync completado.")
        job_health.report("empleo_sync", len(nodes) + len(active))
    except Exception:
        log.exception("[scheduler] Error en Empleo sync.")
        job_health.report("empleo_sync", 0)


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

scheduler.add_job(
    _job_radar_refresh,
    CronTrigger(minute="*/30"),  # cada 30 minutos
    id="radar_refresh",
    name="Radar Forense — scraping + clasificación de señales",
    misfire_grace_time=300,
    replace_existing=True,
)

# ── cmf_sync DESACTIVADO el 2026-08-04 ───────────────────────────────────────
#
# NO se registra a propósito. El job corría tres veces al día y NUNCA produjo un
# solo nodo: `knowledge_nodes` no tiene ni uno de categoría 'Regulatorio CMF' en
# toda su historia. No es una regresión — nunca pudo funcionar.
#
# El extractor pide `hechos_esenciales` a
# `api.cmfchile.cl/api-sbifv3/recursos/svs/api`, que hoy responde 302 hacia
# `api.sbif.cl/error.html` (dominio de la ex-SBIF, fusionada en la CMF en 2019).
# Desde Vercel ese host ni resuelve, y de ahí el ConnectionError tras 4
# reintentos: 25,9 s gastados cada corrida para no traer nada.
#
# Y el problema de fondo no es la URL. Verificado endpoint por endpoint, esa API
# sirve `uf`, `utm`, `dolar` y `euro` — NO hechos esenciales, que la CMF publica
# sólo en su sitio web. El recurso contra el que se escribió este extractor no
# existe en esa API y nunca existió.
#
# Los indicadores que sí sirve ya llegan por otra vía: `economic_knowledge` tiene
# las filas de CMF al día. Así que esto no deja ningún hueco de datos.
#
# POR QUÉ SE DESACTIVA EN VEZ DE DEJARLO CORRER: un job que falla cada 4 horas y
# se reporta verde entrena a ignorar el tablero. Las 64 señales
# `health_monitor:cmf_sync` en radar_signals son el monitor avisando esto durante
# meses, sin que nadie las leyera.
#
# PARA REVIVIRLO hay que escribir un scraper del sitio de la CMF, no arreglar una
# URL. El job sigue en `_JOBS` para poder dispararlo a mano mientras se
# desarrolla; lo que se quita es el schedule.

# Mercado Público: ingestado por proceso externo — job no registrado aquí.

scheduler.add_job(
    _job_seia_sync,
    CronTrigger(day="*/3", hour=8, minute=0, timezone="America/Santiago"),
    id="seia_sync",
    name="SEIA — proyectos aprobados/rechazados (cada 3 días)",
    misfire_grace_time=3600,
    replace_existing=True,
)

scheduler.add_job(
    _job_concursal_sync,
    CronTrigger(day_of_week="mon-fri", hour=7, minute=30, timezone="America/Santiago"),
    id="concursal_sync",
    name="Boletín Concursal SUPERIR + Diario Oficial (diario hábil)",
    misfire_grace_time=3600,
    replace_existing=True,
)

scheduler.add_job(
    _job_empleo_sync,
    CronTrigger(day_of_week="sat", hour=9, minute=0, timezone="America/Santiago"),
    id="empleo_sync",
    name="Señal Empleo Sectorial — Computrabajo (semanal)",
    misfire_grace_time=3600,
    replace_existing=True,
)

scheduler.add_job(
    _job_bcch_sync,
    CronTrigger(day_of_week="mon", hour=7, minute=0, timezone="America/Santiago"),
    id="bcch_sync",
    name="BCCH Comunicados + Minutas — KG permanente + señal hawkish/dovish",
    misfire_grace_time=3600,
    replace_existing=True,
)


async def _job_embeddings_pendientes() -> None:
    """
    Vectoriza CUALQUIER nodo sin embedding, sin importar su categoria.

    POR QUE EXISTE: cada job de ingesta embebe solo lo suyo (fred_sync ->
    "Macroeconomia", el pipeline de /ingest -> una lista fija de 8 categorias).
    Un nodo en una categoria nueva se inserta bien y NUNCA recibe embedding:
    queda en la tabla y es invisible para el RAG. Paso exactamente eso con los
    20 nodos de Jurisprudencia generados desde mp-sync.

    Un nodo sin vector no falla, no avisa y no aparece. Este job cierra ese
    agujero para todas las categorias, presentes y futuras.
    """
    from src.db.supabase_client import (
        get_client, fetch_nodes_pending_embedding, bulk_update_embeddings,
    )
    from src.embeddings.openai_embedder import embed_nodes

    client = get_client()
    # category=None y categories=None -> todos los pendientes.
    pendientes = await asyncio.to_thread(fetch_nodes_pending_embedding, client, None, None)
    if not pendientes:
        log.info("[embeddings] no hay nodos pendientes.")
        return

    vectores = await asyncio.to_thread(embed_nodes, pendientes)
    updates = [{"id": n["id"], "embedding": v} for n, v in zip(pendientes, vectores)]
    await asyncio.to_thread(bulk_update_embeddings, client, updates)
    log.info("[embeddings] %d nodos vectorizados.", len(updates))
