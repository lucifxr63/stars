-- Unique constraint necesario para el upsert en cron-uf-daily
ALTER TABLE public.economic_knowledge
  ADD CONSTRAINT uq_economic_knowledge_provider_indicator
  UNIQUE (provider, indicator);

-- ─── pg_cron schedule ───────────────────────────────────────────────────────
-- Requiere extensiones pg_cron y pg_net (habilitadas por defecto en Supabase).
-- Sustituir <PROJECT_REF> y <SERVICE_ROLE_KEY> con los valores reales del proyecto,
-- o configurar el schedule desde el Dashboard → Edge Functions → Schedule.
--
-- Para configurar via SQL (recomendado desde SQL Editor del Dashboard):
--
-- SELECT cron.schedule(
--   'sync-uf-diario',
--   '0 3 * * *',   -- 3 AM UTC = medianoche Chile (horario estándar)
--   $$
--   SELECT net.http_post(
--     url        := 'https://<PROJECT_REF>.supabase.co/functions/v1/cron-uf-daily',
--     headers    := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--     body       := '{}'::jsonb
--   );
--   $$
-- );
