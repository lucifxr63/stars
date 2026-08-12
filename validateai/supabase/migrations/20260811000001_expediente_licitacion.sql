-- ============================================================================
-- Expediente de licitación: abrir lo que la ingesta ya extraía y descartaba.
--
-- CONTEXTO
-- --------
-- Un integrador del MCP reportó siete campos faltantes para armar un expediente
-- de licitación. Al revisar la cadena MP → mp-sync → tabla canónica, tres de
-- ellos (cronograma, contacto/región, semántica del monto) resultaron estar YA
-- extraídos por el normalizador —que produce ~60 campos— y descartados por
-- `canonical.mapper.ts`, que escribía 17 columnas. Un cuarto (documentos) sólo
-- existe en Compra Ágil y también se estaba tirando.
--
-- Esta migración agrega las columnas y las rellena desde `raw_payload`, que
-- guarda la ficha completa. NO se le pide nada a Mercado Público: el ticket
-- está con la cuota diaria agotada y de todos modos no hace falta.
--
-- Lo que NO resuelve, porque la fuente no lo entrega (verificado sobre las
-- 15.387 fichas de licitación guardadas: ninguna trae estas claves):
--   · bases administrativas y técnicas de LICITACIÓN (Compra Ágil sí las lista)
--   · criterios de evaluación con ponderación
--   · garantías exigidas
--   · requisitos de habilidad de los oferentes
-- Eso requiere otra fuente (ficha web o Datos Abiertos) y es decisión aparte.
-- ============================================================================

-- ── 1. Conversión de hora ────────────────────────────────────────────────────
--
-- MP publica los timestamps sin zona y en hora de Chile. `parseDate` en el
-- normalizador los resolvía con `new Date(str)`, que usa la zona DEL PROCESO,
-- así que `closing_at` terminó con TRES convenios mezclados en la misma
-- columna: +4 h y +3 h (backfill corrido en una máquina con TZ de Santiago,
-- invierno y verano) y +0 h (mp-sync en Vercel, que corre en UTC).
--
-- Medido antes de esta migración: 2.111 de las 2.115 licitaciones abiertas
-- tenían la hora de cierre corrida 3–4 horas, y las 44.237 compras ágiles
-- también. ~47.900 de 59.932 filas (80 %).
--
-- `AT TIME ZONE 'America/Santiago'` aplica el horario de verano vigente en cada
-- fecha, que es justo lo que un offset fijo no puede hacer: Chile cambió sus
-- reglas en 2015, 2016 y 2019.

create or replace function mp_ts_chile(txt text)
returns timestamptz
language plpgsql
-- STABLE y no IMMUTABLE a propósito: la rama con zona explícita usa
-- `::timestamptz`, que depende del GUC TimeZone de la sesión. Declararla
-- immutable permitiría indexarla y hornear resultados que pueden cambiar.
stable
as $$
begin
  if txt is null or btrim(txt) = '' then
    return null;
  end if;

  -- Con zona explícita (…Z o …±HH:MM) el string ya es inequívoco: se respeta.
  -- La API v2 de Compra Ágil mezcla ambos formatos en el mismo objeto.
  if btrim(txt) ~ '(Z|[+-][0-9]{2}:?[0-9]{2})$' then
    return btrim(txt)::timestamptz;
  end if;

  return btrim(txt)::timestamp at time zone 'America/Santiago';
exception when others then
  -- Un valor basura no debe abortar el backfill de 60.000 filas.
  return null;
end;
$$;

comment on function mp_ts_chile(text) is
  'Interpreta un timestamp de Mercado Público. Sin zona = hora de Chile (DST-aware); con zona = se respeta.';

-- ── 2. Columnas nuevas ───────────────────────────────────────────────────────

alter table licitaciones_mercado_publico
  -- Cronograma. Antes sólo había published_at / closing_at / award_at.
  add column if not exists forum_start_at        timestamptz,
  add column if not exists forum_end_at          timestamptz,
  add column if not exists answers_published_at  timestamptz,
  add column if not exists technical_opening_at  timestamptz,
  add column if not exists economic_opening_at   timestamptz,
  add column if not exists site_visit_at         timestamptz,
  add column if not exists documents_deadline_at timestamptz,
  add column if not exists estimated_award_at    timestamptz,
  add column if not exists estimated_sign_at     timestamptz,
  -- Comprador y contacto. Antes sólo llegaba el nombre del organismo.
  add column if not exists buyer_unit_code            text,
  add column if not exists buyer_unit_name            text,
  add column if not exists buyer_region               text,
  add column if not exists buyer_commune              text,
  add column if not exists buyer_address              text,
  add column if not exists buyer_contact_name         text,
  add column if not exists buyer_contact_role         text,
  add column if not exists contract_responsible_name  text,
  add column if not exists contract_responsible_email text,
  add column if not exists contract_responsible_phone text,
  -- Semántica del monto.
  add column if not exists amount_is_public       boolean,
  add column if not exists amount_estimation_type smallint,
  add column if not exists amount_justification   text;

comment on column licitaciones_mercado_publico.amount_is_public is
  'VisibilidadMonto. false = el organismo ocultó el presupuesto; amount_estimated = 0 NO significa que no exista.';
comment on column licitaciones_mercado_publico.amount_estimation_type is
  'Estimacion de MP: 1=Presupuesto, 2=Precio referencial, 3=No estimable.';
comment on column licitaciones_mercado_publico.attachments is
  'Documentos oficiales [{id, nombre, url}]. Sólo Compra Ágil los publica por API; url va null porque la fuente no entrega enlace de descarga. En licitaciones va vacío: la API v1 no los expone.';

-- ── 3. Backfill: licitaciones, convenio marco y trato directo ────────────────
-- Estructura v1: Fechas / Comprador / MontoEstimado en la raíz del payload.

update licitaciones_mercado_publico set
  -- Se recalculan también las tres que ya existían: son las que tenían la hora
  -- corrida. `coalesce(..., <actual>)` deja intacta la fila cuyo raw no traiga
  -- el dato, en vez de borrar lo que había.
  published_at = coalesce(
    mp_ts_chile(raw_payload->'Fechas'->>'FechaPublicacion'),
    mp_ts_chile(raw_payload->>'FechaPublicacion'),
    published_at),
  closing_at = coalesce(
    mp_ts_chile(raw_payload->'Fechas'->>'FechaCierre'),
    mp_ts_chile(raw_payload->>'FechaCierre'),
    closing_at),
  award_at = coalesce(
    mp_ts_chile(raw_payload->'Fechas'->>'FechaAdjudicacion'),
    mp_ts_chile(raw_payload->>'FechaAdjudicacion'),
    award_at),

  forum_start_at        = mp_ts_chile(raw_payload->'Fechas'->>'FechaInicio'),
  forum_end_at          = mp_ts_chile(raw_payload->'Fechas'->>'FechaFinal'),
  answers_published_at  = mp_ts_chile(raw_payload->'Fechas'->>'FechaPubRespuestas'),
  technical_opening_at  = mp_ts_chile(raw_payload->'Fechas'->>'FechaActoAperturaTecnica'),
  economic_opening_at   = mp_ts_chile(raw_payload->'Fechas'->>'FechaActoAperturaEconomica'),
  site_visit_at         = mp_ts_chile(raw_payload->'Fechas'->>'FechaVisitaTerreno'),
  documents_deadline_at = mp_ts_chile(raw_payload->'Fechas'->>'FechaEntregaAntecedentes'),
  estimated_award_at    = mp_ts_chile(raw_payload->'Fechas'->>'FechaEstimadaAdjudicacion'),
  estimated_sign_at     = mp_ts_chile(raw_payload->'Fechas'->>'FechaEstimadaFirma'),

  -- MP devuelve campos presentes pero vacíos (`RutUsuario: ""`) y regiones con
  -- espacio al final ("Región del Biobío "). nullif(btrim(...)) para que un
  -- string vacío no se guarde como si fuera un dato.
  buyer_rut         = nullif(btrim(coalesce(raw_payload->'Comprador'->>'RutUnidad', raw_payload->'Unidad'->>'RutUnidad')), ''),
  buyer_unit_code   = nullif(btrim(coalesce(raw_payload->'Comprador'->>'CodigoUnidad', raw_payload->'Unidad'->>'Codigo')), ''),
  buyer_unit_name   = nullif(btrim(coalesce(raw_payload->'Comprador'->>'NombreUnidad', raw_payload->'Unidad'->>'Nombre')), ''),
  buyer_region      = nullif(btrim(coalesce(raw_payload->'Comprador'->>'RegionUnidad', raw_payload->'Unidad'->>'RegionUnidad')), ''),
  buyer_commune     = nullif(btrim(coalesce(raw_payload->'Comprador'->>'ComunaUnidad', raw_payload->'Unidad'->>'ComunaUnidad')), ''),
  buyer_address     = nullif(btrim(coalesce(raw_payload->'Comprador'->>'DireccionUnidad', raw_payload->'Unidad'->>'DireccionUnidad')), ''),
  buyer_contact_name = nullif(btrim(raw_payload->'Comprador'->>'NombreUsuario'), ''),
  buyer_contact_role = nullif(btrim(raw_payload->'Comprador'->>'CargoUsuario'), ''),

  contract_responsible_name  = nullif(btrim(raw_payload->>'NombreResponsableContrato'), ''),
  contract_responsible_email = nullif(btrim(raw_payload->>'EmailResponsableContrato'), ''),
  contract_responsible_phone = nullif(btrim(raw_payload->>'FonoResponsableContrato'), ''),

  amount_is_public       = case raw_payload->>'VisibilidadMonto' when '1' then true when '0' then false else null end,
  amount_estimation_type = nullif(raw_payload->>'Estimacion', '')::smallint,
  amount_justification   = nullif(btrim(raw_payload->>'JustificacionMontoEstimado'), ''),

  updated_at = now()
where source_type in ('tender', 'private_tender', 'convenio_marco', 'trato_directo',
                      'grandes_compras', 'consulta_mercado', 'contrato_publico', 'nuevos_mecanismos')
  and raw_payload ? 'Fechas';

-- ── 4. Backfill: compra ágil ─────────────────────────────────────────────────
-- Estructura v2: {listado, detalle}, con fechas/institucion/presupuesto anidados
-- y —lo importante— `documentos`, que es el único mecanismo de MP que publica
-- sus bases por API. Estaban guardadas y la API respondía `attachments: []`.

update licitaciones_mercado_publico set
  published_at = coalesce(
    mp_ts_chile(raw_payload->'detalle'->'fechas'->>'fecha_publicacion'),
    mp_ts_chile(raw_payload->'listado'->'fechas'->>'fecha_publicacion'),
    published_at),
  closing_at = coalesce(
    mp_ts_chile(raw_payload->'detalle'->'fechas'->>'fecha_cierre'),
    mp_ts_chile(raw_payload->'listado'->'fechas'->>'fecha_cierre'),
    closing_at),

  buyer_rut       = nullif(btrim(raw_payload->'detalle'->'institucion'->>'rut'), ''),
  buyer_unit_name = nullif(btrim(raw_payload->'detalle'->'institucion'->>'unidad_compra'), ''),
  buyer_region    = nullif(btrim(raw_payload->'detalle'->'institucion'->>'nombre_region'), ''),

  -- En Compra Ágil el presupuesto disponible siempre es público.
  amount_is_public = true,

  attachments = coalesce(
    (select jsonb_agg(jsonb_build_object(
              'id', d->>'id',
              'nombre', btrim(d->>'nombre'),
              -- La fuente da id y nombre, nunca enlace. Se expone en null para
              -- que el consumidor sepa que el campo existe y quién no lo llena.
              'url', null))
     from jsonb_array_elements(raw_payload->'detalle'->'documentos') d),
    '[]'::jsonb),

  updated_at = now()
where source_type = 'agile_purchase'
  and raw_payload ? 'detalle';

-- ── 5. Índices ───────────────────────────────────────────────────────────────
-- `buyer_region` es el filtro obvio del caso de uso que motivó todo esto
-- ("licitaciones abiertas en mi región"), y hasta hoy no existía la columna.

create index if not exists idx_lmp_buyer_region on licitaciones_mercado_publico (buyer_region);
create index if not exists idx_lmp_buyer_rut    on licitaciones_mercado_publico (buyer_rut);
