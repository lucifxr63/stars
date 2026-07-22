-- ============================================================
-- Fase 15 (11C-b): cron janitor para generation_jobs — DOCUMENTACIÓN
--
-- ESTADO: DORMANTE. No se registra automáticamente. Activar en prod ejecutando
--         el SELECT cron.schedule(...) de abajo en el SQL Editor de Supabase,
--         reemplazando <SERVICE_ROLE_KEY> por el JWT de service_role.
--
-- Rol: red de seguridad del async por waitUntil. La ruta feliz la ejecuta
--      enqueue-generation (EdgeRuntime.waitUntil, JWT del usuario). Este cron solo
--      FINALIZA jobs colgados (partial/failed) — no re-ejecuta tasks.
--
-- Verificar activos:  SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- Desactivar:         SELECT cron.unschedule('process-generation-jobs-5min');
-- ============================================================

-- Cada 5 minutos: finaliza jobs 'queued'/'running' sin avance > 5 min.
SELECT cron.schedule(
  'process-generation-jobs-5min',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/process-generation-jobs',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);
