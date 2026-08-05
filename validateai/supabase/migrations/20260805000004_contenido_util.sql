-- 20260805000004_contenido_util.sql
--
-- UNA sola definición de "contenido útil", en la base.
--
-- POR QUÉ ACÁ Y NO EN PYTHON
-- --------------------------
-- Esta definición decide tres cosas distintas: qué se MIDE (la línea base del
-- RAG), qué se BORRA (CAL-1/2/3) y qué se va a IMPEDIR (el guardarraíl de
-- CAL-5). Si cada una lleva su propio filtro, terminan divergiendo y la métrica
-- deja de describir lo que el sistema hace.
--
-- Ya pasó una vez, y por eso existe esta función: el diagnóstico contó 36 nodos
-- vacíos porque su filtro sólo descontaba `Relacionado con: , , ,`. Un chunk
-- cuyo contenido entero era `Relacionado con: , , Asked on … NotebookLM` se
-- contaba como NO vacío. Son 49.
--
-- QUÉ NO ES CONOCIMIENTO
-- ----------------------
-- Las tres familias salieron de leer contextos ensamblados reales:
--
--   1. `Relacionado con: …`  — plantilla de relaciones. A veces con los valores
--      interpolados vacíos (`"Relacionado con: , , ,"`), que es una relación
--      prometida y no existente: la misma familia que las aristas huérfanas,
--      escrita en el texto.
--   2. `Asked on … against NotebookLM notebook` — marca de la herramienta de
--      ingesta. Andamiaje del proceso, no del dominio.
--   3. Frontmatter YAML (`--- titulo: … ---`) — la cabecera del archivo fuente
--      quedó troceada como si fuera una sección del documento.
--
-- Ninguna afirma nada sobre Chile, startups ni regulación. Todas entran al
-- prompt de un LLM como si lo hicieran.

begin;

create or replace function public.contenido_util(txt text)
returns text
language sql
immutable
parallel safe
as $$
  select btrim(
           regexp_replace(
             regexp_replace(
               -- Sin flags: sólo la PRIMERA ocurrencia y `.` matchea saltos de
               -- línea, que es justo lo que hace falta para un frontmatter al
               -- principio del texto. Con 'n' el `^` dejaría de anclar al
               -- inicio del contenido y se comería cualquier bloque `--- … ---`.
               regexp_replace(coalesce(txt, ''), '^\s*---.*?---\s*', ''),
               'Relacionado con:[^\n]*', '', 'g'),
             'Asked on [^\n]*notebook', '', 'g')
         );
$$;

comment on function public.contenido_util(text) is
  'Contenido menos los restos del proceso de ingesta (plantilla de relaciones, '
  'andamiaje de NotebookLM, frontmatter YAML). Definición única compartida por '
  'la medición del RAG, la limpieza y el guardarraíl. Ver 20260805000004.';

commit;
