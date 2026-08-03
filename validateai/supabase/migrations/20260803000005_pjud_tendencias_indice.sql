-- Índice parcial para las tendencias de la Corte Suprema.
--
-- El índice de cobertura del resumen (20260803000003) no sirve acá: no contiene
-- `fecha_fallo` ni `fecha_ingreso`, y la duración media las necesita, así que
-- cada fila obligaba a ir al heap.
--
-- Este es PARCIAL sobre la única serie donde estas métricas significan algo
-- (`terminos_suprema_detalle`, 794.935 de las 1.706.941 filas) y lleva las dos
-- fechas en INCLUDE, de modo que la consulta se resuelve sin tocar la tabla.
--
-- MEDIDO sobre las tendencias globales:
--     sin este índice : 6.114 ms
--     con este índice : 1.615 ms
--
-- Las fechas van en INCLUDE y no en la clave porque no se filtra ni se ordena
-- por ellas — sólo se promedian. Ponerlas en la clave engordaría el árbol sin
-- ganar nada.
create index if not exists pjud_suprema_tendencias_ix
  on public.pjud_suprema_detalle (anio, libro, tipo_recurso, descripcion_sala, grupo_termino)
  include (fecha_fallo, fecha_ingreso)
  where serie = 'terminos_suprema_detalle';
