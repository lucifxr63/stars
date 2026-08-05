-- 20260805000003_cascada_documentos_troceados.sql
--
-- Corrige un defecto que introduje HOY en 20260805000002.
--
-- QUÉ ESTÁ MAL
-- ------------
-- Las piezas 2 y 3 de esa migración (propagar renombre, cascadear borrado)
-- asumen que un `document_title` corresponde a UN nodo. Es falso: el modelo de
-- datos trocea un documento en secciones —misma `document_title`, distinta
-- `header_path`— y la clave real es el par.
--
--     774 nodos  →  212 títulos  →  56 títulos con más de un chunk
--
-- `knowledge_edges` referencia el TÍTULO, o sea el documento entero. Entonces:
--
--   * Borrar UN chunk borraba TODAS las aristas del documento, aunque quedaran
--     otros 28 chunks vivos.
--   * Renombrar UN chunk arrastraba TODAS las aristas del documento al título
--     nuevo, dejando sin relaciones a los chunks que conservaban el viejo.
--
-- Los 56 títulos multi-chunk concentran 354 de las 477 aristas del grafo: el
-- 74 % estaba a un DELETE de distancia. La limpieza de nodos vacíos que sigue a
-- esto (CAL-1) borra chunks de 44 documentos y habría volado 149 aristas.
--
-- No explotó porque no se borró ni renombró ningún nodo desde que se aplicó.
--
-- POR QUÉ NO LO VI
-- ----------------
-- Escribí y probé el trigger contra nodos de una sola fila por título. Las 6
-- pruebas pasaron porque cubrían el caso que imaginé. El modelo troceado ya
-- estaba en la base y no lo miré.
--
-- LA SEMÁNTICA CORRECTA
-- ---------------------
-- Una foreign key apunta a una clave ÚNICA. Acá el destino —`document_title`—
-- no lo es, así que la referencia está satisfecha mientras exista AL MENOS UN
-- nodo con ese título. La cascada sólo debe dispararse cuando desaparece el
-- último.
--
--     borrar chunk 1 de 29  →  quedan 28  →  las aristas NO se tocan
--     borrar el chunk 29    →  no queda ninguno  →  las aristas se borran
--
-- Los triggers son AFTER ... FOR EACH ROW, que en Postgres se encolan y se
-- disparan al FINAL de la sentencia. Un `delete` que se lleva los 29 chunks de
-- una vez dispara 29 veces con cero hermanos visibles: cascadea una vez y las
-- 28 restantes no encuentran nada que borrar. El resultado es el mismo que fila
-- por fila.
--
-- ADEMÁS: COLISIÓN EN EL RENOMBRE (defecto distinto, misma función)
-- ----------------------------------------------------------------
-- `knowledge_edges` tiene `unique_edge (source_title, target_title,
-- relation_type)`. Si al renombrar X→Y ya existe la arista (Y, T, R) y también
-- (X, T, R), el UPDATE viola la restricción y el renombre REVIENTA.
--
-- Tras el renombre esas dos filas son literalmente la misma arista, así que se
-- descarta la duplicada antes de propagar. La alternativa —dejar que falle— no
-- protege ningún dato: sólo bloquea el renombre.

begin;

-- ── Pieza 2 corregida: propagar el renombre sólo al renombrar el último chunk

create or replace function knowledge_nodes_propagar_renombre()
returns trigger
language plpgsql
as $$
begin
  if new.document_title is not distinct from old.document_title then
    return new;
  end if;

  -- ¿Queda algún otro chunk con el título viejo? Entonces el documento sigue
  -- existiendo y sus aristas siguen siendo suyas.
  if exists (
    select 1 from public.knowledge_nodes
     where document_title = old.document_title
  ) then
    return new;
  end if;

  -- Descartar las que colisionarían con una arista ya existente bajo el título
  -- nuevo: después del renombre serían la misma fila.
  delete from public.knowledge_edges vieja
   using public.knowledge_edges nueva
   where vieja.source_title = old.document_title
     and nueva.source_title = new.document_title
     and nueva.target_title = vieja.target_title
     and nueva.relation_type = vieja.relation_type;

  delete from public.knowledge_edges vieja
   using public.knowledge_edges nueva
   where vieja.target_title = old.document_title
     and nueva.target_title = new.document_title
     and nueva.source_title = vieja.source_title
     and nueva.relation_type = vieja.relation_type;

  update public.knowledge_edges
     set source_title = new.document_title
   where source_title = old.document_title;

  update public.knowledge_edges
     set target_title = new.document_title
   where target_title = old.document_title;

  return new;
end;
$$;

-- ── Pieza 3 corregida: cascadear sólo al borrar el último chunk

create or replace function knowledge_nodes_borrar_aristas()
returns trigger
language plpgsql
as $$
begin
  -- Un título es un DOCUMENTO, no una fila. Mientras quede un chunk, el
  -- documento existe y sus aristas apuntan a algo real.
  if exists (
    select 1 from public.knowledge_nodes
     where document_title = old.document_title
  ) then
    return old;
  end if;

  delete from public.knowledge_edges
   where source_title = old.document_title
      or target_title = old.document_title;

  return old;
end;
$$;

commit;
