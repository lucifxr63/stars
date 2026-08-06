-- 20260806000003_cal3c_basura_residual.sql
--
-- CAL-3c: tres chunks que no son conocimiento y que sobrevivieron a CAL-1
-- porque tienen contenido «útil» suficiente para el filtro — el problema no es
-- que estén vacíos, es que hablan de otra cosa.
--
--   1. `Test` / "Test content para validacion chilena"
--      Categoría `normativa`, en producción, recuperable. Un nodo de prueba que
--      nadie borró. Documento de un solo chunk y CERO aristas: no arrastra nada.
--
--   2. `Transbank — Integracion Completa Chile` / "•tbk. | DEVELOPERS -
--      Referencia Api"
--      Fragmento del menú de navegación del sitio, no de la documentación. Es 1
--      de 26 chunks: el documento sobrevive entero.
--
--   3. `Capital Efficiency — Burn Rate, Runway, NRR…` / "Disponible en
--      validation.ts y propagado a PDFData en pdf.ts."
--      DOCUMENTACIÓN INTERNA de Validus dentro de un documento de dominio —
--      misma familia que lo retirado en CAL-3a, sólo que suelta en un chunk. Es
--      1 de 10.
--
-- NO SE TOCAN los otros dos chunks cortos del grafo (IPC y USD/CLP de Data
-- Storytelling, 60 y 83 caracteres). Son cortos pero son dominio real, y son
-- exactamente los que se preservaron al retirar lo interno en CAL-3a. Un
-- criterio que borrara «lo corto» se los llevaría, y por eso el criterio no es
-- la longitud.

begin;

-- El nodo de prueba: se va el documento entero, que es un solo chunk sin aristas.
--
-- Sin condición de `header_path`: el suyo es 'Intro', no 'Introduccion' como el
-- resto del grafo. Asumirlo hizo que el primer intento no borrara nada y el
-- nodo siguiera vivo — con la migración reportando éxito, que es justo el modo
-- de falla que este plan viene persiguiendo. El título 'Test' es único y no
-- tiene aristas, así que no hace falta acotar más.
delete from public.knowledge_nodes
 where document_title = 'Test';

-- Los otros dos: se va el chunk, el documento queda.
delete from public.knowledge_nodes
 where document_title = 'Transbank — Integracion Completa Chile'
   and public.contenido_util(content) = '•tbk. | DEVELOPERS - Referencia Api';

delete from public.knowledge_nodes
 where document_title = 'Capital Efficiency — Burn Rate, Runway, NRR y Burn Multiple'
   and public.contenido_util(content) = 'Disponible en validation.ts y propagado a PDFData en pdf.ts.';

commit;
