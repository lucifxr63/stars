-- ============================================================
-- Épica 3: Ingesta y Vectorización (Knowledge Feeding)
-- Tabla para aislar los vectores de cada desarrollador/tenant
-- ============================================================

-- Asegurar que la extensión pgvector está habilitada
create extension if not exists vector;

create table public.tenant_vectors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  
  content text not null,
  metadata jsonb default '{}'::jsonb,
  
  -- Versionamiento para soportar múltiples modelos en el futuro
  embedding_version text not null default 'oai-v3-small-512',
  
  -- Embeddings comprimidos (Matryoshka Representation Learning a 512d)
  embedding vector(512) not null,
  
  created_at timestamptz default now()
);

-- ============================================
-- RLS POLICIES
-- ============================================
alter table public.tenant_vectors enable row level security;

-- Los usuarios (y sus llaves API) solo pueden ver y modificar sus propios vectores
create policy "Users can view own tenant vectors"
  on public.tenant_vectors for select
  using (auth.uid() = profile_id);

create policy "Users can insert own tenant vectors"
  on public.tenant_vectors for insert
  with check (auth.uid() = profile_id);

create policy "Users can update own tenant vectors"
  on public.tenant_vectors for update
  using (auth.uid() = profile_id);

create policy "Users can delete own tenant vectors"
  on public.tenant_vectors for delete
  using (auth.uid() = profile_id);

-- Para inserciones desde Edge Functions usando Service Role, el RLS es bypassed automáticamente.

-- ============================================
-- ÍNDICES VECTORIALES
-- ============================================
-- Usamos HNSW optimizado para distancia coseno
create index on public.tenant_vectors using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Índice compuesto para acelerar el filtrado por tenant y versión
create index idx_tenant_vectors_profile_version 
  on public.tenant_vectors(profile_id, embedding_version);

-- ============================================
-- RPC: BÚSQUEDA SEMÁNTICA POR TENANT
-- ============================================
create or replace function public.search_tenant_vectors(
  query_embedding vector(512),
  target_profile_id uuid,
  target_version text default 'oai-v3-small-512',
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql stable
as $$
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
