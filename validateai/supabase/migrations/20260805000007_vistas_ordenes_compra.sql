-- 20260805000007_vistas_ordenes_compra.sql
--
-- Expone las órdenes de compra al gateway.
--
-- POR QUÉ HACEN FALTA VISTAS Y NO ALCANZA EL FDW
-- ----------------------------------------------
-- La migración anterior dejó las tablas en el esquema `licitus`, y el gateway
-- consulta por PostgREST (`supabase.from(...)`), que **sólo sirve los esquemas
-- que tiene expuestos** — en la práctica `public`. Una tabla foránea en otro
-- esquema es invisible para él aunque los permisos estén bien.
--
-- Dos vistas en `public` lo resuelven sin exponer el esquema entero ni tocar la
-- configuración de la API.
--
-- QUÉ SE DEJA AFUERA, A PROPÓSITO
-- -------------------------------
-- `raw_payload_json` y `normalized_payload_json`. Son el volcado crudo de
-- ChileCompra: varios KB por fila, 357 MB en total. Devolverlos en un listado
-- de 25 filas haría respuestas de megabytes por una comodidad que nadie pidió,
-- y mete en la respuesta campos que nunca se revisaron uno por uno. Si más
-- adelante hace falta un campo de ahí, se agrega explícito.

begin;

-- ── Listado ──────────────────────────────────────────────────────────────

create or replace view public.mp_ordenes_compra as
  select po.external_code,
         po.licitation_code,
         po.order_type_code,
         po.order_type_label,
         po.state_code,
         po.supplier_state_label,
         po.buyer_org_code,
         po.buyer_org_name,
         po.supplier_code,
         po.supplier_name,
         po.total_net,
         po.taxes,
         po.total,
         po.currency,
         po.issued_at,
         po.accepted_at,
         po.created_at,
         -- Marca explícita de si la fila tiene contenido o es sólo el
         -- identificador. Medido el 2026-08-05: de 125.273 órdenes, **73.085
         -- son cáscaras** — cero con organismo, cero con proveedor, cero con
         -- tipo; lo único que traen es `external_code` y `state_code`.
         --
         -- No es un hueco al azar: `sync-ordenes` inserta el identificador y
         -- `enrich-ordenes` lo completa después. Ese segundo job figura como
         -- «NUNCA TERMINA (huérfanas)» y sólo alcanzó a hacer 255 intentos
         -- para las 73.085 pendientes. Las enriquecidas se crearon hasta el
         -- 21-jul; todo lo posterior al 16-jul está sin completar.
         --
         -- Se expone como columna y no se filtra acá para que el hueco sea
         -- VISIBLE y contable. Filtrar en silencio haría que 73.085 filas
         -- desaparecieran sin que nadie se entere de que el enriquecimiento
         -- está roto.
         (po.total is not null) as enriquecida
    from licitus.purchase_orders po;

comment on view public.mp_ordenes_compra is
  'Órdenes de compra de ChileCompra. Viven en el proyecto szzibobuwgcopewmnkkl '
  'y se leen por FDW: son datos EN VIVO, no una copia. Sin los payloads crudos '
  'a propósito. Escribe mp-sync; acá es de sólo lectura. Ver 20260805000005.';

-- ── Ítems ────────────────────────────────────────────────────────────────
--
-- Se expone `external_code` de la orden y no su `id` interno: el id es la clave
-- del otro proyecto y no significa nada para quien consume la API, mientras que
-- el código externo es el que aparece en la ficha pública.

create or replace view public.mp_ordenes_compra_items as
  select po.external_code as orden_external_code,
         i.line_number,
         i.product_code,
         i.category_code,
         i.category_name,
         i.buyer_spec,
         i.supplier_spec,
         i.quantity,
         i.unit_net_price,
         i.total
    from licitus.purchase_order_items i
    join licitus.purchase_orders po on po.id = i.purchase_order_id;

comment on view public.mp_ordenes_compra_items is
  'Ítems de las órdenes de compra, enlazados por el código externo de la orden '
  'y no por el id interno del otro proyecto. Ver 20260805000005.';

-- ── Permisos ─────────────────────────────────────────────────────────────
--
-- Sólo el gateway, que es quien aplica cuota y registra consumo. Un cliente
-- que llegara por PostgREST directo se saltearía las dos cosas.

revoke all on public.mp_ordenes_compra        from public, anon, authenticated;
revoke all on public.mp_ordenes_compra_items  from public, anon, authenticated;
grant select on public.mp_ordenes_compra       to service_role;
grant select on public.mp_ordenes_compra_items to service_role;

commit;
