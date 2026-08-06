-- 20260806000004_cal3d_notas_al_pie.sql
--
-- CAL-3d: sacar las notas al pie de NotebookLM de los 17 nodos `Answer`.
--
-- QUÉ SON
-- -------
-- El contenido llega partido por los marcadores de cita del notebook, que
-- quedaron como números en líneas sueltas:
--
--     0.50 USD por transacción
--     1
--     2
--     . No cobra tarifas adicionales
--
-- El modelo recibe eso literal. La frase está cortada en cuatro y en el medio
-- hay dos números que no significan nada para quien lee: apuntan a fuentes de
-- un notebook al que el consumidor de la API no tiene acceso.
--
-- CUÁNTO
-- ------
-- Sobre 2.995 líneas de los 17 nodos:
--     1.213  son sólo un número
--       480  son sólo un punto
--       984  tienen texto real
--
-- O sea que dos tercios de las líneas son andamiaje. En caracteres es poco
-- —4.011 de 191.583, un 2 %— porque los marcadores son cortos; lo que cambia
-- no es el volumen sino que el texto pasa de roto a legible.
--
-- POR QUÉ ES SEGURO
-- -----------------
-- Se verificó que **no hay una sola lista numerada legítima** en estos nodos
-- (`^\d{1,2}[\.\)]\s+\S` no matchea nunca), así que ninguna línea que sea sólo
-- un número es contenido. Y tras la transformación quedan 0 líneas-número y 0
-- líneas que empiecen con puntuación: no queda residuo.
--
-- LO QUE NO SE TOCA, A PROPÓSITO
-- ------------------------------
-- Las frases que hablan de «las fuentes proporcionadas» PARECEN andamiaje y no
-- lo son: son advertencias de procedencia. En `Sesgos Cognitivos del Founder`
-- dice que los sesgos que siguen «no están presentes en los documentos
-- proporcionados» y que los define «basándome en mi conocimiento externo»; en
-- `Product-Market Fit` avisa que la atribución de la regla del 40 % a Sean
-- Ellis «proviene de conocimiento externo que podrías querer verificar».
--
-- Borrarlas sería lo peor que se puede hacer con ellas: dejaría el contenido no
-- verificado con apariencia de respaldado. Son exactamente el principio que
-- ordena este plan —«nada entra al prompt afirmando algo que no verificamos»—
-- escrito por el propio corpus. Se conservan.
--
-- EL EMBEDDING SE INVALIDA
-- ------------------------
-- Regla de CAL-2, y no es opcional: dejar el vector viejo sobre texto nuevo es
-- la peor combinación posible, porque el nodo se recupera por un significado
-- que ya no tiene.
--
-- ⚠️ `embeddings_pendientes` NO está agendado (no figura en
-- bralidus-api-cron.yml). Hay que revectorizar a mano después de aplicar esto,
-- o los 17 nodos quedan invisibles para el RAG.

begin;

update public.knowledge_nodes
   set content = btrim(
         regexp_replace(
           regexp_replace(
             -- 1. fuera las líneas que son sólo un número
             regexp_replace(content, E'\n[ \t]*\\d{1,3}[ \t]*(?=\n)', '', 'g'),
             -- 2. la línea que empieza con puntuación se pega a la anterior
             E'\n[ \t]*(?=[\\.,;:])', '', 'g'),
           -- 3. espacios sobrantes
           '[ \t]{2,}', ' ', 'g')
       ),
       embedding = null,
       metadata = coalesce(metadata, '{}'::jsonb)
         || jsonb_build_object(
              'notas_al_pie_removidas', '2026-08-06',
              'motivo', 'marcadores de cita de NotebookLM que partian las frases (CAL-3d)')
 where header_path = 'Answer'
   and content ~ E'\n[ \t]*\\d{1,3}[ \t]*\n';

commit;
