-- ============================================================
-- ValidateAI — Migración: Elevar umbrales RAG a 0.75
-- Objetivo: reducir ruido semántico y alucinaciones en LLM
-- Afecta: search_rag_playbooks, search_knowledge_base
-- ============================================================

-- 1. search_rag_playbooks: default 0.60 → 0.75
create or replace function search_rag_playbooks(
  query_embedding vector(1536),
  filter_tags     text[]    default null,
  match_threshold float     default 0.75,
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

-- 2. search_knowledge_base: default 0.50 → 0.75
create or replace function public.search_knowledge_base(
  query_embedding  vector(1536),
  filter_category  text      default null,
  filter_tags      text[]    default null,
  match_threshold  float     default 0.75,
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
