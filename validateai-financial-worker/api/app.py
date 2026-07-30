"""
BralidusPY API — FastAPI application.

Motor de inteligencia macro para ValidateAI.
Convierte contexto de startup en consultas GraphRAG dinámicas.

Endpoints:
  POST /query     → RAG dinámico (el principal)
  GET  /entities  → Lista entidades disponibles en knowledge_nodes
  GET  /cache     → Stats del cache de embeddings
  POST /ingest    → Dispara ingesta FRED + yfinance en background
  GET  /health    → Estado del sistema
"""
from __future__ import annotations
import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

_start_time = time.time()

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import (
    QueryRequest, QueryResponse, NodeResult,
    MoEQueryRequest, MoEQueryResponse, ExpertActivation,
    EntitiesResponse, EntitySummary,
    IngestResponse,
    HealthResponse, ServiceStatus,
    RateSignalRequest, RateSignalResponse,
)
from api.entity_router import route as route_entities
from api.moe_router import gating_network
from api.experts import EXPERTS
from api.radar.signal_cache import signal_cache
from api.auth import require_api_key
from api.licitus import router as licitus_router, build_procurement_context
from api.jobs import router as jobs_router
from api import rag, cache

log = logging.getLogger(__name__)


# ── Supabase client singleton ─────────────────────────────────────────────────

_supabase_client = None

def get_db():
    global _supabase_client
    if _supabase_client is None:
        from src.db.supabase_client import get_client
        _supabase_client = get_client()
    return _supabase_client


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    )
    log.info("BralidusPY API iniciando...")
    get_db()
    log.info("Supabase client listo.")

    # Iniciar scheduler de jobs automáticos. En serverless (Vercel) NO corre:
    # no hay proceso long-lived, el thread se congela tras la respuesta. Los jobs
    # se disparan aparte (Vercel Cron / GitHub Actions) por HTTP. VERCEL=1 lo pone
    # Vercel automáticamente.
    if os.getenv("VERCEL"):
        log.info("Entorno Vercel detectado: scheduler deshabilitado (jobs por cron externo).")
    else:
        from api.scheduler import scheduler
        scheduler.start()
        jobs = scheduler.get_jobs()
        log.info("Scheduler iniciado: %d jobs activos.", len(jobs))
        for job in jobs:
            log.info("  - %s: próxima ejecución %s", job.name, job.next_run_time)

    auth_active = bool(os.getenv("BRALIDUS_API_KEY"))
    log.info("Auth: %s", "activa (Bearer token)" if auth_active else "deshabilitada (dev mode)")

    yield

    if not os.getenv("VERCEL"):
        scheduler.shutdown(wait=False)
    log.info("BralidusPY API apagando.")


# ── FastAPI instance ──────────────────────────────────────────────────────────

app = FastAPI(
    title="BralidusPY API",
    description=(
        "Motor de inteligencia macro para ValidateAI. "
        "Expone GraphRAG dinámico sobre knowledge_nodes (FRED + yfinance). "
        "La consulta del usuario determina qué entidades se activan."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ALLOWED_ORIGINS env var: space-separated list of origins.
# Railway adds supabase Edge Functions as internal caller — kept open to supabase.co domain.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] or [
    "https://validus.scouttech.lat",
    "https://animus.scouttech.lat",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Router proxy read-only de Licitus (/licitus/*). Protegido por require_api_key.
app.include_router(licitus_router)

# Disparadores HTTP de los jobs del scheduler (/jobs/*). Protegido por CRON_SECRET.
# Reemplaza al APScheduler en serverless (ver lifespan); los agenda un cron externo.
app.include_router(jobs_router)


# S-Pulse dejo de ser un servicio independiente (se movio dentro de Animus y no
# expone API). Aca vivia `_maybe_append_spulse`, que anexaba un bloque de
# relaciones societarias al contexto via HTTP. Se retira junto con su cliente y
# su router proxy: apuntaba a un host que ya no resuelve.
#
# Para reponerlo cuando vuelva: espeja `_maybe_append_licitus` de abajo — mismo
# contrato (lee company_rut del startup_context, degrada a `context` intacto
# ante cualquier fallo) y se llama en los mismos dos puntos de /query.


async def _maybe_append_licitus(context: str, startup_context) -> str:
    """
    Si el startup_context trae un company_rut y Licitus está configurado, anexa
    un bloque de actividad en compras públicas (OCs reales + benchmarks de
    Mercado Público) citable. Degrada a `context` sin cambios ante cualquier
    fallo.
    """
    rut = getattr(startup_context, "company_rut", None) if startup_context else None
    if not rut:
        return context
    try:
        proc = await asyncio.to_thread(build_procurement_context, rut)
    except Exception as exc:  # defensivo — build_* ya degrada, esto es doble red
        log.warning("[licitus] build_procurement_context falló (%s).", exc)
        return context
    return f"{context}\n\n{proc}" if proc else context


# ── POST /query ───────────────────────────────────────────────────────────────

@app.post(
    "/query",
    response_model=QueryResponse,
    summary="RAG dinámico: startup_context + query → contexto para LLM",
    tags=["rag"],
    dependencies=[Depends(require_api_key)],
)
async def query_endpoint(req: QueryRequest) -> QueryResponse:
    """
    Flujo completo:

    1. **Cache**: si la query ya fue procesada, devuelve embedding cacheado
    2. **Routing**: startup_context → entity_titles[] (qué nodos del grafo activar)
    3. **Embed**: query text → vector[1536] (con cache LRU)
    4. **GraphRAG**: search_hybrid_graphrag(embedding, entities) → nodos rankeados
    5. **Enriquecimiento**: añade category + metadata a cada nodo
    6. **Ensamblado**: formatea en Markdown para inyectar en prompt de LLM

    Si `startup_context` es null, usa solo búsqueda vectorial pura.
    Si `entity_override` está presente, ignora el routing automático.
    """
    client = get_db()

    # 1. Routing de entidades
    if req.entity_override:
        entities = req.entity_override
        routing_reason = f"override manual: {len(entities)} entidades"
    elif req.startup_context:
        routing = route_entities(
            industry=req.startup_context.industry,
            stage=req.startup_context.stage,
            geography=req.startup_context.geography,
        )
        entities = routing.entities
        routing_reason = routing.reason
    else:
        entities = []
        routing_reason = "sin contexto — búsqueda vectorial pura"

    # 2. Embedding con cache
    cached_vec = cache.get(req.query)
    if cached_vec is not None:
        embedding = cached_vec
    else:
        try:
            embedding = await asyncio.to_thread(rag.embed_text, req.query)
            cache.set(req.query, embedding)
        except Exception as exc:
            log.error("Error embeddeando query: %s", exc)
            raise HTTPException(status_code=503, detail=f"Error al generar embedding: {exc}")

    # 3. Búsqueda GraphRAG
    raw_nodes = await asyncio.to_thread(
        rag.search,
        client,
        embedding,
        entities,
        req.match_threshold,
        req.top_k,
    )

    # 4. Enriquecer con metadata
    enriched = await asyncio.to_thread(rag.enrich_nodes_with_metadata, client, raw_nodes)

    # 5. Ensamblar contexto
    context = rag.assemble_context(enriched)

    # 5b. Actividad en compras públicas (Licitus) — opcional, degrada a nada
    context = await _maybe_append_licitus(context, req.startup_context)

    node_results = [
        NodeResult(
            source_type=n.get("source_type", "VECTOR"),
            document_title=n["document_title"],
            category=n.get("category"),
            content=n["content"],
            relevance=round(float(n.get("relevance", 0)), 4),
            metadata=n.get("metadata"),
        )
        for n in enriched
    ]

    graph_hits = sum(1 for n in node_results if n.source_type == "GRAPH")
    vector_hits = sum(1 for n in node_results if n.source_type == "VECTOR")

    return QueryResponse(
        query=req.query,
        entities_activated=entities,
        routing_reason=routing_reason,
        nodes=node_results,
        context_for_llm=context,
        total_hits=len(node_results),
        graph_hits=graph_hits,
        vector_hits=vector_hits,
    )


# ── POST /query/moe ───────────────────────────────────────────────────────────

@app.post(
    "/query/moe",
    response_model=MoEQueryResponse,
    summary="RAG con Mixture of Experts — GatingNetwork de 2 etapas",
    tags=["rag"],
    dependencies=[Depends(require_api_key)],
)
async def query_moe_endpoint(
    req: MoEQueryRequest,
    background_tasks: BackgroundTasks,
) -> MoEQueryResponse:
    """
    Flujo MoE:

    1. **GatingNetwork**: keyword-scan → (semantic fallback si ambiguo) → context boost
    2. **Embed**: query → vector[1536] con cache LRU
    3. **GraphRAG**: search_hybrid_graphrag sobre el sub-grafo del Expert activo
    4. **Enriquecimiento** + ensamblado de contexto Markdown multi-experto
    5. **Audit log**: routing_reason persistido en moe_routing_log (background, non-blocking)

    El endpoint /query original permanece activo para backward compatibility.
    """
    client = get_db()

    # ── 1. GatingNetwork routing ──────────────────────────────────────────────
    if req.entity_override:
        entities = req.entity_override
        routing_method = "override"
        routing_reason = f"override manual: {len(entities)} entidades"
        expert_activations: list[ExpertActivation] = []
    else:
        ctx = req.startup_context
        # Radar Forense: inyectar señales activas en el GatingNetwork
        radar_ctx = signal_cache.get_active(client)

        moe_result = gating_network.route(
            query=req.query,
            industry=ctx.industry if ctx else None,
            stage=ctx.stage if ctx else None,
            geography=ctx.geography if ctx else "chile",
            top_n=req.max_experts,
            embedding_fn=rag.embed_text,
            radar_signals=radar_ctx if radar_ctx else None,
        )
        entities = moe_result.entities
        routing_method = moe_result.routing_method
        routing_reason = moe_result.routing_reason

        expert_activations = [
            ExpertActivation(
                expert_id=eid,
                expert_name=EXPERTS[eid].name,
                score=round(moe_result.expert_scores.get(eid, 0.0), 4),
                entities_contributed=len(EXPERTS[eid].entity_titles),
            )
            for eid in moe_result.experts_activated
            if eid in EXPERTS
        ]

    log.info(
        "[moe] routing_method=%s experts=%s reason=%s",
        routing_method,
        [e.expert_id for e in expert_activations],
        routing_reason[:200],
    )

    # ── 1b. Freshness check + background refresh ──────────────────────────────
    from api.data_freshness import (
        detect_sources_needed,
        build_freshness_dict,
        should_trigger_refresh,
    )
    from api.scheduler import _job_mp_sync

    data_freshness: dict[str, str] | None = None
    data_note: str | None = None

    sources_needed = detect_sources_needed(req.query)
    if sources_needed:
        freshness_map, stale_sources = build_freshness_dict(client, sources_needed)
        data_freshness = freshness_map if freshness_map else None

        if "mercado_publico" in stale_sources:
            age = freshness_map.get("mercado_publico", "desconocido")
            # El cooldown evita disparar el sync en cada consulta cuando la
            # fuente lleva mucho sin datos (ver REFRESH_COOLDOWN_S).
            if should_trigger_refresh("mercado_publico"):
                background_tasks.add_task(_job_mp_sync)
                data_note = f"Datos de Mercado Público actualizándose en background (última sync: {age})."
                log.info("[moe] Refresh Mercado Público disparado (stale >24h).")
            else:
                data_note = f"Datos de Mercado Público desactualizados (última sync: {age})."
                log.debug("[moe] Refresh Mercado Público omitido — en cooldown.")

    # ── 2. Embedding con cache LRU ────────────────────────────────────────────
    cached_vec = cache.get(req.query)
    if cached_vec is not None:
        embedding = cached_vec
    else:
        try:
            embedding = await asyncio.to_thread(rag.embed_text, req.query)
            cache.set(req.query, embedding)
        except Exception as exc:
            log.error("[moe] Error embeddeando query: %s", exc)
            raise HTTPException(status_code=503, detail=f"Error al generar embedding: {exc}")

    # ── 3. GraphRAG search ────────────────────────────────────────────────────
    raw_nodes = await asyncio.to_thread(
        rag.search,
        client,
        embedding,
        entities,
        req.match_threshold,
        req.top_k,
    )

    # ── 4. Enriquecer + ensamblar contexto ────────────────────────────────────
    enriched = await asyncio.to_thread(rag.enrich_nodes_with_metadata, client, raw_nodes)
    context = rag.assemble_context(enriched)

    # Actividad en compras públicas (Licitus) — opcional, degrada a nada
    context = await _maybe_append_licitus(context, req.startup_context)

    node_results = [
        NodeResult(
            source_type=n.get("source_type", "VECTOR"),
            document_title=n["document_title"],
            category=n.get("category"),
            content=n["content"],
            relevance=round(float(n.get("relevance", 0)), 4),
            metadata=n.get("metadata"),
        )
        for n in enriched
    ]

    graph_hits = sum(1 for n in node_results if n.source_type == "GRAPH")
    vector_hits = sum(1 for n in node_results if n.source_type == "VECTOR")

    # ── 5. Audit log (non-blocking) ───────────────────────────────────────────
    background_tasks.add_task(
        _log_moe_routing,
        client=client,
        query=req.query,
        routing_method=routing_method,
        routing_reason=routing_reason,
        experts_activated=[e.expert_id for e in expert_activations],
        graph_hits=graph_hits,
        vector_hits=vector_hits,
        total_hits=len(node_results),
    )

    return MoEQueryResponse(
        query=req.query,
        experts_activated=expert_activations,
        routing_method=routing_method,
        routing_reason=routing_reason,
        entities_activated=entities,
        nodes=node_results,
        context_for_llm=context,
        total_hits=len(node_results),
        graph_hits=graph_hits,
        vector_hits=vector_hits,
        data_freshness=data_freshness,
        data_note=data_note,
    )


@app.get(
    "/radar/signals",
    summary="Señales activas del Radar Forense",
    tags=["radar"],
)
async def radar_signals_endpoint() -> dict:
    """
    Retorna las señales de mercado actualmente en cache.
    Útil para monitoreo operacional sin necesidad de abrir Supabase Studio.
    No requiere autenticación — datos de mercado, no datos de usuario.
    """
    client = get_db()
    signals = signal_cache.get_active(client)
    return {
        "total": len(signals),
        "signals": [
            {
                "sector": s.sector,
                "signal_type": s.signal_type,
                "severity": s.severity,
                "headline": s.headline_preview[:100],
                "source": s.source,
                "classified_by": s.classified_by,
                "affects": s.affected_industries,
                "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            }
            for s in signals
        ],
    }


@app.patch(
    "/radar/signals/{signal_id}/rate",
    response_model=RateSignalResponse,
    summary="Califica una señal del Radar Forense (feedback de analista)",
    tags=["radar"],
    dependencies=[Depends(require_api_key)],
)
async def rate_signal_endpoint(
    signal_id: str,
    req: RateSignalRequest,
) -> RateSignalResponse:
    """
    Registra la evaluación de un analista sobre una señal del Radar Forense.

    Alimenta el pipeline de calidad del classifier:
    - Señales con `is_false_positive=True` se usan para ajustar pesos en classifier.py
    - La distribución de ratings por `classified_by` indica qué reglas generan más ruido
    - El campo `rated_by` permite filtrar feedback por analista en el Comité Beta

    Requiere que `migration_analyst_rating.sql` haya sido aplicado en Supabase.
    """
    from datetime import datetime, timezone

    client = get_db()
    now = datetime.now(timezone.utc).isoformat()

    update_payload: dict = {
        "analyst_rating": req.rating,
        "rated_at": now,
    }
    if req.is_false_positive is not None:
        update_payload["is_false_positive"] = req.is_false_positive
    if req.notes is not None:
        update_payload["analyst_notes"] = req.notes[:500]
    if req.rated_by is not None:
        update_payload["rated_by"] = req.rated_by[:100]

    try:
        result = (
            client.table("radar_signals")
            .update(update_payload)
            .eq("id", signal_id)
            .execute()
        )
    except Exception as exc:
        log.error("[rate] Error actualizando señal %s: %s", signal_id, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Error de base de datos: {exc}. ¿Se aplicó migration_analyst_rating.sql?",
        )

    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail=f"Señal '{signal_id}' no encontrada.")

    row = rows[0]
    return RateSignalResponse(
        id=str(row["id"]),
        analyst_rating=row["analyst_rating"],
        is_false_positive=row.get("is_false_positive"),
        rated_at=row.get("rated_at", now),
        rated_by=row.get("rated_by"),
    )


async def _log_moe_routing(
    *,
    client,
    query: str,
    routing_method: str,
    routing_reason: str,
    experts_activated: list[str],
    graph_hits: int,
    vector_hits: int,
    total_hits: int,
) -> None:
    """
    Persiste el routing del GatingNetwork en moe_routing_log para análisis
    de calidad y refinamiento de match_threshold por los analistas.

    Non-blocking: falla silenciosamente si la tabla no existe todavía
    (aplicar migración sprint_moe4.sql antes de mover tráfico a producción).
    """
    try:
        client.table("moe_routing_log").insert({
            "query_preview": query[:300],
            "routing_method": routing_method,
            "routing_reason": routing_reason,
            "experts_activated": experts_activated,
            "graph_hits": graph_hits,
            "vector_hits": vector_hits,
            "total_hits": total_hits,
        }).execute()
    except Exception as exc:
        log.debug("[moe] audit log skipped (tabla no existe aún): %s", exc)


# ── GET /entities ─────────────────────────────────────────────────────────────

@app.get(
    "/entities",
    response_model=EntitiesResponse,
    summary="Lista entidades disponibles en knowledge_nodes agrupadas por categoría",
    tags=["rag"],
)
async def list_entities() -> EntitiesResponse:
    client = get_db()
    result = (
        client.table("knowledge_nodes")
        .select("document_title, category, metadata, embedding")
        .execute()
    )
    rows = result.data or []

    by_category: dict[str, list[EntitySummary]] = {}
    for row in rows:
        cat = row.get("category") or "Sin categoría"
        meta = row.get("metadata") or {}
        summary = EntitySummary(
            document_title=row["document_title"],
            category=cat,
            has_embedding=row.get("embedding") is not None,
            latest_value=meta.get("ultimo_valor"),
            latest_date=meta.get("ultima_fecha"),
            unit=meta.get("unidad"),
        )
        by_category.setdefault(cat, []).append(summary)

    return EntitiesResponse(total=len(rows), by_category=by_category)


# ── GET /cache ────────────────────────────────────────────────────────────────

@app.get(
    "/cache",
    summary="Estadísticas del cache de embeddings",
    tags=["sistema"],
)
async def cache_stats() -> dict:
    return cache.stats()


# ── POST /ingest ──────────────────────────────────────────────────────────────

@app.post(
    "/ingest",
    response_model=IngestResponse,
    summary="Dispara ingesta FRED + yfinance en background",
    tags=["datos"],
    dependencies=[Depends(require_api_key)],
)
async def ingest_endpoint(background_tasks: BackgroundTasks) -> IngestResponse:
    background_tasks.add_task(_run_ingest_pipeline)
    return IngestResponse(
        status="started",
        message="Pipeline de ingesta iniciado en background. Usa GET /health para monitorear.",
    )


async def _run_ingest_pipeline() -> None:
    from src.db.supabase_client import (
        get_client, bulk_insert_nodes,
        fetch_nodes_pending_embedding, bulk_update_embeddings,
    )
    from src.extractors.fred import fetch_all as fred_fetch_all
    from src.extractors.yfinance_extractor import fetch_all as yf_fetch_all
    from src.embeddings.openai_embedder import embed_nodes

    WORKER_CATEGORIES = [
        "Macroeconomia", "Mercados", "Mercados Chile", "Mercados LATAM",
        "Commodities", "Forex Chile", "Riesgo", "Tasas USA",
    ]

    try:
        client = get_client()
        log.info("[ingest] Iniciando FRED...")
        fred_nodes = await asyncio.to_thread(fred_fetch_all)
        await asyncio.to_thread(bulk_insert_nodes, client, fred_nodes)
        log.info("[ingest] FRED OK: %d nodos", len(fred_nodes))

        log.info("[ingest] Iniciando yfinance...")
        try:
            yf_nodes = await asyncio.to_thread(yf_fetch_all)
            await asyncio.to_thread(bulk_insert_nodes, client, yf_nodes)
            log.info("[ingest] yfinance OK: %d nodos", len(yf_nodes))
        except Exception as exc:
            log.warning("[ingest] yfinance rate-limited: %s. Continuando...", exc)

        log.info("[ingest] Generando embeddings pendientes...")
        pending = await asyncio.to_thread(
            fetch_nodes_pending_embedding, client, None, WORKER_CATEGORIES
        )
        if pending:
            vectors = await asyncio.to_thread(embed_nodes, pending)
            updates = [{"id": n["id"], "embedding": v} for n, v in zip(pending, vectors)]
            await asyncio.to_thread(bulk_update_embeddings, client, updates)
            log.info("[ingest] %d embeddings actualizados.", len(updates))

        log.info("[ingest] Pipeline completado.")
    except Exception as exc:
        log.error("[ingest] Error en pipeline: %s", exc, exc_info=True)


# ── GET /ping — lightweight liveness check (sin queries a DB) ─────────────────

@app.get("/ping", tags=["sistema"], summary="Liveness probe ligero")
async def ping_endpoint():
    import time
    from api.scheduler import scheduler  # noqa: PLC0415
    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - _start_time),
        "scheduler_running": scheduler.running,
    }


# ── GET /health ───────────────────────────────────────────────────────────────

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Estado del sistema BralidusPY",
    tags=["sistema"],
)
async def health_endpoint() -> HealthResponse:
    services: list[ServiceStatus] = []
    client = get_db()
    nodes_total = 0
    nodes_with_embedding = 0

    # Supabase — count-only queries (no traer embeddings por la red)
    try:
        nodes_result = (
            client.table("knowledge_nodes")
            .select("id", count="exact")
            .execute()
        )
        nodes_total = nodes_result.count or 0
        emb_result = (
            client.table("knowledge_nodes")
            .select("id", count="exact")
            .not_.is_("embedding", "null")
            .execute()
        )
        nodes_with_embedding = emb_result.count or 0
        edges_result = (
            client.table("knowledge_edges")
            .select("id", count="exact")
            .execute()
        )
        edge_count = edges_result.count or 0
        services.append(
            ServiceStatus(
                name="supabase",
                ok=True,
                detail=f"{nodes_total} nodos, {edge_count} aristas",
            )
        )
    except Exception as exc:
        services.append(ServiceStatus(name="supabase", ok=False, detail=str(exc)))

    # OpenAI
    try:
        from src.config import OPENAI_API_KEY
        services.append(
            ServiceStatus(
                name="openai",
                ok=bool(OPENAI_API_KEY),
                detail="key configurada" if OPENAI_API_KEY else "key faltante",
            )
        )
    except Exception as exc:
        services.append(ServiceStatus(name="openai", ok=False, detail=str(exc)))

    # FRED
    try:
        from src.config import FRED_API_KEY
        services.append(
            ServiceStatus(
                name="fred",
                ok=bool(FRED_API_KEY),
                detail="key configurada" if FRED_API_KEY else "key faltante",
            )
        )
    except Exception as exc:
        services.append(ServiceStatus(name="fred", ok=False, detail=str(exc)))

    # Licitus (integración opcional — deshabilitada NO cuenta como fallo)
    try:
        from src.clients.licitus_client import licitus
        if not licitus.is_enabled():
            services.append(ServiceStatus(name="licitus", ok=True, detail="deshabilitada (sin BASE_URL)"))
        else:
            reachable = licitus.health()
            services.append(
                ServiceStatus(
                    name="licitus",
                    ok=reachable,
                    detail="alcanzable" if reachable else "configurada pero no responde",
                )
            )
    except Exception as exc:
        services.append(ServiceStatus(name="licitus", ok=False, detail=str(exc)))

    # Cache
    c_stats = cache.stats()
    services.append(
        ServiceStatus(
            name="cache",
            ok=True,
            detail=f"{c_stats['entries']} entradas, hit_rate={c_stats['hit_rate']}",
        )
    )

    # Scheduler + job health
    try:
        from api.scheduler import scheduler
        from api.health_monitor import job_health
        jobs = scheduler.get_jobs()
        # `scheduler.running` es False A PROPOSITO en serverless: el lifespan no
        # levanta APScheduler y los jobs los dispara un cron externo contra
        # /jobs/*. Reportarlo como ok=False marcaba el health en rojo de forma
        # permanente por un estado que es el esperado — una alarma que suena
        # siempre es una alarma que nadie mira. Lo que importa es que los jobs
        # esten registrados; su salud real la reportan las lineas `job:*`.
        services.append(
            ServiceStatus(
                name="scheduler",
                ok=len(jobs) > 0,
                detail=(
                    f"{len(jobs)} jobs registrados, disparados por cron externo"
                    if not scheduler.running
                    else f"{len(jobs)} jobs activos (APScheduler en proceso)"
                ),
            )
        )
        for job_id, state in job_health.status().items():
            healthy = state["healthy"]
            streak = state["consecutive_empty"]
            last_ok = state["last_success"] or "nunca"
            services.append(
                ServiceStatus(
                    name=f"job:{job_id}",
                    ok=healthy,
                    detail=(
                        f"runs={state['total_runs']} results={state['total_results']} "
                        f"last_ok={last_ok}"
                        + (f" [ALERTA: {streak} corridas vacías]" if not healthy else "")
                    ),
                )
            )
    except Exception as exc:
        services.append(ServiceStatus(name="scheduler", ok=False, detail=str(exc)))

    core_names = {"supabase", "openai", "fred", "cache"}
    core_ok = all(s.ok for s in services if s.name in core_names)
    status = "ok" if core_ok else ("degraded" if any(s.ok for s in services) else "error")

    return HealthResponse(
        status=status,
        services=services,
        knowledge_nodes_count=nodes_total,
        nodes_with_embedding=nodes_with_embedding,
    )
