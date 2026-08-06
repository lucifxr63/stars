-- 20260806000001_guardarrail_contenido.sql
--
-- CAL-5: que «nodo recuperable sin contenido» pase a ser un estado IMPOSIBLE,
-- no una convención que alguien tiene que recordar.
--
-- POR QUÉ NO SE HACE COMO DECÍA EL PLAN
-- -------------------------------------
-- El plan proponía «un trigger que ponga `embedding = NULL` si el contenido no
-- supera un mínimo útil — más suave y probablemente mejor». **No funciona**, y
-- se descubrió aplicando CAL-3:
--
--     fetch_nodes_pending_embedding() devuelve TODOS los nodos con embedding
--     nulo, y el job `embeddings_pendientes` los revectoriza.
--
-- O sea que anular el vector no impide nada: lo repone la siguiente corrida del
-- job. El guardarraíl habría durado un día y nadie se habría enterado, porque
-- el estado «malo» se ve idéntico al «recién insertado, pendiente de vector».
--
-- Ese mismo hallazgo invalidó retroactivamente la opción B de CAL-1 («quitarles
-- el embedding, reversible»): no era reversible, era temporal.
--
-- Entonces el guardarraíl tiene que impedir que la FILA exista, no que tenga
-- vector.
--
-- QUÉ RECHAZA, EXACTAMENTE
-- ------------------------
-- Sólo `contenido_util(content) = ''`, o sea: después de descontar la plantilla
-- de relaciones, el andamiaje de NotebookLM y el frontmatter YAML, no queda
-- NADA. No es un umbral de longitud — el nodo más corto legítimo del grafo hoy
-- tiene 35 caracteres y sigue entrando sin problema.
--
-- Se eligió el criterio inequívoco a propósito: un mínimo tipo «> 120 chars»
-- habría rechazado contenido corto pero real (`"Inflación mensual. Impacta
-- burn rate real en pesos chilenos."` son 60), y un guardarraíl que rechaza
-- cosas buenas termina desactivado.
--
-- EL COSTO, DICHO DE FRENTE
-- -------------------------
-- `bulk_insert_nodes` upsertea en BLOQUE. Si un nodo del lote viene vacío,
-- **falla la sentencia entera** y esa corrida no ingiere nada, en vez de
-- ingerir 29 de 30. Es el mismo trato que ya se aceptó para
-- `trg_knowledge_edges_extremos`, y por la misma razón: un extractor que
-- empieza a producir basura tiene que REVENTAR, no degradarse en silencio.
--
-- Al 2026-08-06 ninguno de los caminos de escritura vivos produce un nodo así
-- —0 de 697 filas tienen contenido útil vacío— y el generador que los producía
-- (el sync del vault de Obsidian) ya filtra en origen desde CAL-4.

begin;

create or replace function public.knowledge_nodes_exigir_contenido()
returns trigger
language plpgsql
as $$
begin
  if length(public.contenido_util(new.content)) = 0 then
    raise exception
      'Nodo sin contenido útil: "%" / "%". Después de descontar plantilla, andamiaje de NotebookLM y frontmatter no queda nada. Un nodo así se vectoriza igual, y como su vector termina siendo el del título RANKEA PRIMERO en la pregunta sobre su propio tema y desplaza al contenido real fuera del contexto.',
      new.document_title, new.header_path
      using errcode = 'check_violation',
            hint = 'Si el documento no tiene contenido para esta sección, no la inserte. Filtrar en el generador, no aguas abajo.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_knowledge_nodes_contenido on public.knowledge_nodes;
create trigger trg_knowledge_nodes_contenido
  before insert or update of content
  on public.knowledge_nodes
  for each row
  execute function public.knowledge_nodes_exigir_contenido();

commit;
