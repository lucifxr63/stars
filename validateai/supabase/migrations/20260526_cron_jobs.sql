-- ============================================================
-- Cron jobs para Edge Functions — DOCUMENTACIÓN (ya aplicado en prod)
--
-- ESTADO: Ambos crons ya fueron registrados en producción el 2026-05-26
--         vía `npx supabase db query --linked --file <tmp>`.
--         NO volver a ejecutar este archivo — duplicaría los cron jobs.
--
-- Para verificar que siguen activos:
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
--
-- Para recrearlos desde cero (solo si fueron eliminados):
--   1. Reemplazar <SERVICE_ROLE_KEY> con el JWT de service_role
--   2. Ejecutar cada SELECT cron.schedule(...) en el SQL Editor de Supabase
-- ============================================================

-- ── 1. cron-tier-health — lunes 09:00 UTC ────────────────────────────────────
SELECT cron.schedule(
  'cron-tier-health-weekly',
  '0 9 * * 1',
  $$
    SELECT net.http_post(
      url     := 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/cron-tier-health',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ── 2. followup-email — diariamente 10:00 UTC ────────────────────────────────
SELECT cron.schedule(
  'followup-email-daily',
  '0 10 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/followup-email',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ── Verificar que quedaron registrados ────────────────────────────────────────
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
