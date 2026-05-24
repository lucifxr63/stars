-- ============================================================
-- ValidateAI — Sprint 3: Arquitectura GraphRAG
-- knowledge_nodes + knowledge_edges + search_hybrid_graphrag
-- ============================================================

-- 1. TABLA DE NODOS
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  document_title text        NOT NULL,
  header_path   text         NOT NULL DEFAULT 'Introduccion',
  content       text         NOT NULL,
  category      text,
  tags          text[]       DEFAULT '{}',
  embedding     vector(1536),
  created_at    timestamptz  DEFAULT now(),
  updated_at    timestamptz  DEFAULT now(),
  CONSTRAINT unique_node_identity UNIQUE (document_title, header_path)
);

CREATE INDEX IF NOT EXISTS idx_kn_document_title
  ON public.knowledge_nodes(document_title);
CREATE INDEX IF NOT EXISTS idx_kn_category
  ON public.knowledge_nodes(category);
-- HNSW funciona bien en datasets pequeños sin requerir training mínimo
CREATE INDEX IF NOT EXISTS idx_kn_embedding
  ON public.knowledge_nodes USING hnsw (embedding vector_cosine_ops);

-- 2. TABLA DE ARISTAS (referencia soft — sin FK para permitir títulos duplicados)
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  source_title  text         NOT NULL,
  target_title  text         NOT NULL,
  relation_type text         NOT NULL DEFAULT 'MENTIONS',
  created_at    timestamptz  DEFAULT now(),
  CONSTRAINT unique_edge UNIQUE (source_title, target_title, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_ke_source ON public.knowledge_edges(source_title);
CREATE INDEX IF NOT EXISTS idx_ke_target ON public.knowledge_edges(target_title);

-- 3. FUNCIÓN RPC: Motor de Búsqueda Híbrida (Grafo + Vector)
CREATE OR REPLACE FUNCTION search_hybrid_graphrag(
  query_embedding    vector(1536),
  extracted_entities text[],
  match_threshold    float DEFAULT 0.75,
  match_count        int   DEFAULT 6
)
RETURNS TABLE (
  source_type    text,
  document_title text,
  content        text,
  relevance      float
)
LANGUAGE sql STABLE
AS $$
  WITH graph_matches AS (
    -- Travesía del grafo: nodos enlazados a las entidades extraídas
    SELECT DISTINCT
      kn.document_title,
      kn.content,
      1.0::float AS relevance
    FROM public.knowledge_nodes kn
    INNER JOIN public.knowledge_edges ke
      ON kn.document_title = ke.target_title
    WHERE ke.source_title = ANY(extracted_entities)
       OR kn.document_title = ANY(extracted_entities)
    LIMIT match_count
  ),
  vector_matches AS (
    -- Fallback vectorial: similitud coseno, excluye ya hallados por grafo
    SELECT
      kn.document_title,
      kn.content,
      (1.0 - (kn.embedding <=> query_embedding))::float AS relevance
    FROM public.knowledge_nodes kn
    WHERE (1.0 - (kn.embedding <=> query_embedding)) > match_threshold
      AND (
        NOT EXISTS (SELECT 1 FROM graph_matches gm WHERE gm.document_title = kn.document_title)
      )
    ORDER BY kn.embedding <=> query_embedding
    LIMIT match_count
  )
  SELECT 'GRAPH'::text,  gm.document_title, gm.content, gm.relevance FROM graph_matches gm
  UNION ALL
  SELECT 'VECTOR'::text, vm.document_title, vm.content, vm.relevance FROM vector_matches vm
  ORDER BY 4 DESC
  LIMIT match_count;
$$;
