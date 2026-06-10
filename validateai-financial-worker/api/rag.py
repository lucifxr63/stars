"""
rag.py — Capa de consulta GraphRAG.

Flujo:
  1. embed_text()  → vector[1536] para el texto de la query
  2. search()      → llama a search_hybrid_graphrag RPC con el embedding + entidades
  3. assemble()    → formatea los nodos en contexto Markdown para el LLM
"""
from __future__ import annotations
import logging
from supabase import Client

log = logging.getLogger(__name__)


def embed_text(text: str) -> list[float]:
    """Embeddea un texto arbitrario usando el mismo pipeline que los nodos."""
    from src.embeddings.openai_embedder import embed_nodes

    node = {"document_title": text, "content": text, "metadata": {}}
    return embed_nodes([node])[0]


def search(
    client: Client,
    query_embedding: list[float],
    extracted_entities: list[str],
    match_threshold: float = 0.40,
    match_count: int = 6,
) -> list[dict]:
    """
    Llama al RPC search_hybrid_graphrag.

    El RPC hace dos pasos:
      GRAPH: busca nodos conectados a extracted_entities via knowledge_edges
      VECTOR: fallback por similitud coseno donde relevance > match_threshold

    Retorna lista de {source_type, document_title, content, relevance}.

    Si el RPC falla o devuelve 0 resultados con entities activadas,
    ejecuta búsqueda vectorial directa en Python (bypass RPC).
    """
    try:
        result = client.rpc(
            "search_hybrid_graphrag",
            {
                "query_embedding": query_embedding,
                "extracted_entities": extracted_entities,
                "match_threshold": match_threshold,
                "match_count": match_count,
            },
        ).execute()
        nodes = result.data or []
        if nodes:
            return nodes
        # RPC devolvió vacío — probablemente sin edges. Usar vector search directo.
        log.info("RPC retornó 0 nodos. Usando vector search directo.")
    except Exception as exc:
        log.warning("RPC search_hybrid_graphrag falló (%s). Usando vector search directo.", exc)

    return _vector_search_direct(client, query_embedding, match_count)


def _parse_embedding(raw: object) -> list[float] | None:
    """
    Supabase devuelve el campo vector(1536) como string PostgreSQL:
    '[-0.01096344,0.024002075,...]'
    Parsea a list[float]. Acepta también list[float] si ya viene convertido.
    """
    if raw is None:
        return None
    if isinstance(raw, list):
        return [float(x) for x in raw]
    if isinstance(raw, str):
        stripped = raw.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            return [float(x) for x in stripped[1:-1].split(",")]
    return None


def _vector_search_direct(
    client: Client, query_embedding: list[float], limit: int
) -> list[dict]:
    """
    Fallback vectorial cuando search_hybrid_graphrag retorna 0 resultados.

    Usa la función RPC vector_search_direct (pgvector nativo, O(log n) con HNSW).
    Requiere aplicar scripts/migration_vector_search_rpc.sql en Supabase.

    Si el RPC no existe aún (migration pendiente), cae al scan en memoria
    con un guardia de tamaño para evitar OOM en grafos grandes.
    """
    # ── Path 1: RPC pgvector nativo (post-migration) ──────────────────────────
    try:
        result = client.rpc(
            "vector_search_direct",
            {
                "query_embedding": query_embedding,
                "match_count": limit,
                "match_threshold": 0.30,
            },
        ).execute()
        nodes = result.data or []
        if nodes:
            return [
                {
                    "source_type": "VECTOR",
                    "document_title": n["document_title"],
                    "content": n["content"],
                    "relevance": round(float(n.get("relevance", 0)), 4),
                    "category": n.get("category"),
                    "metadata": n.get("metadata"),
                }
                for n in nodes
            ]
    except Exception as exc:
        log.warning(
            "RPC vector_search_direct no disponible (%s). "
            "Aplicar scripts/migration_vector_search_rpc.sql en Supabase. "
            "Usando scan en memoria como emergencia.",
            exc,
        )

    # ── Path 2: Scan en memoria — solo si KG está bajo el umbral seguro ───────
    return _vector_search_in_memory(client, query_embedding, limit)


def _vector_search_in_memory(
    client: Client, query_embedding: list[float], limit: int
) -> list[dict]:
    """
    Scan en memoria: fallback de emergencia solo para KG < 2000 nodos.
    Deprecated — eliminar tras confirmar que vector_search_direct RPC funciona.
    """
    import numpy as np

    NODE_LIMIT_SAFE = 2000

    result = (
        client.table("knowledge_nodes")
        .select("document_title, content, category, metadata, embedding")
        .limit(NODE_LIMIT_SAFE + 1)
        .execute()
    )
    rows = result.data or []

    if len(rows) > NODE_LIMIT_SAFE:
        log.error(
            "KG superó %d nodos (%d total). Scan en memoria no seguro. "
            "Aplicar migration_vector_search_rpc.sql URGENTE.",
            NODE_LIMIT_SAFE, len(rows),
        )
        rows = rows[:NODE_LIMIT_SAFE]

    if not rows:
        return []

    q = np.array(query_embedding, dtype=np.float32)
    q_norm = q / (np.linalg.norm(q) + 1e-10)

    scored: list[tuple[float, dict]] = []
    for row in rows:
        vec = _parse_embedding(row.get("embedding"))
        if vec is None:
            continue
        v = np.array(vec, dtype=np.float32)
        v_norm = v / (np.linalg.norm(v) + 1e-10)
        scored.append((float(np.dot(q_norm, v_norm)), row))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {
            "source_type": "VECTOR",
            "document_title": row["document_title"],
            "content": row["content"],
            "relevance": round(score, 4),
            "category": row.get("category"),
            "metadata": row.get("metadata"),
        }
        for score, row in scored[:limit]
    ]


def enrich_nodes_with_metadata(
    client: Client, nodes: list[dict]
) -> list[dict]:
    """
    El RPC solo devuelve source_type, document_title, content, relevance.
    Este paso añade category + metadata consultando knowledge_nodes por título.
    """
    if not nodes:
        return []

    titles = list({n["document_title"] for n in nodes})
    result = (
        client.table("knowledge_nodes")
        .select("document_title, category, metadata")
        .in_("document_title", titles)
        .execute()
    )
    meta_map: dict[str, dict] = {
        r["document_title"]: r for r in (result.data or [])
    }

    enriched = []
    for node in nodes:
        extra = meta_map.get(node["document_title"], {})
        enriched.append({
            **node,
            "category": extra.get("category"),
            "metadata": extra.get("metadata"),
        })
    return enriched


def assemble_context(nodes: list[dict]) -> str:
    """
    Convierte los nodos GraphRAG en un bloque Markdown listo para
    inyectar como contexto en un prompt de LLM.

    Formato:
      ### [Título] (Categoría) [GRAPH|VECTOR]
      Contenido semántico del nodo.
      _Último valor: X unidad (fecha)_
    """
    if not nodes:
        return "_No se encontraron nodos relevantes para este contexto._"

    parts: list[str] = ["## Contexto Macroeconómico y de Mercado\n"]

    for node in nodes:
        meta = node.get("metadata") or {}
        latest = meta.get("ultimo_valor")
        unit = meta.get("unidad", "")
        date_raw = meta.get("ultima_fecha", "")
        date = date_raw[:7] if date_raw else "N/A"
        source = node.get("source_type", "VECTOR")
        category = node.get("category") or "Macro"

        header = f"### {node['document_title']} [{source}] — {category}"
        value_line = (
            f"_Último valor: **{latest} {unit}** ({date})_"
            if latest is not None
            else "_Datos en proceso de actualización._"
        )

        parts.append(f"{header}\n{node['content']}\n{value_line}")

    return "\n\n".join(parts)
