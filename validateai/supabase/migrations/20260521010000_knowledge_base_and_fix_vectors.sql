-- ============================================================
-- S2: Knowledge Base (Corpus Piloto) + fix tenant_vectors a 1536d
-- ============================================================

-- Tabla pública de conocimiento compartido (Ley Fintec, CMF, GTM, etc.)
-- Usada por el endpoint /api/v1/rag/query como fuente primaria de recuperación.
create table if not exists public.knowledge_base (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  source       text        not null,          -- ej: "Ley 21.521 Art. 3", "CMF NCG 502"
  category     text        not null,          -- 'regulatory' | 'gtm' | 'methodology' | 'market'
  content      text        not null,
  tags         text[]      not null default '{}',
  embedding    vector(1536),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- HNSW index para búsqueda coseno rápida
create index if not exists knowledge_base_embedding_idx
  on public.knowledge_base
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- GIN index para filtro por tags antes del vector search
create index if not exists knowledge_base_tags_idx
  on public.knowledge_base using gin (tags);

-- Índice para filtro por categoría
create index if not exists knowledge_base_category_idx
  on public.knowledge_base (category);

-- RLS: servicio escribe, cualquiera lee (edge functions usan service role)
alter table public.knowledge_base enable row level security;

create policy "public_read_knowledge_base"
  on public.knowledge_base for select using (true);

create policy "service_write_knowledge_base"
  on public.knowledge_base for all using (auth.role() = 'service_role');

-- RPC: búsqueda semántica con filtros opcionales de categoría y tags
create or replace function public.search_knowledge_base(
  query_embedding  vector(1536),
  filter_category  text      default null,
  filter_tags      text[]    default null,
  match_threshold  float     default 0.50,
  match_count      int       default 6
)
returns table (
  id          uuid,
  title       text,
  source      text,
  category    text,
  content     text,
  tags        text[],
  similarity  float
)
language sql stable as $$
  select
    kb.id,
    kb.title,
    kb.source,
    kb.category,
    kb.content,
    kb.tags,
    1 - (kb.embedding <=> query_embedding) as similarity
  from public.knowledge_base kb
  where kb.embedding is not null
    and (filter_category is null or kb.category = filter_category)
    and (filter_tags is null or kb.tags && filter_tags)
    and 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- Fix tenant_vectors: 512d → 1536d (tabla vacía, safe to recreate)
-- ============================================================
drop table if exists public.tenant_vectors cascade;

create table public.tenant_vectors (
  id               uuid        primary key default gen_random_uuid(),
  profile_id       uuid        not null references public.profiles(id) on delete cascade,
  api_key_id       uuid        not null references public.api_keys(id) on delete cascade,
  content          text        not null,
  metadata         jsonb       default '{}'::jsonb,
  embedding_version text       not null default 'oai-v3-small-1536',
  embedding        vector(1536) not null,
  created_at       timestamptz default now()
);

alter table public.tenant_vectors enable row level security;

create policy "users_view_own_tenant_vectors"
  on public.tenant_vectors for select using (auth.uid() = profile_id);

create policy "users_insert_own_tenant_vectors"
  on public.tenant_vectors for insert with check (auth.uid() = profile_id);

create policy "users_delete_own_tenant_vectors"
  on public.tenant_vectors for delete using (auth.uid() = profile_id);

create index on public.tenant_vectors
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index idx_tenant_vectors_profile_version
  on public.tenant_vectors (profile_id, embedding_version);

-- RPC: búsqueda semántica por tenant (1536d)
create or replace function public.search_tenant_vectors(
  query_embedding    vector(1536),
  target_profile_id  uuid,
  target_version     text    default 'oai-v3-small-1536',
  match_threshold    float   default 0.50,
  match_count        int     default 5
)
returns table (
  id          uuid,
  content     text,
  metadata    jsonb,
  similarity  float
)
language plpgsql stable as $$
begin
  return query
  select
    tv.id,
    tv.content,
    tv.metadata,
    1 - (tv.embedding <=> query_embedding) as similarity
  from public.tenant_vectors tv
  where tv.profile_id = target_profile_id
    and tv.embedding_version = target_version
    and 1 - (tv.embedding <=> query_embedding) > match_threshold
  order by tv.embedding <=> query_embedding
  limit match_count;
end;
$$;
