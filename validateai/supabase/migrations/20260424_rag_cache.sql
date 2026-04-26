-- ============================================================
-- ValidateAI — RAG (competidores) + caché de análisis
-- Requiere la extensión pgvector (habilitada en Supabase por defecto en proyectos nuevos).
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Habilitar pgvector
create extension if not exists vector;

-- ============================================================
-- TABLA: competitors (base vectorial para RAG)
-- ============================================================
create table if not exists competitors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  url         text,
  description text,
  market      text,
  pricing     text,
  strengths   text[],
  weaknesses  text[],
  industries  text[],   -- ej: ['saas', 'validacion', 'emprendimiento']
  geography   text[],   -- ej: ['global', 'latam', 'chile']
  embedding   vector(1536),  -- text-embedding-3-small de OpenAI
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists competitors_embedding_idx
  on competitors using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Función: búsqueda semántica de competidores
create or replace function search_competitors(
  query_embedding vector(1536),
  match_threshold float  default 0.65,
  match_count     int    default 6
)
returns table (
  id          uuid,
  name        text,
  url         text,
  description text,
  market      text,
  pricing     text,
  strengths   text[],
  weaknesses  text[],
  similarity  float
)
language sql stable
as $$
  select
    id, name, url, description, market, pricing,
    strengths, weaknesses,
    1 - (embedding <=> query_embedding) as similarity
  from competitors
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- TABLA: cached_analyses (caché semántico de reportes similares)
-- ============================================================
create table if not exists cached_analyses (
  id            uuid primary key default gen_random_uuid(),
  idea_embedding vector(1536),
  prompt_type   text,         -- ej: 'summary' | 'risk_analysis'
  analysis_data jsonb,        -- el reporte completo
  industry      text,
  geography     text,
  usage_count   int default 1,
  created_at    timestamptz default now(),
  expires_at    timestamptz default now() + interval '30 days'
);

create index if not exists cached_analyses_embedding_idx
  on cached_analyses using ivfflat (idea_embedding vector_cosine_ops)
  with (lists = 50);

-- Función: búsqueda de análisis cacheados
create or replace function search_cached_analyses(
  query_embedding vector(1536),
  match_threshold float  default 0.92,
  match_count     int    default 1,
  filter_type     text   default null
)
returns table (
  id            uuid,
  analysis_data jsonb,
  similarity    float
)
language sql stable
as $$
  select
    id,
    analysis_data,
    1 - (idea_embedding <=> query_embedding) as similarity
  from cached_analyses
  where
    expires_at > now()
    and 1 - (idea_embedding <=> query_embedding) > match_threshold
    and (filter_type is null or prompt_type = filter_type)
  order by idea_embedding <=> query_embedding
  limit match_count;
$$;

-- Incrementa usage_count cuando se sirve un hit de caché
create or replace function increment_cache_usage(cache_id uuid)
returns void
language sql
as $$
  update cached_analyses set usage_count = usage_count + 1 where id = cache_id;
$$;
