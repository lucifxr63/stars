-- ============================================================
-- migration_vector_search_rpc.sql
-- Estabilización Fase 1 — reemplaza el fallback Python en memoria
-- por búsqueda vectorial nativa con el operador <=> de pgvector.
--
-- Aplicar en Supabase SQL Editor UNA SOLA VEZ.
-- Verifica que la extensión vector esté activa:
--   SELECT * FROM pg_extension WHERE extname = 'vector';
-- ============================================================

-- Función: vector_search_direct
-- Reemplaza _vector_search_direct() en api/rag.py.
-- Usa cosine distance nativa (operador <=>) — O(log n) con índice HNSW.
-- El índice ya existe si search_hybrid_graphrag funciona correctamente.
-- ============================================================

CREATE OR REPLACE FUNCTION vector_search_direct(
  query_embedding  vector(1536),
  match_count      int     DEFAULT 6,
  match_threshold  float   DEFAULT 0.30
)
RETURNS TABLE (
  document_title   text,
  content          text,
  category         text,
  metadata         jsonb,
  relevance        float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    document_title,
    content,
    category,
    metadata,
    (1 - (embedding <=> query_embedding))::float  AS relevance
  FROM knowledge_nodes
  WHERE
    embedding IS NOT NULL
    AND (1 - (embedding <=> query_embedding)) > match_threshold
  ORDER BY
    embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Verificar que la función existe:
-- SELECT proname FROM pg_proc WHERE proname = 'vector_search_direct';
