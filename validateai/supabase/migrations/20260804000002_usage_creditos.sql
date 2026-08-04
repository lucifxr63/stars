-- ============================================================================
-- api_usage_logs: separar CRÉDITOS de TOKENS (estaban en la misma columna)
-- ============================================================================
--
-- SÍNTOMA: tres GET /data/macro seguidos, sin token, consumieron 61 de 150
-- créditos. El header de la primera decía `X-RateLimit-Request-Cost: 1`.
--
-- CAUSA: dos unidades distintas compartían la columna `tokens_used`.
--
--   - `ratelimit.ts` DECIDE con ENDPOINT_CREDITS: /data/macro cuesta 1 crédito,
--     y eso es lo que reserva y lo que le anuncia al integrador en el header.
--   - `data.ts` ESCRIBE `c.set('tokens_used', 30)`, una estimación de tokens.
--   - `usage.ts` guardaba ese 30 en `tokens_used`, y el limitador sumaba esa
--     misma columna contra un límite que está expresado en créditos.
--
-- O sea: se cotizaba 1 y se cobraba 30. La reserva previa quedaba corta (un
-- usuario podía pasarse del tope en la última petición) y el cobro efectivo era
-- 30x el precio publicado. En rag/query la brecha es peor: precio 5, escritura
-- 300 + 50 por chunk.
--
-- ARREGLO: `credits_used` guarda la unidad con la que se cobra y se compara
-- contra el tope; `tokens_used` queda como telemetría de costo real, que es
-- para lo que sirve. Ninguna de las dos pisa a la otra.
--
-- Las 92 filas viejas (hasta 2026-05-26, cuando el registro se rompió) quedan
-- en el default 1: su `tokens_used` es un número de tokens, no de créditos, y
-- convertirlo requeriría reconstruir el precio vigente de cada endpoint en cada
-- fecha. Se prefiere un valor honesto y bajo antes que uno inventado.

alter table public.api_usage_logs
  add column if not exists credits_used integer not null default 1;

comment on column public.api_usage_logs.credits_used is
  'Créditos cobrados = ENDPOINT_CREDITS del endpoint. Es la unidad del tope mensual por tier y la que se anuncia en X-RateLimit-Request-Cost.';

comment on column public.api_usage_logs.tokens_used is
  'Telemetría de costo real (tokens LLM u operaciones). NO es la unidad de cobro: para eso está credits_used.';

-- Los índices de la migración anterior cubrían `tokens_used`; se rehacen sobre
-- la columna que ahora suma el limitador, para que el conteo mensual siga
-- resolviéndose sin ir al heap.
drop index if exists public.api_usage_logs_key_mes_idx;
drop index if exists public.api_usage_logs_perfil_mes_idx;
drop index if exists public.api_usage_logs_anon_mes_idx;

create index if not exists api_usage_logs_key_mes_idx
  on public.api_usage_logs (api_key_id, created_at desc) include (credits_used)
  where api_key_id is not null;

create index if not exists api_usage_logs_perfil_mes_idx
  on public.api_usage_logs (profile_id, created_at desc) include (credits_used)
  where api_key_id is null and profile_id is not null;

create index if not exists api_usage_logs_anon_mes_idx
  on public.api_usage_logs (created_at desc) include (credits_used)
  where api_key_id is null and profile_id is null;
