-- search_hybrid_graphrag: recuperar por relevancia y no por orden alfabético.
--
-- SÍNTOMA
-- Con expertos activados, el MoE devolvía nodos que no tenían nada que ver con
-- la consulta, y en orden alfabético: ante "riesgo legal fintech y cómo falla la
-- Corte Suprema" contestaba con "Benchmark LTV:CAC", "Blue Ocean Strategy",
-- "CAC", "Cash Runway", "Cobre Futuros".
--
-- TRES DEFECTOS EN LA VERSIÓN ANTERIOR
--
-- 1. `graph_matches` tenía LIMIT sin ORDER BY. Tomaba `match_count` filas
--    arbitrarias; como además hacía DISTINCT, Postgres ordenaba por las columnas
--    de salida para deduplicar y el resultado salía alfabético por título. De
--    ahí la B-B-C-C-C.
--
-- 2. A las filas del grafo les ponía `relevance = 1.0` fijo, y el ORDER BY final
--    es por relevancia. Como toda similitud coseno es < 1.0, las filas del grafo
--    GANABAN SIEMPRE y llenaban los `match_count` cupos. La rama vectorial
--    quedaba muerta en cuanto hubiera seis vecinos — o sea, casi siempre.
--    El "híbrido" era grafo puro.
--
-- 3. El INNER JOIN contra knowledge_edges descartaba los nodos que SON una
--    entidad activada pero no tienen aristas. Los 20 nodos de jurisprudencia
--    recién generados son exactamente ese caso: existían, estaban vectorizados,
--    el experto legal los listaba, y no podían aparecer nunca.
--
-- QUÉ CAMBIA
-- Las filas del grafo se puntúan por similitud coseno como todas las demás, con
-- un empujón fijo por estar conectadas (GRAPH_BOOST). Así la conexión sigue
-- pesando —que es la intención del híbrido— pero no anula el significado.
--
-- El boost es deliberadamente chico: un vecino del grafo que no tiene nada que
-- ver con la consulta no debería desplazar a un nodo que sí responde.

create or replace function public.search_hybrid_graphrag(
  query_embedding    vector,
  extracted_entities text[],
  match_threshold    double precision default 0.75,
  match_count        integer          default 6
) returns table(
  source_type    text,
  document_title text,
  content        text,
  relevance      double precision
)
language sql
stable
as $function$
  with candidatos_grafo as (
    -- (a) Nodos que SON una entidad activada. Van por su cuenta, sin exigir
    --     arista: un nodo recién incorporado todavía no tiene vecinos y aun así
    --     es exactamente lo que el experto pidió.
    select kn.document_title, kn.content, kn.embedding
      from public.knowledge_nodes kn
     where kn.document_title = any(extracted_entities)
       and kn.embedding is not null
    union
    -- (b) Vecinos por arista saliente desde una entidad activada.
    select kn.document_title, kn.content, kn.embedding
      from public.knowledge_nodes kn
      join public.knowledge_edges ke
        on kn.document_title = ke.target_title
     where ke.source_title = any(extracted_entities)
       and kn.embedding is not null
  ),
  graph_matches as (
    select
      cg.document_title,
      cg.content,
      -- Similitud real + empujón por conexión, acotado a 1.0.
      least(1.0, (1.0 - (cg.embedding <=> query_embedding)) + 0.05)::float as relevance
      from candidatos_grafo cg
     -- ORDER BY antes del LIMIT: sin esto el limite recortaba filas al azar.
     order by cg.embedding <=> query_embedding
     limit match_count
  ),
  vector_matches as (
    select
      kn.document_title,
      kn.content,
      (1.0 - (kn.embedding <=> query_embedding))::float as relevance
      from public.knowledge_nodes kn
     where kn.embedding is not null
       and (1.0 - (kn.embedding <=> query_embedding)) > match_threshold
       and not exists (
             select 1 from graph_matches gm
              where gm.document_title = kn.document_title
           )
     order by kn.embedding <=> query_embedding
     limit match_count
  )
  select 'GRAPH'::text,  gm.document_title, gm.content, gm.relevance from graph_matches gm
  union all
  select 'VECTOR'::text, vm.document_title, vm.content, vm.relevance from vector_matches vm
  order by 4 desc
  limit match_count;
$function$;

comment on function public.search_hybrid_graphrag is
  'GraphRAG hibrido. Las filas del grafo se puntuan por similitud coseno + boost de conexion, no con 1.0 fijo: antes ganaban siempre y anulaban la rama vectorial.';
