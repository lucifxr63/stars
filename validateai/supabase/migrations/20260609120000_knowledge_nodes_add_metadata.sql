-- Agrega columna metadata JSONB a knowledge_nodes para el Financial Worker.
-- Permite almacenar arrays de observaciones temporales (FRED, yfinance) de forma
-- estructurada sin contaminar el campo content (reservado para embeddings RAG).
--
-- El constraint unique_node_identity(document_title, header_path) ya existía
-- desde la migración 20260523_graphrag_schema.sql — lo reutilizamos para upsert
-- idempotente en re-ejecuciones del worker sin migración adicional.

ALTER TABLE public.knowledge_nodes
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}' NOT NULL;

-- Índice GIN para queries eficientes sobre claves JSONB (ej. metadata->>'series_id')
CREATE INDEX IF NOT EXISTS idx_kn_metadata
  ON public.knowledge_nodes USING gin(metadata);
