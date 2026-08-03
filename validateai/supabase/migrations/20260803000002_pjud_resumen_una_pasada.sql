-- pjud_suprema_resumen: de seis escaneos a uno.
--
-- EL PROBLEMA, MEDIDO
-- Tras el backfill historico (1.706.941 filas, 2020-2025) la version original
-- tardaba:
--     con anio  : 23.928 ms
--     sin filtro: 63.701 ms   -> el endpoint devolvia 500
--
-- Dos causas, ambas de como estaba escrita:
--
--   1. Seis subconsultas independientes sobre el mismo CTE. Postgres las
--      resolvia por separado: seis pasadas sobre la tabla para seis GROUP BY.
--
--   2. El CTE hacia `select *`, o sea que arrastraba la columna `raw` (jsonb con
--      la fila cruda completa — 36 MB por año en el caso grande) aunque ninguna
--      agregacion la usara.
--
-- LA CORRECCION
-- Se proyectan SOLO las seis columnas que se agrupan, y se usa GROUPING SETS
-- para obtener todos los cortes en UNA sola pasada. El pivot a JSON se hace
-- sobre el resultado ya agregado, que son decenas de filas, no millones.

create or replace function public.pjud_suprema_resumen(
  p_anio  integer default null,
  p_serie text    default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as materialized (
    -- Sólo lo que se agrupa. Traer `raw` acá era leer el payload entero para
    -- después descartarlo.
    select anio, serie, libro, tipo_recurso, descripcion_sala, grupo_termino
      from public.pjud_suprema_detalle
     where (p_anio  is null or anio  = p_anio)
       and (p_serie is null or serie = p_serie)
  ),
  agg as (
    select
      grouping(anio)             as g_anio,
      grouping(serie)            as g_serie,
      grouping(libro)            as g_libro,
      grouping(tipo_recurso)     as g_tipo,
      grouping(descripcion_sala) as g_sala,
      grouping(grupo_termino)    as g_grupo,
      anio, serie, libro, tipo_recurso, descripcion_sala, grupo_termino,
      count(*) as n
    from base
    group by grouping sets (
      (),                    -- total
      (anio),
      (serie),
      (libro),
      (tipo_recurso),
      (descripcion_sala),
      (grupo_termino)
    )
  )
  select jsonb_build_object(
    'total', coalesce((
      select n from agg
       where g_anio = 1 and g_serie = 1 and g_libro = 1
         and g_tipo = 1 and g_sala = 1 and g_grupo = 1
    ), 0),
    'anios', coalesce((
      select jsonb_agg(jsonb_build_object('anio', anio, 'total', n) order by anio desc)
        from agg where g_anio = 0
    ), '[]'::jsonb),
    'por_serie', coalesce((
      select jsonb_agg(jsonb_build_object('serie', serie, 'total', n) order by n desc)
        from agg where g_serie = 0
    ), '[]'::jsonb),
    'por_libro', coalesce((
      select jsonb_agg(jsonb_build_object('libro', libro, 'total', n) order by n desc)
        from agg where g_libro = 0 and libro is not null
    ), '[]'::jsonb),
    -- Recortados a 15: hay decenas de tipos y salas, y la cola larga entera no
    -- la mira nadie.
    'por_tipo_recurso', coalesce((
      select jsonb_agg(x order by (x->>'total')::bigint desc) from (
        select jsonb_build_object('tipo_recurso', tipo_recurso, 'total', n) as x
          from agg where g_tipo = 0 and tipo_recurso is not null
         order by n desc limit 15
      ) s
    ), '[]'::jsonb),
    'por_sala', coalesce((
      select jsonb_agg(x order by (x->>'total')::bigint desc) from (
        select jsonb_build_object('sala', descripcion_sala, 'total', n) as x
          from agg where g_sala = 0 and descripcion_sala is not null
         order by n desc limit 15
      ) s
    ), '[]'::jsonb),
    -- Sólo tiene sentido en la serie de terminos; en las otras viene vacio y
    -- eso ya es informativo.
    'por_grupo_termino', coalesce((
      select jsonb_agg(jsonb_build_object('grupo_termino', grupo_termino, 'total', n) order by n desc)
        from agg where g_grupo = 0 and grupo_termino is not null
    ), '[]'::jsonb)
  );
$$;

comment on function public.pjud_suprema_resumen is
  'Conteos por dimension de pjud_suprema_detalle en UNA pasada (GROUPING SETS). Ver la migracion para el porque.';

revoke all on function public.pjud_suprema_resumen(integer, text) from public, anon;
grant execute on function public.pjud_suprema_resumen(integer, text) to service_role, authenticated;
