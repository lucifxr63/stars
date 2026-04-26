-- Enable pgvector extension
create extension if not exists vector;

-- Competitors table for RAG
create table if not exists competitors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  url         text,
  description text,
  market      text,
  pricing     text,
  strengths   text[],
  weaknesses  text[],
  industries  text[],  -- e.g. ['saas', 'validacion', 'emprendimiento']
  geography   text[],  -- e.g. ['global', 'latam', 'chile']
  embedding   vector(1536),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Semantic search index (requires at least 1 row to build)
create index if not exists competitors_embedding_idx
  on competitors using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Semantic search function
create or replace function search_competitors(
  query_embedding vector(1536),
  match_threshold float default 0.65,
  match_count     int   default 6
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
    id, name, url, description, market, pricing, strengths, weaknesses,
    1 - (embedding <=> query_embedding) as similarity
  from competitors
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- RLS: allow service role full access, authenticated read
alter table competitors enable row level security;
create policy "service_full"  on competitors for all using (true) with check (true);
create policy "auth_read"     on competitors for select using (auth.role() = 'authenticated');
