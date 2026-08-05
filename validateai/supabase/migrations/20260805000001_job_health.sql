-- ============================================================================
-- job_health: que el detector de fallos silenciosos sobreviva al proceso
-- ============================================================================
--
-- QUÉ PASÓ. El monitor de salud del worker existía, funcionaba y alertaba: hay
-- 64 señales `health_monitor:cmf_sync` en radar_signals. La última es del
-- 2026-07-13.
--
-- El 2026-07-14 el worker se desplegó en Vercel (commit 62991f2) y el 15 se le
-- agregaron triggers HTTP para el scheduler en serverless (258c6f5). Desde
-- entonces cada `/jobs/run/*` es un proceso nuevo.
--
-- El monitor guardaba `consecutive_empty` EN MEMORIA y alertaba a las 3 corridas
-- vacías consecutivas. Con un proceso efímero por invocación, el contador vuelve
-- a 0 siempre y ese umbral quedó matemáticamente inalcanzable. Nadie rompió
-- nada: una migración de arquitectura invalidó el detector en silencio, y por eso
-- cuatro extractores llevan meses muertos sin una sola alerta.
--
-- QUÉ RESUELVE ESTA TABLA. El estado pasa a la base, que es lo único que
-- sobrevive entre invocaciones. Además queda consultable: hoy no había forma de
-- preguntar "¿qué jobs no producen hace días?" sin leer logs.

create table if not exists public.job_health (
  job_id            text primary key,
  consecutive_empty integer     not null default 0,
  total_runs        bigint      not null default 0,
  total_results     bigint      not null default 0,
  last_run          timestamptz,
  last_success      timestamptz,
  last_alert_at     timestamptz,
  updated_at        timestamptz not null default now()
);

comment on table public.job_health is
  'Salud de los jobs del worker. Vive en la BD y no en memoria porque el worker es serverless: un contador en proceso se reinicia en cada invocación y nunca alcanza el umbral de alerta.';
comment on column public.job_health.consecutive_empty is
  'Corridas seguidas que terminaron con 0 resultados. Es la señal de fallo silencioso: el job no lanza excepción, simplemente no produce.';
comment on column public.job_health.last_success is
  'Última corrida que produjo al menos un resultado. Si está muy atrás, el job lleva ese tiempo sin servir para nada aunque se reporte verde.';

alter table public.job_health enable row level security;

drop policy if exists "service role gestiona job_health" on public.job_health;
create policy "service role gestiona job_health" on public.job_health
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ============================================================================
-- Reporte atómico: acumula y decide si toca alertar, en una sola operación
-- ============================================================================
--
-- Va como función y no como lógica en Python porque dos invocaciones del worker
-- pueden solaparse: leer-modificar-escribir desde el cliente perdería cuentas y,
-- peor, podría disparar dos alertas por el mismo evento.
--
-- Devuelve `debe_alertar` para que el llamador no tenga que reimplementar el
-- umbral ni el anti-spam: la decisión vive junto al estado.

create or replace function public.job_health_report(
  p_job_id            text,
  p_results           integer,
  p_umbral            integer default 3,
  p_horas_anti_spam   integer default 6
)
returns table (
  consecutive_empty integer,
  last_success      timestamptz,
  debe_alertar      boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vacias  integer;
  v_exito   timestamptz;
  v_alerta  timestamptz;
  v_debe    boolean := false;
begin
  insert into public.job_health as jh (job_id, consecutive_empty, total_runs, total_results, last_run, last_success, updated_at)
  values (
    p_job_id,
    case when p_results > 0 then 0 else 1 end,
    1,
    greatest(p_results, 0),
    now(),
    case when p_results > 0 then now() else null end,
    now()
  )
  on conflict (job_id) do update set
    consecutive_empty = case when p_results > 0 then 0 else jh.consecutive_empty + 1 end,
    total_runs        = jh.total_runs + 1,
    total_results     = jh.total_results + greatest(p_results, 0),
    last_run          = now(),
    last_success      = case when p_results > 0 then now() else jh.last_success end,
    updated_at        = now()
  returning jh.consecutive_empty, jh.last_success, jh.last_alert_at
  into v_vacias, v_exito, v_alerta;

  -- Anti-spam: como máximo una alerta por job cada `p_horas_anti_spam`. Marcar
  -- `last_alert_at` acá y no en el cliente evita que un fallo de red al enviar
  -- el webhook deje el estado inconsistente y repita la alerta cada corrida.
  if v_vacias >= p_umbral
     and (v_alerta is null or v_alerta < now() - make_interval(hours => p_horas_anti_spam))
  then
    v_debe := true;
    update public.job_health set last_alert_at = now() where job_id = p_job_id;
  end if;

  return query select v_vacias, v_exito, v_debe;
end;
$$;

revoke all on function public.job_health_report(text, integer, integer, integer) from public, anon, authenticated;

-- ============================================================================
-- Vista de tablero: responde "¿qué está muerto?" de un vistazo
-- ============================================================================

create or replace view public.job_health_resumen as
select
  job_id,
  consecutive_empty,
  total_runs,
  total_results,
  last_run,
  last_success,
  case
    when last_success is null and total_runs > 0 then 'NUNCA PRODUJO'
    when consecutive_empty >= 3                  then 'FALLO SILENCIOSO'
    when last_success < now() - interval '7 days' then 'SIN PRODUCIR HACE MAS DE 7 DIAS'
    else 'ok'
  end as estado,
  (extract(epoch from (now() - last_success)) / 86400)::int as dias_sin_producir
from public.job_health;

comment on view public.job_health_resumen is
  'Estado legible de cada job. "NUNCA PRODUJO" es el caso que costó meses detectar: el job corre, no falla y no sirve para nada.';
