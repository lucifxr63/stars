-- ============================================================
-- Demo 100 — Hardening RLS: usage_counters
-- ============================================================
-- Hallazgo de auditoría: usage_counters era la ÚNICA tabla con columna
-- user_id que NO tenía Row Level Security habilitada. Con RLS deshabilitada,
-- el rol `authenticated` (anon key + usuario logueado) podía ejecutar
-- `select * from usage_counters` y leer el consumo de TODOS los usuarios.
--
-- La tabla solo se accede mediante RPCs SECURITY DEFINER que bypassan RLS:
--   - check_and_increment_usage()  (edge function ai-validate)
--   - get_usage_summary()          (hook useUsage en el frontend)
-- Por eso cerramos la tabla a todo acceso directo de cliente, igual que
-- el patrón ya usado en usage_logs y tier_events (USING(false)).
-- Las RPC siguen funcionando sin cambios.
-- ============================================================

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- Deny-all a clientes: ningún acceso directo desde anon/authenticated.
-- El acceso legítimo ocurre solo vía las RPC SECURITY DEFINER.
DROP POLICY IF EXISTS "usage_counters_no_direct_access" ON public.usage_counters;
CREATE POLICY "usage_counters_no_direct_access"
  ON public.usage_counters
  FOR ALL
  USING (false)
  WITH CHECK (false);
