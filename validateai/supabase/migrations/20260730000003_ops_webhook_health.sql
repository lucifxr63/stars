-- ops_webhook_health — saber cuándo un canal de avisos dejó de funcionar.
--
-- EL PROBLEMA
-- El helper de alerting nunca lanza: si Discord rechaza el envío, loguea un
-- warning, reintenta en texto plano y descarta el resultado del reintento
-- (`.catch(() => {})`). Es la decisión correcta —un fallo de alerting no debe
-- romper el flujo que lo emitió— pero deja un agujero: un webhook revocado
-- falla para siempre y sólo se ve en los logs de la plataforma.
--
-- Y es peor de lo que parece, porque el canal de `latido` existe justamente
-- para que el SILENCIO signifique algo. Si el webhook está muerto, el silencio
-- de un canal sano y el de una ingesta detenida se ven idénticos. Ese fue el
-- modo de falla que dejó Mercado Público tres días caído sin que nadie lo
-- notara; esto cierra la versión "el aviso tampoco llegaba".
--
-- LA IDEA
-- Cada intento de envío deja registro acá. La base pasa a ser la fuente de
-- verdad sobre la salud del alerting, independiente del alerting mismo — que
-- es la única forma de que un canal muerto pueda reportarse.

create table if not exists public.ops_webhook_health (
  -- Quién emitió: mp-sync (Vercel), edge-functions (Deno), bralidus (Python).
  -- Un mismo canal puede estar sano desde un servicio y roto desde otro si la
  -- variable de entorno quedó desactualizada en uno solo — que es el caso real
  -- cuando se rota una URL y se olvida un panel.
  servicio              text        not null,
  canal                 text        not null,

  ultimo_intento        timestamptz not null,
  ultimo_exito          timestamptz,
  ultimo_fallo          timestamptz,
  -- Status HTTP o mensaje. 401/404 = webhook revocado o reescrito en Discord.
  ultimo_error          text,

  -- Se resetea a 0 en cada éxito. Es lo que distingue un rebote puntual de un
  -- canal muerto.
  fallos_consecutivos   integer     not null default 0,

  envios_ok             bigint      not null default 0,
  envios_fallidos       bigint      not null default 0,

  primary key (servicio, canal)
);

comment on table public.ops_webhook_health is
  'Salud de los webhooks de alerting. Se escribe desde los 3 servicios vía registrar_envio_webhook().';

-- RPC única para los tres lenguajes: mp-sync la llama por SQL directo, las Edge
-- Functions y BralidusPY por PostgREST. Que sea una sola función evita que cada
-- servicio implemente su propia versión del contador y diverjan.
create or replace function public.registrar_envio_webhook(
  p_servicio text,
  p_canal    text,
  p_ok       boolean,
  p_error    text default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ops_webhook_health as h (
    servicio, canal, ultimo_intento,
    ultimo_exito, ultimo_fallo, ultimo_error,
    fallos_consecutivos, envios_ok, envios_fallidos
  )
  values (
    p_servicio, p_canal, now(),
    case when p_ok then now() end,
    case when p_ok then null else now() end,
    case when p_ok then null else left(p_error, 500) end,
    case when p_ok then 0 else 1 end,
    case when p_ok then 1 else 0 end,
    case when p_ok then 0 else 1 end
  )
  on conflict (servicio, canal) do update set
    ultimo_intento      = now(),
    ultimo_exito        = case when p_ok then now() else h.ultimo_exito end,
    ultimo_fallo        = case when p_ok then h.ultimo_fallo else now() end,
    -- El último error se conserva tras un éxito: sirve para el post mortem de
    -- "estuvo caído y volvió", que de otro modo se borra sin dejar rastro.
    ultimo_error        = case when p_ok then h.ultimo_error else left(p_error, 500) end,
    fallos_consecutivos = case when p_ok then 0 else h.fallos_consecutivos + 1 end,
    envios_ok           = h.envios_ok      + case when p_ok then 1 else 0 end,
    envios_fallidos     = h.envios_fallidos + case when p_ok then 0 else 1 end;
$$;

comment on function public.registrar_envio_webhook is
  'Registra el resultado de un envío de webhook. Idempotente por (servicio, canal).';

-- Canales que hay que mirar. Se define acá y no en cada servicio para que la
-- regla de "roto" sea una sola.
create or replace view public.ops_webhook_caidos as
  select
    servicio,
    canal,
    fallos_consecutivos,
    ultimo_error,
    ultimo_exito,
    ultimo_fallo,
    -- Sin ningún éxito jamás, la configuración nunca funcionó: es distinto de
    -- un canal que andaba y se cayó, y se arregla en otro lado (la URL está
    -- mal puesta, no fue revocada).
    (ultimo_exito is null) as nunca_funciono
  from public.ops_webhook_health
  where fallos_consecutivos > 0;

comment on view public.ops_webhook_caidos is
  'Canales con al menos un fallo desde el último éxito.';

-- Sólo escribe el backend (service role). Nada de esto es público.
alter table public.ops_webhook_health enable row level security;

revoke all on function public.registrar_envio_webhook(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.registrar_envio_webhook(text, text, boolean, text) to service_role;
