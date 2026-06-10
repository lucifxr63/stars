"""Pydantic models for BralidusPY API request/response."""
from __future__ import annotations
from typing import Literal, Any
from pydantic import BaseModel, Field


# ── Startup context ───────────────────────────────────────────────────────────

class StartupContext(BaseModel):
    """
    Perfil de la startup que determina qué entidades macro son relevantes.
    Cuantos más campos se provean, más preciso es el routing de entidades.
    """
    industry: str = Field(
        ...,
        description="Industria: fintech, saas, agro, mineria, exportacion, etc.",
        examples=["fintech", "agro", "saas", "exportacion"],
    )
    stage: Literal["pre_seed", "seed", "series_a", "growth", "ipo"] | None = Field(
        None,
        description="Etapa de la startup — afecta qué indicadores de riesgo/capital se activan.",
    )
    geography: str = Field(
        "chile",
        description="Mercado principal: chile, latam, usa. Controla qué ETFs/forex se incluyen.",
    )
    revenue_model: str | None = Field(
        None,
        description="Modelo de negocio (B2B, B2C, marketplace). Informativo — no afecta routing.",
    )


# ── Query endpoint ────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=5,
        description="Pregunta o contexto de la validación. Se embeddea para búsqueda vectorial.",
        examples=["¿Cómo afecta la tasa de la Fed a startups de crédito en Chile?"],
    )
    startup_context: StartupContext | None = Field(
        None,
        description="Si se provee, activa el routing dinámico de entidades. Sin contexto, usa solo vector search.",
    )
    top_k: int = Field(6, ge=1, le=50, description="Máximo de nodos a retornar del GraphRAG.")
    match_threshold: float = Field(
        0.40,
        ge=0.0,
        le=1.0,
        description="Umbral mínimo de similitud coseno para matches vectoriales (0.40 = permisivo, 0.75 = estricto).",
    )
    entity_override: list[str] | None = Field(
        None,
        description="Sobreescribe el routing: usa estos document_titles directamente.",
    )


class NodeResult(BaseModel):
    source_type: str = Field(..., description="GRAPH (desde aristas) o VECTOR (similitud coseno).")
    document_title: str
    category: str | None = None
    content: str
    relevance: float
    metadata: dict[str, Any] | None = None


class QueryResponse(BaseModel):
    query: str
    entities_activated: list[str] = Field(
        ..., description="Document titles usados como entidades del grafo."
    )
    routing_reason: str = Field(
        ..., description="Explicación del routing: industria → categorías → entidades."
    )
    nodes: list[NodeResult]
    context_for_llm: str = Field(
        ...,
        description="Contexto pre-ensamblado listo para inyectar en un prompt de LLM.",
    )
    total_hits: int
    graph_hits: int
    vector_hits: int


# ── Entities endpoint ─────────────────────────────────────────────────────────

class EntitySummary(BaseModel):
    document_title: str
    category: str
    has_embedding: bool
    latest_value: float | None = None
    latest_date: str | None = None
    unit: str | None = None


class EntitiesResponse(BaseModel):
    total: int
    by_category: dict[str, list[EntitySummary]]


# ── Ingest endpoint ───────────────────────────────────────────────────────────

class IngestResponse(BaseModel):
    status: Literal["started", "error"]
    message: str


# ── Health endpoint ───────────────────────────────────────────────────────────

class ServiceStatus(BaseModel):
    name: str
    ok: bool
    detail: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "error"]
    services: list[ServiceStatus]
    knowledge_nodes_count: int
    nodes_with_embedding: int
