-- pjud_suprema_tendencias — las series por año que hoy sólo calcula el tablero.
--
-- POR QUÉ
-- El tablero de la sala de control calcula la tasa de confirmación y la duración
-- media por año, pero un cliente de la API no puede pedirlas: tendría que
-- bajarse las causas y agregarlas él. Con 1.706.941 filas eso no es una opción.
--
-- Lo valioso no es la serie global —esa se puede mirar una vez— sino poder
-- cortarla: "cómo evolucionó la confirmación de las apelaciones de protección",
-- "la Sala Tercera siempre tardó lo mismo". De ahí que acepte filtros.
--
-- DECISIÓN: sólo sobre `terminos_suprema_detalle`.
-- Es la única serie donde estas métricas significan algo: `grupo_termino` y
-- `fecha_fallo` no existen en ingresos ni en inventario. Calcularlas sobre las
-- tres mezclaría universos distintos y daría promedios sin sentido.

create or replace function public.pjud_suprema_tendencias(
  p_libro text default null,
  p_tipo  text default null,
  p_sala  text default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as materialized (
    select anio, grupo_termino, fecha_fallo, fecha_ingreso
      from public.pjud_suprema_detalle
     where serie = 'terminos_suprema_detalle'
       and (p_libro is null or libro = p_libro)
       -- ilike en tipo y sala: son descripciones largas ("(Civil) Apelación
       -- Protección", "Tercera, CONSTITUCIONAL") y nadie las escribe completas.
       and (p_tipo  is null or tipo_recurso     ilike '%' || p_tipo || '%')
       and (p_sala  is null or descripcion_sala ilike '%' || p_sala || '%')
  ),
  por_anio as (
    select anio,
           count(*)                                                    as terminos,
           count(*) filter (where grupo_termino = 'Confirmados')        as confirmados,
           count(*) filter (where grupo_termino = 'Revocados')          as revocados,
           count(*) filter (where grupo_termino = 'Inadmisibles')       as inadmisibles,
           round(100.0 * count(*) filter (where grupo_termino = 'Confirmados')
                 / nullif(count(*), 0), 1)                             as pct_confirmados,
           round(100.0 * count(*) filter (where grupo_termino = 'Revocados')
                 / nullif(count(*), 0), 1)                             as pct_revocados,
           -- Sólo sobre las filas que tienen ambas fechas: promediar tratando
           -- un NULL como cero inventaría causas instantáneas.
           round(avg(fecha_fallo - fecha_ingreso)
                 filter (where fecha_fallo is not null
                           and fecha_ingreso is not null))             as dias_promedio,
           count(*) filter (where fecha_fallo is not null
                              and fecha_ingreso is not null)           as con_ambas_fechas
      from base
     group by anio
  )
  select jsonb_build_object(
    'filtros', jsonb_build_object('libro', p_libro, 'tipo_recurso', p_tipo, 'sala', p_sala),
    'total', coalesce((select sum(terminos) from por_anio), 0),
    'series', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'anio', anio,
          'terminos', terminos,
          'confirmados', confirmados,
          'revocados', revocados,
          'inadmisibles', inadmisibles,
          'pct_confirmados', pct_confirmados,
          'pct_revocados', pct_revocados,
          'dias_promedio', dias_promedio,
          -- Se expone para que el consumidor sepa sobre cuántas filas se
          -- calculó el promedio: si es una fracción del total, el número no
          -- representa al año.
          'con_ambas_fechas', con_ambas_fechas
        ) order by anio
      ) from por_anio
    ), '[]'::jsonb)
  );
$$;

comment on function public.pjud_suprema_tendencias is
  'Series por año (volumen, composicion y duracion) sobre terminos_suprema_detalle, con filtros por libro, tipo y sala.';

revoke all on function public.pjud_suprema_tendencias(text, text, text) from public, anon;
grant execute on function public.pjud_suprema_tendencias(text, text, text) to service_role, authenticated;
