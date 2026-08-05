-- 20260805000002_knowledge_edges_integridad.sql
--
-- Integridad referencial para knowledge_edges, sin migrar el esquema a ids.
--
-- POR QUÉ
-- -------
-- `knowledge_edges` enlaza nodos por TÍTULO (`source_title` / `target_title`) y
-- no tiene foreign key. Consecuencia: una arista hacia un nodo inexistente **se
-- inserta sin error y se cuenta como éxito**.
--
-- Y el daño no es cosmético. `search_hybrid_graphrag` trae los vecinos con un
-- INNER JOIN contra knowledge_nodes:
--
--     join knowledge_edges ke on kn.document_title = ke.target_title
--
-- así que una arista rota **aporta cero filas en silencio**. El grafo promete un
-- vecino, el join lo descarta, y el modelo recibe un contexto parcial
-- indistinguible de uno completo — que después completa con conocimiento
-- paramétrico. Es un generador de alucinaciones, y el origen es nuestro.
--
-- Al 2026-08-05 había 78 aristas así (15 % del grafo). 38 las creó
-- `sync-jurisprudencia-grafo` el 03-08 —la feature más reciente— porque generaba
-- NODOS con topes (TOP_MATERIAS=12) y ARISTAS con otro umbral sin tope. Materias
-- como Bancos, AFP y Carabineros apuntaban al vacío.
--
-- POR QUÉ TRES PIEZAS Y NO UNA
-- ---------------------------
-- Un trigger que sólo valide inserts da una falsa sensación de integridad:
-- bloquea la puerta y deja las ventanas abiertas. Un nodo BORRADO o RENOMBRADO
-- rompe sus aristas igual, y nada avisa. Pasó de verdad el 2026-08-05 al borrar
-- los 8 nodos de `Señal Empleo`: hubo que revisar las aristas a mano, y si
-- hubieran existido habrían quedado colgando.
--
-- Las tres juntas dan semántica de FOREIGN KEY (ON UPDATE CASCADE, ON DELETE
-- CASCADE) sin migrar el modelo. La migración a ids sigue siendo el arreglo de
-- fondo; esto es la red mientras tanto.
--
-- COSTO
-- -----
-- Dos EXISTS por arista insertada, servidos por `idx_kn_document_title`. Los
-- generadores hacen upserts de decenas a cientos de filas: despreciable.
--
-- RIESGO ACEPTADO
-- ---------------
-- Esto convierte un fallo silencioso en un error ruidoso. Es el punto, pero
-- significa que un job mal escrito va a REVENTAR en producción en vez de
-- corromper el grafo calladamente. Se relevaron los cinco insertadores vivos
-- antes de aplicar (jurisprudencia ya filtra; build_edges lee los títulos de
-- knowledge_nodes; los tres apply_* insertan nodos ANTES que aristas) y ninguno
-- viola la restricción.

begin;

-- ── 1. Una arista exige que sus dos extremos existan ─────────────────────

create or replace function knowledge_edges_exigir_extremos()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.knowledge_nodes where document_title = new.source_title
  ) then
    raise exception
      'Arista hacia un nodo inexistente: source_title = %. Una arista rota no falla en el RAG: aporta cero filas en silencio.',
      new.source_title
      using errcode = 'foreign_key_violation';
  end if;

  if not exists (
    select 1 from public.knowledge_nodes where document_title = new.target_title
  ) then
    raise exception
      'Arista hacia un nodo inexistente: target_title = %. Una arista rota no falla en el RAG: aporta cero filas en silencio.',
      new.target_title
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_knowledge_edges_extremos on public.knowledge_edges;
create trigger trg_knowledge_edges_extremos
  before insert or update of source_title, target_title
  on public.knowledge_edges
  for each row
  execute function knowledge_edges_exigir_extremos();

-- ── 2. Renombrar un nodo arrastra sus aristas (ON UPDATE CASCADE) ────────
--
-- Sin esto, cambiarle el título a un nodo huerfaniza todas sus aristas de una
-- sola sentencia — y con la pieza 1 puesta, el siguiente intento de tocarlas
-- fallaría con un mensaje que apunta al síntoma y no a la causa.

create or replace function knowledge_nodes_propagar_renombre()
returns trigger
language plpgsql
as $$
begin
  if new.document_title is distinct from old.document_title then
    update public.knowledge_edges
       set source_title = new.document_title
     where source_title = old.document_title;

    update public.knowledge_edges
       set target_title = new.document_title
     where target_title = old.document_title;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_knowledge_nodes_renombre on public.knowledge_nodes;
create trigger trg_knowledge_nodes_renombre
  after update of document_title
  on public.knowledge_nodes
  for each row
  execute function knowledge_nodes_propagar_renombre();

-- ── 3. Borrar un nodo borra sus aristas (ON DELETE CASCADE) ──────────────
--
-- DESTRUCTIVO POR DISEÑO, y es la pieza que conviene entender antes de
-- apoyarse en ella: borrar un nodo pasa a borrar silenciosamente sus
-- relaciones. Es lo correcto —una arista sin extremo no sirve para nada y el
-- INNER JOIN ya la descarta— pero es un borrado en cascada que antes no
-- existía.
--
-- La alternativa (bloquear el borrado si hay aristas) obligaría a limpiar a
-- mano cada vez que se desactiva un extractor, que es justo la fricción que
-- hace que la gente no lo haga.

create or replace function knowledge_nodes_borrar_aristas()
returns trigger
language plpgsql
as $$
begin
  delete from public.knowledge_edges
   where source_title = old.document_title
      or target_title = old.document_title;
  return old;
end;
$$;

drop trigger if exists trg_knowledge_nodes_borrado on public.knowledge_nodes;
create trigger trg_knowledge_nodes_borrado
  after delete
  on public.knowledge_nodes
  for each row
  execute function knowledge_nodes_borrar_aristas();

commit;
