-- 20260806000002_cal3b_contenido_mal_titulado.sql
--
-- CAL-3b: cuatro documentos cuyo título promete un tema y cuyo contenido es de
-- otro. El contenido es bueno; lo que miente es la etiqueta.
--
-- EL DEFECTO
-- ----------
-- Cada uno es un documento de UN SOLO chunk (`header_path = 'Answer'`, restos de
-- una carga desde NotebookLM), así que el documento ENTERO habla de otra cosa:
--
--   Mom Test — Framework Entrevistas       →  playbook de go-to-market y PLG
--   Marco Regulatorio Fintech — CMF y UAF  →  árbol de decisión no-code/low-code
--   Analisis Competitivo y MOAT — Metodol. →  manifiesto de riesgos cognitivos
--   Constitucion SpA Chile — Guia Completa →  cheat sheet de unit economics
--
-- Un usuario que pregunta por constitución de SpA recibe fórmulas de LTV bajo
-- ese encabezado. No es contenido ausente: es contenido AFIRMANDO SER otra cosa,
-- que es peor, porque un hueco invita a decir «no tengo el dato» y esto no.
--
-- POR QUÉ NO SE RETITULA Y YA
-- ---------------------------
-- Sería la solución obvia y está mal por dos motivos:
--
--   1. Los cuatro destinos ya tienen un chunk `Answer` (3 de 4), y la clave es
--      `(document_title, header_path)`: un retitulado a secas choca o pisa el
--      que ya está.
--   2. Peor: renombrar arrastra las aristas. Las 20 aristas apuntan al TÍTULO —
--      dicen «este documento menciona el Mom Test». Si el nodo pasa a llamarse
--      «Product-Led Growth», esas aristas pasan a decir que menciona PLG. Se
--      cambiaría una mentira por otra.
--
-- QUÉ SE HACE ENTONCES
-- --------------------
-- Se separan las dos cosas, porque son dos cosas:
--
--   * EL CONTENIDO se copia como un chunk nuevo del documento al que de verdad
--     pertenece, con un `header_path` descriptivo (no `Answer`, que ya está
--     ocupado). Entra sin embedding a propósito: `embeddings_pendientes` lo
--     vectoriza con el título YA correcto, que es lo único que hace que
--     `_build_embed_text` («{title}. {content}») deje de mentir.
--
--   * LAS ARISTAS se repuntan a un documento hermano que SÍ cubre el tema que
--     el título prometía. Así la relación sobrevive y además pasa a ser cierta.
--     Los cuatro temas tienen hermano verificado: 58, 41, 20 y 76 nodos
--     respectivamente.
--
--   * EL NODO MAL TITULADO se borra. Para entonces ya no tiene aristas, así que
--     la cascada de `trg_knowledge_nodes_borrado` no encuentra nada que hacer.
--
-- DOS CASOS QUE HAY QUE MANEJAR AL REPUNTAR
-- -----------------------------------------
--   * BUCLE: una arista de `Analisis Competitivo y MOAT — Metodologia` apunta a
--     `Analisis Competitivo y MOAT`, que es justo su destino. Repuntarla la
--     dejaría apuntándose a sí misma. Se borra.
--   * COLISIÓN: `unique_edge (source, target, relation_type)`. Si el hermano ya
--     tiene esa misma arista, la que se mueve es un duplicado. Se borra.
--
-- Es el mismo par de casos que hubo que resolver en CAL-0 al propagar renombres.

begin;

create temp table cal3_plan(
  malo               text primary key,
  destino_contenido  text not null,
  header_nuevo       text not null,
  destino_aristas    text not null
) on commit drop;

insert into cal3_plan values
  ('Mom Test — Framework Entrevistas de Validacion',
   'Product-Led Growth PLG — Estrategia Completa',
   'Playbook de Go-to-Market y Ventas',
   -- No se repunta a `Lean Startup y Customer Development` porque ya es uno de
   -- los extremos: quedaría un bucle. Las tres `Mom Test — Regla de …` SON el
   -- framework que el título prometía; se toma la regla central.
   'Mom Test — Regla de No Presentar la Solución'),

  ('Marco Regulatorio Fintech Chile — CMF y UAF',
   'Stack No-Code Low-Code para MVPs',
   'Árbol de Decisión Tecnológico',
   -- Es literalmente el registro CMF, que es lo que prometía el título.
   'Ley Fintech 21.521 — Registro CMF de Prestadores'),

  ('Analisis Competitivo y MOAT — Metodologia',
   'Sesgos Cognitivos del Founder — Guia Completa',
   'Manifiesto de Riesgos Cognitivos',
   -- El documento base, sin el sufijo « — Metodologia».
   'Analisis Competitivo y MOAT'),

  ('Constitucion SpA Chile — Guia Completa',
   'Unit Economics y Benchmarks B2B SaaS',
   'Cheat Sheet Financiera',
   'Estructura SpA (Sociedad por Acciones)');

-- ── 1. Bucles: la arista ya apunta al destino ────────────────────────────

delete from public.knowledge_edges e
 using cal3_plan p
 where (e.source_title = p.malo and e.target_title = p.destino_aristas)
    or (e.target_title = p.malo and e.source_title = p.destino_aristas);

-- ── 2. Colisiones con unique_edge ────────────────────────────────────────

delete from public.knowledge_edges e
 using cal3_plan p
 where e.source_title = p.malo
   and exists (select 1 from public.knowledge_edges x
                where x.source_title = p.destino_aristas
                  and x.target_title = e.target_title
                  and x.relation_type = e.relation_type);

delete from public.knowledge_edges e
 using cal3_plan p
 where e.target_title = p.malo
   and exists (select 1 from public.knowledge_edges x
                where x.target_title = p.destino_aristas
                  and x.source_title = e.source_title
                  and x.relation_type = e.relation_type);

-- ── 3. Repuntar lo que queda ─────────────────────────────────────────────

update public.knowledge_edges e
   set source_title = p.destino_aristas
  from cal3_plan p
 where e.source_title = p.malo;

update public.knowledge_edges e
   set target_title = p.destino_aristas
  from cal3_plan p
 where e.target_title = p.malo;

-- ── 4. Mudar el contenido a su documento ─────────────────────────────────
--
-- La categoría se toma del documento DESTINO, no del origen: el contenido pasa
-- a pertenecer a ese documento y la del origen describía el tema equivocado.

insert into public.knowledge_nodes (document_title, header_path, content, category, metadata)
select p.destino_contenido,
       p.header_nuevo,
       n.content,
       (select k.category from public.knowledge_nodes k
         where k.document_title = p.destino_contenido and k.category is not null
         limit 1),
       coalesce(n.metadata, '{}'::jsonb)
         || jsonb_build_object(
              'reubicado_desde', p.malo,
              'reubicado_el', '2026-08-06',
              'motivo', 'el titulo original no correspondia al contenido (CAL-3b)')
  from cal3_plan p
  join public.knowledge_nodes n on n.document_title = p.malo;

-- ── 5. Borrar el nodo mal titulado ───────────────────────────────────────

delete from public.knowledge_nodes n
 using cal3_plan p
 where n.document_title = p.malo;

commit;
