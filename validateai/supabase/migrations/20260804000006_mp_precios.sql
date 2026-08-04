-- ============================================================================
-- Precios de referencia por producto — con su propia advertencia de fiabilidad
-- ============================================================================
--
-- QUÉ RESPONDE: cuánto se paga en el Estado por un producto, según lo que
-- realmente cotizaron los proveedores en compras ágiles.
--
-- POR QUÉ NO ES UN "PRECIO DE MERCADO" A SECAS, y por qué esta función devuelve
-- métricas de dispersión en vez de un número:
--
-- `precio_unitario` del payload mezcla DOS cosas incompatibles. Verificado sobre
-- el código 14111509:
--
--   cantidad=8000  "CAPSULAS BLANCAS DE PAPEL N° 11A"      ->      7  (precio real)
--   cantidad=1     "SEGUN LISTADO EN ADJUNTO"              -> 1030568  (canasta entera)
--
-- El segundo es el proveedor metiendo toda la compra en una línea y poniendo el
-- total donde va el unitario. Sin filtrar, ese código mostraba una dispersión de
-- 600x que parecía variación de mercado y era una colisión de unidades.
--
-- Se excluyen: precio <= 1 (marcadores para ítems que no se comercializan, 3,1%
-- de las líneas), cantidad = 1 y descripciones que remiten a un adjunto.
--
-- Aun así queda dispersión REAL: un código UNSPSC agrupa productos heterogéneos.
-- Tras filtrar, 44103103 queda en 4x entre máximo y mediana —coherente— mientras
-- 14111509 sigue en 174x, porque esa categoría de papel cubre desde cápsulas
-- hasta resmas. Por eso se devuelve `ratio_p75_p25`: es la señal de si la
-- mediana significa algo para ESE código. Quien consuma esto tiene que poder
-- distinguir un precio confiable de un promedio de cosas distintas.

create or replace function public.mp_precios_producto(
  p_codigo text default null,
  p_q      text default null,
  p_min_n  int  default 5
)
returns table (
  codigo_producto  text,
  nombre_producto  text,
  muestras         bigint,
  p25              numeric,
  mediana          numeric,
  p75              numeric,
  minimo           numeric,
  maximo           numeric,
  ratio_p75_p25    numeric,
  fiabilidad       text
)
language sql
stable
security definer
set search_path = public
as $$
  with limpio as (
    select i.codigo_producto, i.nombre_producto, i.precio_unitario
      from public.mp_oferta_items i
     where i.codigo_producto is not null
       and i.precio_unitario > 1
       and i.cantidad > 1
       and coalesce(i.descripcion, '') !~* 'adjunt|listado'
       and (p_codigo is null or i.codigo_producto = p_codigo)
       and (p_q is null or i.nombre_producto ilike '%' || p_q || '%')
  )
  select
    l.codigo_producto,
    (array_agg(l.nombre_producto order by length(l.nombre_producto) desc))[1],
    count(*),
    round((percentile_cont(0.25) within group (order by l.precio_unitario))::numeric),
    round((percentile_cont(0.50) within group (order by l.precio_unitario))::numeric),
    round((percentile_cont(0.75) within group (order by l.precio_unitario))::numeric),
    min(l.precio_unitario),
    max(l.precio_unitario),
    round((
      percentile_cont(0.75) within group (order by l.precio_unitario)
      / nullif(percentile_cont(0.25) within group (order by l.precio_unitario), 0)
    )::numeric, 1),
    -- Umbrales elegidos mirando la distribución real, no de memoria: bajo 3x los
    -- códigos se ven homogéneos (44103103 quedó en 4x máximo/mediana) y sobre
    -- 10x son categorías que agrupan cosas distintas (14111509).
    case
      when count(*) < 10 then 'baja: pocas muestras'
      when round((percentile_cont(0.75) within group (order by l.precio_unitario)
                 / nullif(percentile_cont(0.25) within group (order by l.precio_unitario),0))::numeric, 1) <= 3
        then 'alta: precios agrupados'
      when round((percentile_cont(0.75) within group (order by l.precio_unitario)
                 / nullif(percentile_cont(0.25) within group (order by l.precio_unitario),0))::numeric, 1) <= 10
        then 'media: hay dispersión'
      else 'baja: el código agrupa productos muy distintos, la mediana no representa un precio'
    end
  from limpio l
  group by l.codigo_producto
  having count(*) >= greatest(p_min_n, 1)
  order by count(*) desc
  limit 50;
$$;

revoke all on function public.mp_precios_producto(text, text, int) from public, anon;
