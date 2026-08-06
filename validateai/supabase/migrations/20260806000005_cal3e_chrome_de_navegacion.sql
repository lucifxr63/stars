-- 20260806000005_cal3e_chrome_de_navegacion.sql
--
-- CAL-3e: cinco chunks que son la barra de navegación de un sitio, no su
-- contenido.
--
-- QUÉ SON
-- -------
-- Apareció mirando un contexto ensamblado real, no consultando la base:
--
--     ### Comparativa Pasarelas de Pago Chile 2025 [VECTOR] — metodologia
--     Test mode Building with AI SDKs and Integrations Zapier Widget Web
--     Integration WebView Integration Listen to Widget events Webhooks…
--
-- Es el menú lateral de la documentación de Fintoc. Otro es Reddit entero
-- («Skip to main content · Open menu · Go to Reddit Home · Get the Reddit app»),
-- y otro el header de Kushki («API reference · Centro de Soporte · Service
-- status · Log in»).
--
-- EL SCRAPING ESTÁ BIEN; ESTOS CINCO NO
-- -------------------------------------
-- Vale medirlo antes de sacar conclusiones sobre la campaña que los trajo:
--
--     408 nodos vienen de ese scraping (`header_path` tipo `[N] título - sitio`)
--     324.942 caracteres, el 43 % del corpus
--     403 son contenido real — BCN, ChileAtiende, Deckary, ThePower Education
--       5 son chrome de navegación
--
-- O sea 3.701 caracteres sobre 758.052: el 0,5 % del grafo. No hay nada que
-- arreglar en la ingesta de esos 408; hay cinco chunks para sacar.
--
-- POR QUÉ ENUMERADOS Y NO POR HEURÍSTICA
-- --------------------------------------
-- Se probaron dos criterios automáticos y los dos son demasiado laxos:
--
--     «300+ chars con menos de 3 puntos»          → 58 nodos
--     «densidad de puntos < 1 cada 200 chars»      → 95 nodos
--
-- Una tabla de precios o una lista de bullets tiene pocos puntos y muchas
-- mayúsculas, igual que un menú. Un filtro así se lleva contenido bueno, y un
-- guardarraíl que rechaza cosas buenas termina desactivado — el mismo criterio
-- por el que CAL-5 no usa un umbral de longitud.
--
-- Los cinco se identificaron por vocabulario de UI en inglés y se leyeron uno
-- por uno antes de borrarlos. Se borra por `id`, no por patrón.

begin;

-- El patrón es EXACTAMENTE el que se usó para identificarlos y leerlos. La
-- primera versión de esta migración traía uno distinto, más angosto, y la red
-- de seguridad de abajo lo atrapó: encontraba 4 y no 5 — se le escapaba el
-- chunk de Kushki, que entra por `Quickstart`. Vale como recordatorio de que un
-- patrón reescrito de memoria no es el patrón con el que se revisó.
create temp table cal3e_objetivo on commit drop as
select id, document_title, header_path,
       length(public.contenido_util(content)) as largo
  from public.knowledge_nodes
 where public.contenido_util(content) ~
       'Test mode|Get started|API Reference|Quickstart|Sign up|Log in|Table of contents|On this page|Was this page helpful';

-- Red de seguridad: si el patrón empezara a matchear más de lo revisado, esto
-- aborta en vez de borrar de más. Se revisaron CINCO, uno por uno.
do $$
declare n int;
begin
  select count(*) into n from cal3e_objetivo;
  if n <> 5 then
    raise exception
      'Se esperaban 5 chunks de chrome y hay %. No se borra nada: revisar uno por uno antes de correr esto.', n;
  end if;
end $$;

delete from public.knowledge_nodes n
 using cal3e_objetivo o
 where n.id = o.id;

commit;
