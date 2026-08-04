-- ============================================================================
-- api_usage_logs: poder registrar los cuatro tipos de tráfico, no sólo uno
-- ============================================================================
--
-- SÍNTOMA: la tabla tenía 92 filas, la última del 2026-05-26. Tres peticiones
-- de prueba en vivo escribieron 0 filas.
--
-- POR QUÉ IMPORTA: `middleware/ratelimit.ts` calcula el consumo del mes LEYENDO
-- esta tabla. Si no se escribe, el consumo da siempre cero y la cuota nunca se
-- alcanza. No había control de acceso — no por una política permisiva, sino
-- porque el medidor estaba roto y nadie lo notó: el único rastro del fallo era
-- un console.error dentro de la Edge Function.
--
-- CAUSAS (tres, todas en la misma ruta):
--
--   1. `api_key_id` es uuid NOT NULL con FK a api_keys(id), pero el middleware
--      de auth pone el literal 'demo_public_key' para el tráfico sin credencial.
--      Cada petición anónima moría con error de sintaxis de uuid.
--
--   2. El middleware agregaba `profile_id` al payload y esa columna NO EXISTÍA.
--      Eso tumbaba además las peticiones con API key válida.
--
--   3. La rama de sesión JWT de authMiddleware nunca setea `api_key_id`, así
--      que usage.ts cortaba antes de intentar el insert.
--
-- QUÉ HACE ESTA MIGRACIÓN: hay cuatro sujetos posibles y sólo uno tenía dónde
-- guardarse. Se agrega `profile_id` (la columna que el código ya escribía) y se
-- permite `api_key_id` nulo, quedando:
--
--   api_key   -> api_key_id = uuid de la key,  profile_id = dueño
--   sesión    -> api_key_id = NULL,            profile_id = usuario
--   anónimo   -> api_key_id = NULL,            profile_id = NULL   (balde común)
--   demo      -> api_key_id = NULL,            profile_id = NULL   (balde común)
--
-- No se crea una fila centinela en api_keys: su FK exige un profiles, que a su
-- vez exige un auth.users. Inventar ese usuario ensucia el padrón real y crea
-- una identidad con capacidad de login para representar "nadie".

alter table public.api_usage_logs
  alter column api_key_id drop not null;

alter table public.api_usage_logs
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

-- Índices parciales: el limitador hace exactamente estas tres consultas en cada
-- petición (créditos del mes + ráfaga del último minuto), así que van sobre la
-- ruta caliente. `tokens_used` va incluido para que el conteo mensual se
-- resuelva sin tocar el heap.
create index if not exists api_usage_logs_key_mes_idx
  on public.api_usage_logs (api_key_id, created_at desc) include (tokens_used)
  where api_key_id is not null;

create index if not exists api_usage_logs_perfil_mes_idx
  on public.api_usage_logs (profile_id, created_at desc) include (tokens_used)
  where api_key_id is null and profile_id is not null;

create index if not exists api_usage_logs_anon_mes_idx
  on public.api_usage_logs (created_at desc) include (tokens_used)
  where api_key_id is null and profile_id is null;

comment on column public.api_usage_logs.profile_id is
  'Dueño del consumo. NULL = tráfico sin identificar (anónimo/demo), que comparte un único cupo global.';
