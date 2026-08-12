-- ============================================================================
-- Dos cosas que un integrador recibe mal desde `/mercado-publico`.
--
-- 1. El directorio de organismos cuenta compras, no compradores.
-- 2. `attachments` tiene tres formas distintas conviviendo.
-- ============================================================================


-- ── 1. Vista de organismos ───────────────────────────────────────────────────
--
-- EL PROBLEMA. `/mercado-publico/organismos` no lee un directorio: pagina sobre
-- las 60.528 filas de oportunidades y deduplica **dentro de cada página**. Con
-- `page_size=20` puede devolver 3 compradores informando `meta.total = 60.528`,
-- y repetir esos mismos compradores en la página siguiente. La documentación
-- decía "33.682 organismos", que era el conteo de filas de aquel día.
--
-- POR QUÉ NO SE AGRUPA POR `buyer_org_code`. Esa columna guarda cosas distintas
-- según la vía de compra, y mezclarlas produce un directorio incomparable:
--
--   · compra ágil  → un RUT           (44.545 filas, formato 12.345.678-9)
--   · licitación   → un código interno (15.983 filas, formato 7067)
--
-- El mismo organismo aparece con dos identificadores según por dónde compró:
-- el MOP figura como `61.202.000-0` y también como `7067`. Agrupar por ahí da
-- 2.705 "organismos" que en realidad son dos espacios de nombres sumados.
--
-- SE AGRUPA POR `buyer_rut`, que la migración del expediente dejó poblado al
-- 100 % en las CUATRO vías y es el mismo identificador en todas. Son 1.786
-- entidades compradoras reales.
--
-- `mode()` para el nombre: un mismo RUT aparece con variantes de mayúsculas y
-- espacios (1.889 nombres crudos contra 1.869 normalizados). Se elige el más
-- frecuente en vez del primero, que sería arbitrario.
create or replace view public.mp_organismos as
select
  buyer_rut                                             as rut,
  mode() within group (order by buyer_name)             as nombre,
  count(*)                                              as compras,
  count(*) filter (where closing_at > now())            as compras_abiertas,
  min(published_at)                                     as primera_publicacion,
  max(published_at)                                     as ultima_publicacion,
  array_agg(distinct source_type)                       as vias,
  -- Se conservan los códigos internos porque son los que aparecen en la ficha
  -- oficial de Mercado Público: sin ellos no se puede cruzar hacia afuera.
  array_agg(distinct buyer_org_code)                    as codigos_organismo,
  mode() within group (order by buyer_region)           as region
from licitaciones_mercado_publico
where buyer_rut is not null
group by buyer_rut;

comment on view public.mp_organismos is
  'Directorio de entidades compradoras, una fila por buyer_rut (1.786 al 2026-08-12). '
  'NO agrupa por buyer_org_code: esa columna guarda un RUT en compra ágil y un código '
  'interno en licitación, así que el mismo organismo saldría dos veces.';


-- ── 2. Normalizar la forma de `attachments` ──────────────────────────────────
--
-- EL PROBLEMA. Hoy conviven tres formas y un consumidor que lea `descargable`
-- recibe `undefined` en el 99 % de las compras ágiles:
--
--   {id, nombre, url}                                  31.668  relleno histórico
--   {id, nombre, url, tipo, origen, descargable}          238  ingesta nueva
--   {…, obtenido_at}                                    5.669  licitación y resto
--
-- Las 31.668 las escribió el backfill del expediente, que sólo copiaba `id` y
-- `nombre` del payload. El normalizador de mp-sync ya produce la forma completa
-- (`NormalizedAttachment`), así que lo que falta es alinear lo viejo.
--
-- POR QUÉ `descargable` VA EN false Y NO SE INTENTA UNA URL. Verificado contra
-- la fuente el 2026-08-12: Compra Ágil publica el nombre del archivo y NUNCA un
-- enlace, y el enlace que sí traen las licitaciones apunta a una página con
-- reCAPTCHA Enterprise, no a un archivo. `descargable` es false en ambos casos y
-- ponerlo explícito es lo que evita que alguien ofrezca una descarga que no
-- existe.
update licitaciones_mercado_publico
set attachments = (
      select jsonb_agg(
               a || jsonb_build_object(
                 'tipo', 'archivo',
                 'origen', 'compra_agil',
                 'descargable', false
               )
               order by ordinalidad
             )
      from jsonb_array_elements(attachments) with ordinality as t(a, ordinalidad)
    ),
    updated_at = now()
where source_type = 'agile_purchase'
  and jsonb_array_length(coalesce(attachments, '[]'::jsonb)) > 0
  -- Sólo las que les falta la clave: correr esto dos veces no debe reescribir
  -- las que ya están bien ni tocar su updated_at.
  and not (attachments -> 0 ? 'descargable');
