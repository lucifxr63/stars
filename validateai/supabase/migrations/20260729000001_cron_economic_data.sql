-- ============================================================
-- Crons de datos económicos — NUNCA SE HABÍAN AGENDADO
--
-- Diagnóstico (2026-07-29): un integrador reportó que /api-v1/data/macro
-- servía valores del 8 al 23 de mayo. La causa no era un job atrasado: no
-- existía el job. `cron-uf-daily`, `fred-sync`, `cmf-best-fetch` y
-- `chilecompra-fetch` estaban DESPLEGADAS y ACTIVE en Edge Functions, pero
-- cron.job sólo tenía tres entradas y ninguna las invocaba:
--
--   cron-tier-health-weekly      0 9 * * 1
--   followup-email-daily         0 10 * * *
--   process-generation-jobs-5min */5 * * * *
--
-- Resultado: `economic_knowledge` quedó congelada en su última escritura
-- manual (CMF_uf_diario 2026-05-24; el resto 2026-05-08) durante ~66 días,
-- y /data/macro devolvía eso como si fuera dato vigente.
--
-- La migración 20260523000001_cmf_uf_cron.sql traía el cron.schedule() de
-- cron-uf-daily COMENTADO, con la nota "configurar desde el Dashboard". Nunca
-- se configuró. Este archivo lo deja como código ejecutable para que no vuelva
-- a depender de un paso manual que nadie recuerda.
--
-- APLICAR:
--   1. Reemplazar <SERVICE_ROLE_KEY> por el JWT de service_role del proyecto.
--   2. npx supabase db query --linked --file <este archivo>
--   3. Verificar: SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
--
-- IDEMPOTENTE: usa cron.unschedule() defensivo antes de cada schedule, así que
-- puede re-ejecutarse sin duplicar jobs.
-- ============================================================

-- ── 1. cron-uf-daily — UF/UTM/dólar/euro desde CMF, diario 03:00 UTC ─────────
-- 03:00 UTC = medianoche en Chile continental (horario estándar). La CMF
-- publica el valor del día hábil por la mañana; correr a medianoche toma el
-- valor ya publicado del día anterior, que es el vigente hasta la publicación.
SELECT cron.unschedule('sync-uf-diario') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-uf-diario'
);

SELECT cron.schedule(
  'sync-uf-diario',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/cron-uf-daily',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ── 2. fred-sync — series macro de EE.UU., días hábiles 12:00 UTC ────────────
-- FRED publica en horario de EE.UU.; 12:00 UTC (08:00 ET) toma el cierre del
-- día hábil anterior. Lun-Vie: el fin de semana no hay publicación nueva.
SELECT cron.unschedule('fred-sync-weekdays') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'fred-sync-weekdays'
);

SELECT cron.schedule(
  'fred-sync-weekdays',
  '0 12 * * 1-5',
  $$
    SELECT net.http_post(
      url     := 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/fred-sync',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
