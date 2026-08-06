-- Guardarraíl de contenido útil — pruebas contra la base REAL, con ROLLBACK.
--
--   npx supabase db query --linked --file supabase/tests/knowledge_nodes_contenido.sql
--
-- Ejercita el trigger TAL COMO ESTÁ DESPLEGADO (no redefine nada), así que sirve
-- de regresión permanente para 20260806000001.
--
-- Los casos 4, 5 y 6 son los que lo hacen valer: un guardarraíl que sólo
-- demuestra que rechaza lo malo no dice nada sobre si deja pasar lo bueno, y
-- ése es el que termina desactivado por molesto.

begin;

create temp table resultado(n int, caso text, esperado text, obtenido text) on commit drop;

create or replace function pg_temp.intentar(titulo text, contenido text) returns text
language plpgsql as $$
begin
  insert into public.knowledge_nodes (document_title, header_path, content, category)
  values (titulo, 'ZZT', contenido, 'metodologia');
  return 'ACEPTADO';
exception when check_violation then
  return 'RECHAZADO';
end;
$$;

-- ── Lo que tiene que rechazar ────────────────────────────────────────────

insert into resultado values (1, 'contenido totalmente vacío',
  'RECHAZADO', pg_temp.intentar('ZZT vacio', ''));

insert into resultado values (2, 'sólo la plantilla de relaciones',
  'RECHAZADO', pg_temp.intentar('ZZT plantilla', 'Relacionado con: , , ,'));

insert into resultado values (3, 'plantilla + andamiaje de NotebookLM',
  'RECHAZADO', pg_temp.intentar('ZZT andamiaje',
    'Relacionado con: , , Asked on 2026-05-24T09:33:34.628Z against NotebookLM notebook'));

-- ── Lo que NO debe rechazar ──────────────────────────────────────────────

insert into resultado values (4, 'contenido corto pero real (60 chars)',
  'ACEPTADO', pg_temp.intentar('ZZT corto',
    'Inflación mensual. Impacta burn rate real en pesos chilenos.'));

insert into resultado values (5, 'el nodo más corto que hoy vive en el grafo (35)',
  'ACEPTADO', pg_temp.intentar('ZZT minimo', '•tbk. | DEVELOPERS - Referencia Api'));

insert into resultado values (6, 'contenido real CON la plantilla adelante',
  'ACEPTADO', pg_temp.intentar('ZZT mixto',
    'Relacionado con: Ley 21.521, Unit Economics
La Ley 21.719 exige que el consentimiento sea libre, informado y específico.'));

-- ── Un UPDATE tampoco puede vaciarlo ─────────────────────────────────────

create or replace function pg_temp.intentar_update() returns text
language plpgsql as $$
begin
  update public.knowledge_nodes set content = 'Relacionado con: , , ,'
   where document_title = 'ZZT mixto';
  return 'ACEPTADO';
exception when check_violation then
  return 'RECHAZADO';
end;
$$;

insert into resultado values (7, 'vaciar un nodo existente por UPDATE',
  'RECHAZADO', pg_temp.intentar_update());

-- ── El grafo real no queda tocado ────────────────────────────────────────

insert into resultado values (8, 'ninguna fila viva viola el guardarraíl',
  '0 filas', (select count(*)::text || ' filas' from public.knowledge_nodes
               where document_title not like 'ZZT %'
                 and length(public.contenido_util(content)) = 0));

select n, caso, esperado, obtenido,
       case when esperado = obtenido then 'PASA' else 'FALLA' end as veredicto
  from resultado order by n;

rollback;
