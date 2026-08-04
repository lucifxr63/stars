-- ============================================================================
-- Mercado Público: sacar la competencia de dentro del JSON
-- ============================================================================
--
-- QUÉ HABÍA: cada compra ágil guarda en `raw_payload->detalle->proveedores_cotizando`
-- la licitación competitiva COMPLETA —quién cotizó, cuánto, quién ganó y por qué
-- se rechazó al resto— y nada de eso era consultable. Estaba ingerido y enterrado.
--
--   7.111 ofertas dentro de 1.308 compras ágiles
--   2.369 proveedores distintos, con RUT
--   1.095 adjudicaciones (una por cada compra en estado 'adjudicada')
--   1.033 con justificación de inadmisibilidad escrita
--  18.300 líneas de producto sobre 1.153 códigos distintos
--
-- POR QUÉ IMPORTA: un listado de licitaciones es commodity —está gratis en
-- mercadopublico.cl—. Saber cuántos compiten por rubro, quién gana, a qué precio
-- unitario y con qué argumento se descarta al resto, no lo tiene nadie servido.
--
-- SEMÁNTICA VERIFICADA de los códigos del payload (2026-08-04):
--   estado = 2                        -> oferta admisible   (6.078)
--   estado = 3                        -> inadmisible        (1.033, todas con motivo)
--   proveedor_seleccionado = 1        -> ganadora           (1.095)
-- Los tres grupos suman exactamente 7.111, y hay una ganadora por cada compra
-- adjudicada, así que los códigos significan lo que parecen.
--
-- SÓLO HAY DATOS DE COMPRA ÁGIL. Verificado: licitaciones, convenios marco y
-- tratos directos no traen `detalle` en absoluto. Y las ofertas aparecen recién
-- cuando el proceso concluye: 'publicada' y 'cerrada' tienen cero.

create table if not exists public.mp_ofertas (
  id                     uuid primary key default gen_random_uuid(),
  oportunidad_id         uuid not null references public.licitaciones_mercado_publico(id) on delete cascade,
  external_code          text not null,
  proveedor_rut          text not null,
  proveedor_razon_social text not null,
  monto_neto             numeric,
  monto_total            numeric,
  -- Desdoblado a booleanos para que la tabla se pueda leer sin el diccionario
  -- de códigos del payload.
  adjudicada             boolean not null default false,
  admisible              boolean not null default true,
  motivo_inadmisibilidad text,
  id_cotizacion          bigint,
  fecha_cotizacion       timestamptz,
  created_at             timestamptz not null default now()
);

comment on table public.mp_ofertas is
  'Ofertas recibidas por cada compra ágil: quién cotizó, cuánto, si ganó y por qué se rechazó. Extraído de raw_payload->detalle->proveedores_cotizando, que sólo existe en compras ágiles concluidas.';
comment on column public.mp_ofertas.proveedor_rut is
  'RUT normalizado sin puntos y con dígito verificador en mayúscula (89752800-2). En el payload viene con puntos, lo que impedía cruzarlo con cualquier otra fuente.';

create table if not exists public.mp_oferta_items (
  id              bigserial primary key,
  oferta_id       uuid not null references public.mp_ofertas(id) on delete cascade,
  codigo_producto text,
  nombre_producto text,
  descripcion     text,
  cantidad        numeric,
  precio_unitario numeric,
  monto_total     numeric
);

comment on table public.mp_oferta_items is
  'Líneas de producto de cada oferta, con precio unitario. OJO: 3,1% de las líneas traen precio 1 o menos — son marcadores que ponen los proveedores para ítems que no comercializan, no precios reales. Filtrar antes de calcular cualquier promedio.';

-- Índices sobre las tres preguntas que esta tabla existe para responder: el
-- historial de un proveedor, la competencia de una oportunidad, y el precio de
-- un producto.
create index if not exists mp_ofertas_proveedor_idx on public.mp_ofertas (proveedor_rut, adjudicada);
create index if not exists mp_ofertas_oportunidad_idx on public.mp_ofertas (oportunidad_id);
create index if not exists mp_ofertas_codigo_idx on public.mp_ofertas (external_code);
create index if not exists mp_oferta_items_producto_idx on public.mp_oferta_items (codigo_producto) where codigo_producto is not null;

alter table public.mp_ofertas enable row level security;
alter table public.mp_oferta_items enable row level security;

-- Sin política de lectura pública: se sirven por el gateway, que usa service
-- role. Es dato público por transparencia, pero eso no obliga a exponerlo sin
-- pasar por la cuota.
drop policy if exists "service role gestiona ofertas" on public.mp_ofertas;
create policy "service role gestiona ofertas" on public.mp_ofertas
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role gestiona items" on public.mp_oferta_items;
create policy "service role gestiona items" on public.mp_oferta_items
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ============================================================================
-- Extracción. Es idempotente: se puede volver a correr tras cada sync.
-- ============================================================================

create or replace function public.mp_extraer_ofertas()
returns table (ofertas_insertadas bigint, items_insertados bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ofertas bigint;
  v_items   bigint;
begin
  -- Se reconstruye completo en vez de intentar un merge incremental: son
  -- ~7.000 filas y el payload es la fuente de verdad. Un merge parcial dejaría
  -- ofertas viejas de procesos que fueron revocados.
  delete from public.mp_ofertas;

  with cot as (
    select l.id as oportunidad_id,
           l.external_code,
           jsonb_array_elements(l.raw_payload->'detalle'->'proveedores_cotizando') as pr
      from public.licitaciones_mercado_publico l
     where l.source_type = 'agile_purchase'
       and jsonb_typeof(l.raw_payload->'detalle'->'proveedores_cotizando') = 'array'
       and jsonb_array_length(l.raw_payload->'detalle'->'proveedores_cotizando') > 0
  ),
  ins as (
    insert into public.mp_ofertas (
      oportunidad_id, external_code, proveedor_rut, proveedor_razon_social,
      monto_neto, monto_total, adjudicada, admisible, motivo_inadmisibilidad,
      id_cotizacion, fecha_cotizacion
    )
    select
      cot.oportunidad_id,
      cot.external_code,
      -- Normalizado acá y no al consultar: con puntos no cruza con ninguna otra
      -- fuente del ecosistema.
      upper(replace(replace(cot.pr->>'rut_proveedor', '.', ''), ' ', '')),
      cot.pr->>'razon_social',
      nullif(cot.pr->>'valor_neto','')::numeric,
      nullif(cot.pr->>'monto_total','')::numeric,
      coalesce((cot.pr->>'proveedor_seleccionado')::int, 0) = 1,
      coalesce((cot.pr->>'estado')::int, 2) <> 3,
      nullif(trim(cot.pr->>'justificacion_inadmisibilidad'), ''),
      nullif(cot.pr->>'id_cotizacion','')::bigint,
      nullif(cot.pr->>'fecha_creacion','')::timestamptz
    from cot
    returning id, (select 1) as marca
  )
  select count(*) into v_ofertas from ins;

  -- Los items se insertan en una segunda pasada, releyendo el payload y
  -- uniendo por id_cotizacion, que es único dentro de cada oportunidad.
  with cot as (
    select l.id as oportunidad_id,
           jsonb_array_elements(l.raw_payload->'detalle'->'proveedores_cotizando') as pr
      from public.licitaciones_mercado_publico l
     where l.source_type = 'agile_purchase'
       and jsonb_typeof(l.raw_payload->'detalle'->'proveedores_cotizando') = 'array'
       and jsonb_array_length(l.raw_payload->'detalle'->'proveedores_cotizando') > 0
  ),
  lineas as (
    select o.id as oferta_id, jsonb_array_elements(cot.pr->'productos_cotizados') as it
      from cot
      join public.mp_ofertas o
        on o.oportunidad_id = cot.oportunidad_id
       and o.id_cotizacion is not distinct from nullif(cot.pr->>'id_cotizacion','')::bigint
     where jsonb_typeof(cot.pr->'productos_cotizados') = 'array'
  ),
  ins2 as (
    insert into public.mp_oferta_items
      (oferta_id, codigo_producto, nombre_producto, descripcion, cantidad, precio_unitario, monto_total)
    select lineas.oferta_id,
           lineas.it->>'codigo_producto',
           lineas.it->>'nombre_producto',
           lineas.it->>'descripcion',
           nullif(lineas.it->>'cantidad','')::numeric,
           nullif(lineas.it->>'precio_unitario','')::numeric,
           nullif(lineas.it->>'monto_total_producto','')::numeric
      from lineas
    returning 1
  )
  select count(*) into v_items from ins2;

  return query select v_ofertas, v_items;
end;
$$;

revoke all on function public.mp_extraer_ofertas() from public, anon, authenticated;
