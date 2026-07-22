-- Cached analyses table (requires pgvector from migration 001)
create table if not exists cached_analyses (
  id             uuid primary key default gen_random_uuid(),
  idea_embedding vector(1536),
  idea_hash      text,
  industry       text,
  geography      text,
  prompt_type    text not null,
  analysis_data  jsonb not null,
  usage_count    int default 1,
  created_at     timestamptz default now(),
  expires_at     timestamptz default now() + interval '30 days'
);

create index if not exists cached_analyses_embedding_idx
  on cached_analyses using ivfflat (idea_embedding vector_cosine_ops)
  with (lists = 50);

create index if not exists cached_analyses_expires_idx
  on cached_analyses (expires_at);

-- Auto-increment usage_count and refresh expiry when hit
create or replace function increment_cache_usage()
returns trigger language plpgsql as $$
begin
  update cached_analyses
     set usage_count = usage_count + 1,
         expires_at  = now() + interval '30 days'
   where id = new.id;
  return new;
end;
$$;

-- Semantic search for cached analyses
create or replace function search_cached_analyses(
  query_embedding vector(1536),
  match_threshold float default 0.92,
  match_count     int   default 1,
  filter_type     text  default null
)
returns table (
  id            uuid,
  analysis_data jsonb,
  similarity    float
)
language sql stable
as $$
  select
    id, analysis_data,
    1 - (idea_embedding <=> query_embedding) as similarity
  from cached_analyses
  where
    expires_at > now()
    and 1 - (idea_embedding <=> query_embedding) > match_threshold
    and (filter_type is null or prompt_type = filter_type)
  order by idea_embedding <=> query_embedding
  limit match_count;
$$;

alter table cached_analyses enable row level security;
create policy "service_full" on cached_analyses for all using (true) with check (true);
