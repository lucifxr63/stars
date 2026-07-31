-- pjud_suprema_detalle — causas de la Corte Suprema, una fila por causa.
--
-- QUÉ ES Y POR QUÉ VA APARTE DE pjud_estadisticas
-- `pjud_estadisticas` guarda SERIES: pares categoría/valor por año. Esto es otra
-- cosa. Los endpoints `_detalle` no son agregados: son causa por causa, con rol,
-- libro, tipo de recurso, sala y fechas. Meterlos en la tabla de series
-- obligaría a inventarles una "categoría" y perdería justo lo que los hace
-- valiosos: el grano.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LO QUE SE MIDIÓ ANTES DE ESCRIBIR ESTO (2026-07-31, año 2024)
-- ══════════════════════════════════════════════════════════════════════════
--
--   serie                              filas    peso      descarga
--   inventario_suprema_detalle         7.469    2,2 MB    0,4 s
--   ingresos_recursos_suprema_detalle  62.009   21,1 MB   3,0 s
--   terminos_suprema_detalle           95.075   36,5 MB   5,3 s
--
-- La API es RÁPIDA. Una medición previa sugería ~44 s para 2 MB y de ahí se
-- dedujo que las series grandes eran inviables: era falso, estaba midiendo la
-- lentitud del cliente HTTP que se usó para probar, no la de la fuente.
--
-- `terminos_sala_suprema_detalle` NO se ingiere: devuelve un payload IDÉNTICO
-- byte a byte a `terminos_suprema_detalle` (mismo SHA256, mismos 36.536.309
-- bytes). No es "lo mismo desglosado por sala" como sugería la documentación;
-- es el mismo endpoint con otro nombre. Ingerir ambas serían 95.075 filas
-- duplicadas por año.
--
-- La API NO pagina: ?page, ?limit y ?offset se ignoran y siempre devuelve el
-- conjunto entero. La ingesta trocea del lado nuestro, no del suyo.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LA IDENTIDAD DE UNA FILA NO ES LA CAUSA
-- ══════════════════════════════════════════════════════════════════════════
-- (LIBRO, ROL, ANO_ROL) parece la clave natural y NO alcanza para los términos:
-- 95.075 filas dan 95.064 combinaciones. Los 11 casos no son duplicados —
-- son causas terminadas DOS VECES. Por ejemplo Familia|241225|2023 aparece como
-- "Inadmisibles" el 2024-01-25 y como "Rechazados" el 2024-12-16.
--
-- Con FECHA_FALLO la cuenta da exactamente 95.075. En inventario e ingresos
-- (que no traen FECHA_FALLO) (LIBRO, ROL, ANO_ROL) ya es único.
--
-- Un UNIQUE mal elegido acá no da error: el upsert pisa filas y se pierden
-- términos en silencio. De ahí el cuidado.

create table if not exists public.pjud_suprema_detalle (
  id                      bigint generated always as identity primary key,

  -- Qué endpoint la trajo. Sin esto no se distingue una causa terminada de una
  -- en inventario: comparten casi toda la forma.
  serie                   text        not null,
  -- Año consultado. NO viene en la fila de `terminos` (no trae campo ANO), así
  -- que sale del parámetro de la consulta.
  anio                    integer     not null,

  -- Identidad de la causa.
  libro                   text,
  rol                     bigint,
  ano_rol                 integer,

  -- Comunes a las tres series.
  recursos                text,
  agrupador_recursos      text,
  cod_recurso             text,
  tipo_recurso            text,
  fecha_ingreso           date,

  -- Sólo en `terminos`.
  fecha_fallo             date,
  grupo_termino           text,
  sala_fallo              integer,

  -- `descripcion_sala` aparece en terminos y en ingresos; `materia*` sólo en
  -- inventario/ingresos. Todas nullable: las series no comparten esquema.
  descripcion_sala        text,
  materia                 text,
  materia_proteccion      text,

  -- La fila cruda completa, siempre.
  --
  -- Dos razones concretas, no por costumbre: (1) los campos VARÍAN ENTRE FILAS
  -- de una misma respuesta — hay filas de `terminos` con SALA_FALLO y otras sin
  -- él; (2) la fuente agrega columnas sin avisar (la documentación listaba 4
  -- campos y el endpoint devuelve 14). Conservar el original evita re-descargar
  -- 36 MB cuando aparezca una columna que interese.
  raw                     jsonb       not null,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.pjud_suprema_detalle is
  'Causas de la Corte Suprema, grano individual. Distinta de pjud_estadisticas, que guarda series agregadas.';

-- COALESCE en el índice: en PostgreSQL dos NULL NO colisionan, así que un UNIQUE
-- normal dejaría entrar duplicados apenas una causa venga sin libro o sin rol.
-- Es exactamente el bug que ya hubo que corregir en pjud_estadisticas.
--
-- `fecha_fallo` va en la clave porque una causa puede terminarse más de una vez
-- (ver arriba). Para inventario e ingresos es NULL en todas las filas, así que
-- el centinela es constante y la clave se reduce a (serie, anio, libro, rol,
-- ano_rol) — que ahí sí es única.
create unique index if not exists pjud_suprema_detalle_identidad
  on public.pjud_suprema_detalle (
    serie,
    anio,
    coalesce(libro, ''),
    coalesce(rol, -1),
    coalesce(ano_rol, -1),
    coalesce(fecha_fallo, date '1900-01-01')
  );

-- Consultas esperadas: volumen por tipo de recurso en un año, y evolución de
-- ingresos por fecha.
create index if not exists pjud_suprema_detalle_anio_tipo
  on public.pjud_suprema_detalle (anio, tipo_recurso);

create index if not exists pjud_suprema_detalle_ingreso
  on public.pjud_suprema_detalle (fecha_ingreso)
  where fecha_ingreso is not null;

alter table public.pjud_suprema_detalle enable row level security;
