-- ============================================================
-- Cron de indicadores CMF (uf, utm, dolar, euro) — NUNCA EXISTIÓ
--
-- Diagnóstico (2026-07-29): /api-v1/data/macro servía estos cuatro valores
-- con fecha 2026-05-08, es decir 82 días viejos.
--
-- La causa NO era una credencial faltante: CMF_KEY estaba seteada desde el
-- 2026-05-24. Es que `sync-economic-data` es una función ON-DEMAND —recibe
-- {provider, indicator} en el body— y nadie la invocaba. La última escritura
-- fue una llamada manual y ahí quedó.
--
-- A diferencia de cron-uf-daily (que trae la UF del día desde mindicador.cl),
-- esta trae la serie de la CMF para los cuatro indicadores. Se agrupan en un
-- solo cron job con cuatro POST: son llamadas baratas y mantenerlas juntas
-- evita que una quede huérfana como pasó hasta ahora.
--
-- 04:00 UTC = medianoche en Chile, después de que la CMF publique el día.
--
-- APLICAR:
--   1. Reemplazar <SERVICE_ROLE_KEY> con el JWT de service_role.
--   2. npx supabase db query --linked --file <este archivo>
--   3. Verificar: SELECT jobname, schedule, active FROM cron.job;
--
-- IDEMPOTENTE: unschedule defensivo antes del schedule.
-- ============================================================

SELECT cron.unschedule('sync-cmf-indicadores') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-cmf-indicadores'
);

SELECT cron.schedule(
  'sync-cmf-indicadores',
  '0 4 * * *',
  $$
    SELECT net.http_post(
             url     := 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/sync-economic-data',
             headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
             body    := jsonb_build_object('provider', 'CMF', 'indicator', ind)
           )
      FROM unnest(ARRAY['uf', 'utm', 'dolar', 'euro']) AS ind;
  $$
);

-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
