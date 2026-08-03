-- Índice de cobertura para el resumen de la Corte Suprema.
--
-- Con 1.706.941 filas (2020-2025) el resumen agrupa por seis dimensiones. Aun
-- resuelto en UNA pasada con GROUPING SETS (ver la migración anterior), seguía
-- costando un escaneo secuencial de la tabla entera.
--
-- Este índice contiene exactamente las seis columnas que se agrupan, así que
-- Postgres puede resolverlo con un index-only scan y no tocar el heap — donde
-- además vive `raw`, el jsonb con la fila cruda.
--
-- MEDIDO sobre el resumen global (sin filtros):
--     versión original (6 escaneos, select *) : 63.701 ms  -> el endpoint daba 500
--     una pasada con GROUPING SETS            :  7.511 ms
--     + este índice                           :  3.507 ms
--
-- Cuesta espacio (seis columnas por 1,7 millones de filas). Se acepta: la tabla
-- se escribe una vez al mes y se consulta seguido, que es exactamente cuando un
-- índice ancho conviene.
create index if not exists pjud_suprema_detalle_resumen
  on public.pjud_suprema_detalle (anio, serie, libro, tipo_recurso, descripcion_sala, grupo_termino);
