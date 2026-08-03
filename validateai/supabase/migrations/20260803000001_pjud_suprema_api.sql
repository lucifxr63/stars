-- Soporte de consulta para los endpoints de la Corte Suprema.
--
-- La tabla se creó pensando en la INGESTA (índice único por identidad, e índices
-- por anio+tipo y por fecha_ingreso). Consultarla desde la API pide dos cosas
-- más, y ninguna es opcional con 124.245 filas.

-- 1. Buscar UNA causa por su identidad natural.
--
-- El índice único empieza por (serie, anio, ...), así que sirve para el upsert
-- pero NO para "dame la causa Familia-241225-2023", que no conoce la serie: sin
-- este índice esa consulta es un seq scan de la tabla entera.
--
-- Y una causa aparece en varias series a la vez —ingresó, terminó, y quizás
-- sigue en inventario—, que es justo lo que el endpoint de detalle quiere
-- devolver junto.
create index if not exists pjud_suprema_detalle_causa
  on public.pjud_suprema_detalle (libro, rol, ano_rol);

-- 2. Resumen agregado sin traer las filas.
--
-- Agrupar del lado del cliente exigiría descargar 124.245 registros para contar.
-- Esto lo resuelve la base y devuelve un solo JSON.
--
-- `security definer` porque la tabla tiene RLS activo y no hay política de
-- lectura pública: el acceso se controla en el gateway (API key + rate limit),
-- no acá. Se fija el search_path para que no se pueda secuestrar por
-- resolución de nombres.
create or replace function public.pjud_suprema_resumen(
  p_anio  integer default null,
  p_serie text    default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select *
      from public.pjud_suprema_detalle
     where (p_anio  is null or anio  = p_anio)
       and (p_serie is null or serie = p_serie)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'anios', (
      select coalesce(jsonb_agg(x order by x->>'anio' desc), '[]'::jsonb)
        from (select jsonb_build_object('anio', anio, 'total', count(*)) as x
                from base group by anio) s
    ),
    'por_serie', (
      select coalesce(jsonb_agg(x order by (x->>'total')::bigint desc), '[]'::jsonb)
        from (select jsonb_build_object('serie', serie, 'total', count(*)) as x
                from base group by serie) s
    ),
    'por_libro', (
      select coalesce(jsonb_agg(x order by (x->>'total')::bigint desc), '[]'::jsonb)
        from (select jsonb_build_object('libro', libro, 'total', count(*)) as x
                from base group by libro) s
    ),
    -- Se recortan a 15: hay decenas de tipos y salas, y una respuesta con la
    -- cola larga entera no la mira nadie.
    'por_tipo_recurso', (
      select coalesce(jsonb_agg(x order by (x->>'total')::bigint desc), '[]'::jsonb)
        from (select jsonb_build_object('tipo_recurso', tipo_recurso, 'total', count(*)) as x
                from base where tipo_recurso is not null
               group by tipo_recurso order by count(*) desc limit 15) s
    ),
    'por_sala', (
      select coalesce(jsonb_agg(x order by (x->>'total')::bigint desc), '[]'::jsonb)
        from (select jsonb_build_object('sala', descripcion_sala, 'total', count(*)) as x
                from base where descripcion_sala is not null
               group by descripcion_sala order by count(*) desc limit 15) s
    ),
    -- Sólo tiene sentido en la serie de términos; en las otras viene vacío y
    -- eso ya es informativo.
    'por_grupo_termino', (
      select coalesce(jsonb_agg(x order by (x->>'total')::bigint desc), '[]'::jsonb)
        from (select jsonb_build_object('grupo_termino', grupo_termino, 'total', count(*)) as x
                from base where grupo_termino is not null
               group by grupo_termino) s
    )
  );
$$;

comment on function public.pjud_suprema_resumen is
  'Conteos por dimension de pjud_suprema_detalle. Agrupa en la base para no bajar 124.245 filas.';

revoke all on function public.pjud_suprema_resumen(integer, text) from public, anon;
grant execute on function public.pjud_suprema_resumen(integer, text) to service_role, authenticated;
