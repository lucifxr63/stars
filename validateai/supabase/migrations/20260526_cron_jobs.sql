-- ============================================================
-- Cron jobs para Edge Functions
-- Ejecutar UNA VEZ en producción vía Supabase SQL Editor
-- (no aplicar via supabase db push — contiene el service_role_key)
-- ============================================================

-- Reemplazar <SERVICE_ROLE_KEY> con el JWT de service_role del proyecto

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
