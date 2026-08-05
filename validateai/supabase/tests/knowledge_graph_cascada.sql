-- Cascada de knowledge_edges sobre documentos troceados — pruebas contra la
-- base REAL, con ROLLBACK. No deja residuo: los datos de prueba y el estado
-- se revierten al final.
--
--   npx supabase db query --linked --file supabase/tests/knowledge_graph_cascada.sql
--
-- Ejercita los triggers TAL COMO ESTÁN DESPLEGADOS (no redefine nada), así que
-- sirve de regresión permanente para 20260805000003.
--
-- Los casos 1, 5 y 7 son los que discriminan: contra los triggers previos a esa
-- migración, el 1 y el 5 FALLAN y el 7 aborta con `unique_edge`. Si algún día
-- los tres pasan por accidente, la prueba dejó de probar.

begin;

-- ── Andamiaje ────────────────────────────────────────────────────────────

create temp table resultado(n int, caso text, esperado text, obtenido text) on commit drop;

create or replace function pg_temp.armar() returns void language plpgsql as $$
begin
  delete from public.knowledge_edges where source_title like 'ZZT %' or target_title like 'ZZT %';
  delete from public.knowledge_nodes where document_title like 'ZZT %';

  insert into public.knowledge_nodes (document_title, header_path, content) values
    ('ZZT A', 'Introduccion', 'a1'), ('ZZT A', 'Cap 1', 'a2'), ('ZZT A', 'Cap 2', 'a3'),
    ('ZZT B', 'Introduccion', 'b1'),
    ('ZZT C', 'Introduccion', 'c1'), ('ZZT C', 'Cap 1', 'c2');

  insert into public.knowledge_edges (source_title, target_title, relation_type) values
    ('ZZT A', 'ZZT B', 'MENTIONS'),
    ('ZZT C', 'ZZT A', 'MENTIONS'),
    ('ZZT B', 'ZZT C', 'MENTIONS');
end;
$$;

create or replace function pg_temp.aristas(t text) returns int language sql as $$
  select count(*)::int from public.knowledge_edges
   where source_title = t or target_title = t;
$$;

-- ── 1 · Borrar UN chunk de un documento de 3 NO toca sus aristas ─────────
select pg_temp.armar();
delete from public.knowledge_nodes where document_title = 'ZZT A' and header_path = 'Cap 1';
insert into resultado values (1,
  'borrar 1 de 3 chunks: las aristas del documento quedan',
  '2 aristas | 2 chunks vivos',
  pg_temp.aristas('ZZT A') || ' aristas | ' ||
  (select count(*) from public.knowledge_nodes where document_title='ZZT A') || ' chunks vivos');

-- ── 2 · Borrar el ÚLTIMO chunk sí cascadea ───────────────────────────────
select pg_temp.armar();
delete from public.knowledge_nodes where document_title = 'ZZT A' and header_path <> 'Cap 2';
delete from public.knowledge_nodes where document_title = 'ZZT A' and header_path  = 'Cap 2';
insert into resultado values (2,
  'borrar el ultimo chunk: cascadea',
  '0 aristas',
  pg_temp.aristas('ZZT A') || ' aristas');

-- ── 3 · Borrar los 3 chunks en UNA sentencia también cascadea ────────────
select pg_temp.armar();
delete from public.knowledge_nodes where document_title = 'ZZT A';
insert into resultado values (3,
  'borrar los 3 chunks de una vez: cascadea',
  '0 aristas',
  pg_temp.aristas('ZZT A') || ' aristas');

-- ── 4 · Regresión: documento de una sola fila sigue cascadeando ──────────
select pg_temp.armar();
delete from public.knowledge_nodes where document_title = 'ZZT B';
insert into resultado values (4,
  'regresion: doc de 1 chunk sigue cascadeando',
  '0 aristas',
  pg_temp.aristas('ZZT B') || ' aristas');

-- ── 5 · Renombrar UN chunk de 2 NO arrastra las aristas ──────────────────
select pg_temp.armar();
update public.knowledge_nodes set document_title = 'ZZT C2'
 where document_title = 'ZZT C' and header_path = 'Cap 1';
insert into resultado values (5,
  'renombrar 1 de 2 chunks: las aristas se quedan en el titulo viejo',
  '2 en viejo | 0 en nuevo',
  pg_temp.aristas('ZZT C') || ' en viejo | ' || pg_temp.aristas('ZZT C2') || ' en nuevo');

-- ── 6 · Renombrar TODOS los chunks sí propaga ────────────────────────────
select pg_temp.armar();
update public.knowledge_nodes set document_title = 'ZZT C2' where document_title = 'ZZT C';
insert into resultado values (6,
  'renombrar todos los chunks: propaga',
  '0 en viejo | 2 en nuevo',
  pg_temp.aristas('ZZT C') || ' en viejo | ' || pg_temp.aristas('ZZT C2') || ' en nuevo');

-- ── 7 · Renombre con colisión contra unique_edge: no revienta, deduplica ─
select pg_temp.armar();
insert into public.knowledge_nodes (document_title, header_path, content) values
  ('ZZT X', 'Solo', 'x1'), ('ZZT Y', 'Introduccion', 'y1'), ('ZZT T', 'Introduccion', 't1');
insert into public.knowledge_edges (source_title, target_title, relation_type) values
  ('ZZT X', 'ZZT T', 'MENTIONS'),
  ('ZZT Y', 'ZZT T', 'MENTIONS');   -- al renombrar X->Y estas dos son la misma arista
update public.knowledge_nodes set document_title = 'ZZT Y' where document_title = 'ZZT X';
insert into resultado values (7,
  'renombre que colisiona con unique_edge: deduplica en vez de reventar',
  '1 arista Y->T | 1 arista hacia T',
  (select count(*) from public.knowledge_edges
    where source_title='ZZT Y' and target_title='ZZT T' and relation_type='MENTIONS')
  || ' arista Y->T | ' || pg_temp.aristas('ZZT T') || ' arista hacia T');

-- ── 8 · Cero huérfanas en todo el grafo ──────────────────────────────────
insert into resultado values (8,
  'grafo sin aristas huerfanas',
  '0 huerfanas',
  (select count(*) from public.knowledge_edges ke
    where not exists (select 1 from public.knowledge_nodes where document_title = ke.source_title)
       or not exists (select 1 from public.knowledge_nodes where document_title = ke.target_title))
  || ' huerfanas');

select n, caso, esperado, obtenido,
       case when esperado = obtenido then 'PASA' else 'FALLA' end as veredicto
  from resultado order by n;

rollback;
