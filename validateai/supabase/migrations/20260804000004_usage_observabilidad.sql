-- ============================================================================
-- api_usage_logs: poder ver los fallos, y dejar de guardar a QUIÉN investigan
-- ============================================================================
--
-- PARTE 1 — PRIVACIDAD (es la urgente)
--
-- `usageMiddleware` guarda `new URL(c.req.url).pathname`, o sea la ruta CRUDA.
-- El gateway tiene 47 rutas con parámetros en la URL, y lo que queda escrito en
-- el log de uso es el identificador concreto:
--
--   /api/v1/data/pjud/suprema/causas/Civil/289/2023   <- una causa real
--   /api/v1/data/companies/76543210-K/profile          <- el RUT de una empresa
--   /api/v1/mercado-publico/proveedores/76543210-K     <- idem
--
-- Eso es la agenda de investigación del usuario: qué causas revisa un abogado y
-- qué empresas mira un analista, con fecha y hora. Para un producto de
-- inteligencia competitiva es lo más sensible que pasa por acá, y no hace falta
-- para nada de lo que la tabla existe (medir consumo y cobrar créditos).
--
-- Todavía no ocurrió: las filas actuales sólo tienen rutas sin parámetros. Pero
-- iba a ocurrir en cuanto el experto empezara a revisar causas, que es
-- exactamente para lo que se le entregó una key.
--
-- El middleware pasa a guardar la PLANTILLA que Hono ya resolvió al hacer el
-- match (`/api/v1/data/companies/:rut/profile`). Se conserva todo lo que sirve
-- para medir y se deja de conservar lo único que no deberíamos tener. De paso la
-- tabla vuelve a ser agregable: con la ruta cruda, cada RUT distinto generaba un
-- `endpoint` único y "cuántas consultas de proveedor hubo" no se podía agrupar.
--
-- PARTE 2 — OBSERVABILIDAD
--
-- Hoy sólo se registran las peticiones que FUNCIONARON. Comprobado contra
-- producción: 3 peticiones con key inválida más una sin token produjeron 0
-- filas, porque `usageMiddleware` va después de auth y del limitador en la
-- cadena y esos devuelven sin llamar a `next()`.
--
-- Y ni siquiera las que se registran dicen si salieron bien: no hay columna de
-- estado, así que un 200 y un 500 del handler quedan idénticos.
--
-- Se agregan tres columnas que ya están fluyendo y se descartaban:
--   status      — distinguir éxito de fallo
--   client      — llega en X-Client (el MCP manda Animus-Engine-MCP/<version>);
--                 sin esto no se puede separar el tráfico del MCP del de curl ni
--                 saber quién actualizó al publicar un arreglo
--   latency_ms  — para saber si el timeout de 30 s del cliente es el correcto

alter table public.api_usage_logs
  add column if not exists status     smallint,
  add column if not exists client     text,
  add column if not exists latency_ms integer;

comment on column public.api_usage_logs.endpoint is
  'PLANTILLA de la ruta (/api/v1/data/companies/:rut/profile), nunca la ruta concreta. Guardar el identificador real convertiría esta tabla en el registro de qué causas y qué empresas investiga cada usuario.';
comment on column public.api_usage_logs.status is
  'Código HTTP de la respuesta. NULL en filas anteriores al 2026-08-04, cuando no se registraba.';
comment on column public.api_usage_logs.client is
  'Valor de X-Client. Permite separar MCP / portal / integraciones directas y saber qué versión corre cada uno.';

create index if not exists api_usage_logs_status_idx
  on public.api_usage_logs (status, created_at desc)
  where status is not null and status >= 400;

-- ============================================================================
-- api_auth_failures: ver los rechazos sin dejar que los rechazos llenen la tabla
-- ============================================================================
--
-- El 401 es el fallo que MÁS necesitamos ver —es con lo que choca todo usuario
-- nuevo que pega mal su key— y a la vez el único que puede provocar cualquiera
-- desde fuera, sin credencial. Escribir una fila por intento deja crecer la
-- tabla sin techo a voluntad de un tercero.
--
-- Por eso se agrega por (prefijo de IP, día): un contador, no un historial. La
-- IP ya viene truncada a /24 por `anonymize_ip`, así que esto responde "cuántas
-- fuentes distintas rebotaron hoy y cuántas veces cada una" sin identificar a
-- nadie ni permitir inflar la tabla.

create table if not exists public.api_auth_failures (
  ip_prefix   text        not null,
  dia         date        not null default current_date,
  code        text        not null,
  intentos    integer     not null default 1,
  ultima_vez  timestamptz not null default now(),
  primary key (ip_prefix, dia, code)
);

comment on table public.api_auth_failures is
  'Contador agregado de rechazos de autenticación por prefijo de IP y día. Es un contador, NO un historial: escribir una fila por intento dejaría que cualquiera sin credencial haga crecer la tabla sin techo.';

alter table public.api_auth_failures enable row level security;

-- Sólo el service role escribe y lee. No hay política para usuarios: esto es
-- diagnóstico operacional, no dato de nadie.
drop policy if exists "solo service role gestiona fallos de auth" on public.api_auth_failures;
create policy "solo service role gestiona fallos de auth"
  on public.api_auth_failures
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Incremento atómico. Va como función y no como upsert desde el cliente porque
-- dos peticiones simultáneas del mismo origen tienen que sumar 2, no pisarse.
-- La IP se trunca acá con la misma `anonymize_ip` que usa el resto: si el
-- formato no es una IP limpia devuelve NULL, y entonces se agrupa bajo
-- '(desconocido)' en vez de guardar una cadena cruda de x-forwarded-for.
create or replace function public.registrar_fallo_auth(p_ip text, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefijo text;
begin
  v_prefijo := coalesce(public.anonymize_ip(p_ip), '(desconocido)');

  insert into public.api_auth_failures (ip_prefix, dia, code, intentos, ultima_vez)
  values (v_prefijo, current_date, coalesce(p_code, 'DESCONOCIDO'), 1, now())
  on conflict (ip_prefix, dia, code)
  do update set intentos   = api_auth_failures.intentos + 1,
                ultima_vez = now();
end;
$$;

revoke all on function public.registrar_fallo_auth(text, text) from public, anon, authenticated;
