-- Backfill knowledge_nodes from existing knowledge_base vault records
INSERT INTO public.knowledge_nodes (document_title, header_path, content, category, tags, embedding)
SELECT
  split_part(title, ' — ', 1) AS document_title,
  COALESCE(
    NULLIF(trim(substring(title FROM length(split_part(title, ' — ', 1)) + 5)), ''),
    'Introduccion'
  ) AS header_path,
  content,
  category,
  ARRAY(SELECT t FROM unnest(tags) AS t WHERE t NOT LIKE 'wikilink:%') AS tags,
  embedding
FROM public.knowledge_base
WHERE source = 'obsidian_vault'
  AND title LIKE '% — %'
ON CONFLICT (document_title, header_path) DO UPDATE
  SET content    = EXCLUDED.content,
      tags       = EXCLUDED.tags,
      embedding  = EXCLUDED.embedding,
      updated_at = now();

-- Backfill knowledge_edges from wikilink: tags stored in knowledge_base
INSERT INTO public.knowledge_edges (source_title, target_title, relation_type)
SELECT DISTINCT
  split_part(kb.title, ' — ', 1)  AS source_title,
  substring(tag FROM 10)           AS target_title,
  'MENTIONS'
FROM public.knowledge_base kb
CROSS JOIN unnest(kb.tags) AS tag
WHERE kb.source = 'obsidian_vault'
  AND kb.title LIKE '% — %'
  AND tag LIKE 'wikilink:%'
ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;
