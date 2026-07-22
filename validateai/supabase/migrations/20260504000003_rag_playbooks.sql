-- RAG Playbooks: curated knowledge base for AI context injection
-- Embeddings: text-embedding-3-small (1536 dimensions) via OpenAI
-- Seed with: npx tsx scripts/seedRagPlaybooks.ts

create table if not exists rag_playbooks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source_file text not null unique,
  content     text not null,
  tags        text[] not null default '{}',
  embedding   vector(1536),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- IVFFlat index for fast cosine similarity search
create index if not exists rag_playbooks_embedding_idx
  on rag_playbooks using ivfflat (embedding vector_cosine_ops)
  with (lists = 20);

-- GIN index for fast tag filtering before vector search
create index if not exists rag_playbooks_tags_idx
  on rag_playbooks using gin (tags);

-- RLS: service_role writes, anyone can read (used by edge functions via service key)
alter table rag_playbooks enable row level security;

create policy "public read rag_playbooks"
  on rag_playbooks for select using (true);

create policy "service role write rag_playbooks"
  on rag_playbooks for all using (auth.role() = 'service_role');

-- Semantic search function with optional tag pre-filter
create or replace function search_rag_playbooks(
  query_embedding vector(1536),
  filter_tags     text[]    default null,
  match_threshold float     default 0.60,
  match_count     int       default 5
)
returns table (
  id         uuid,
  title      text,
  content    text,
  tags       text[],
  similarity float
)
language sql stable as $$
  select
    p.id,
    p.title,
    p.content,
    p.tags,
    1 - (p.embedding <=> query_embedding) as similarity
  from rag_playbooks p
  where
    (filter_tags is null or p.tags && filter_tags)
    and 1 - (p.embedding <=> query_embedding) > match_threshold
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
