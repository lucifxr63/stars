-- Habilitar pgvector para matching semántico de mentores
CREATE EXTENSION IF NOT EXISTS vector;

-- Columna de embedding para mentores (OpenAI text-embedding-3-small = 1536 dims)
ALTER TABLE mentors ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Índice HNSW para búsqueda aproximada de vecinos más cercanos (mucho más rápido que ivfflat en tablas pequeñas)
CREATE INDEX IF NOT EXISTS idx_mentors_embedding
  ON mentors USING hnsw (embedding vector_cosine_ops);

-- RPC que calcula similitud coseno y filtra por threshold
CREATE OR REPLACE FUNCTION match_mentors(
  query_embedding  vector(1536),
  match_threshold  float   DEFAULT 0.60,
  match_count      int     DEFAULT 3
)
RETURNS TABLE (
  id                  uuid,
  name                text,
  bio                 text,
  expertise           text[],
  linkedin_url        text,
  calendly_url        text,
  availability        text,
  session_price_clp   int,
  languages           text[],
  photo_url           text,
  similarity          float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, name, bio, expertise, linkedin_url, calendly_url,
    availability, session_price_clp, languages, photo_url,
    1 - (embedding <=> query_embedding) AS similarity
  FROM mentors
  WHERE embedding IS NOT NULL
    AND availability = 'available'
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
