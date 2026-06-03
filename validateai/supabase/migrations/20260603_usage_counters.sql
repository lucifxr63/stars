-- Rate limiting robusto: tabla de contadores atómicos + RPCs SECURITY DEFINER.
-- Reemplaza el patrón COUNT(ai_interactions) que tiene race condition y es O(n).
-- Elimina usage_logs (tabla huérfana creada en 20260530 pero nunca usada).

-- ── 1. Drop tabla huérfana ───────────────────────────────────────────────────
DROP TABLE IF EXISTS usage_logs CASCADE;

-- ── 2. Contador agregado por usuario × período ───────────────────────────────
-- Una fila por (user_id, 'YYYY-MM'). PK compuesta → O(1) lookup, sin crecer
-- más de usuarios×12 filas/año. No necesita RLS: solo accesible via RPCs DEFINER.
CREATE TABLE IF NOT EXISTS usage_counters (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period    text NOT NULL,  -- 'YYYY-MM'
  total     int  NOT NULL DEFAULT 0,
  expensive int  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period)
);

-- ── 3. RPC atómica: verifica Y incrementa en la misma transacción ────────────
-- SELECT FOR UPDATE serializa requests concurrentes del mismo usuario.
-- Si dos requests llegan simultáneamente, el segundo espera que el primero
-- complete → sin race condition (no TOCTOU posible dentro de plpgsql).
-- Fail-open: el caller debe permitir el request si esta función falla.
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id      uuid,
  p_prompt_type  text,
  p_is_expensive boolean,
  p_tier         text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period       text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  v_total_limit  int;
  v_exp_limit    int;
  v_row          usage_counters%ROWTYPE;
BEGIN
  -- Límites por tier (fuente de verdad en servidor — duplicar en TIER_LIMITS de useUsage.ts)
  v_total_limit := CASE p_tier
    WHEN 'free'    THEN 3
    WHEN 'basic'   THEN 15
    WHEN 'pro'     THEN 50
    WHEN 'premium' THEN 999
    ELSE 3
  END;
  v_exp_limit := CASE p_tier
    WHEN 'free'    THEN 0
    WHEN 'basic'   THEN 5
    WHEN 'pro'     THEN 50
    WHEN 'premium' THEN 999
    ELSE 0
  END;

  -- Bloqueo inmediato de tier: free no puede acceder a análisis costosos
  IF p_is_expensive AND v_exp_limit = 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'tier_blocked',
      'used',    0,
      'limit',   v_total_limit
    );
  END IF;

  -- Crear fila del período si no existe (idempotente)
  INSERT INTO usage_counters(user_id, period, total, expensive)
  VALUES (p_user_id, v_period, 0, 0)
  ON CONFLICT (user_id, period) DO NOTHING;

  -- Leer + bloquear la fila → serializa requests concurrentes del mismo user
  SELECT * INTO v_row
  FROM usage_counters
  WHERE user_id = p_user_id AND period = v_period
  FOR UPDATE;

  -- Check límite total mensual
  IF v_row.total >= v_total_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'monthly_limit',
      'used',    v_row.total,
      'limit',   v_total_limit
    );
  END IF;

  -- Check límite de análisis costosos (expensive sub-quota)
  IF p_is_expensive AND v_row.expensive >= v_exp_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'expensive_limit',
      'used',    v_row.expensive,
      'limit',   v_exp_limit
    );
  END IF;

  -- Todo OK: incrementar atómicamente
  UPDATE usage_counters
  SET
    total     = total + 1,
    expensive = expensive + (CASE WHEN p_is_expensive THEN 1 ELSE 0 END)
  WHERE user_id = p_user_id AND period = v_period;

  RETURN jsonb_build_object(
    'allowed', true,
    'used',    v_row.total + 1,
    'limit',   v_total_limit
  );
END;
$$;

-- ── 4. RPC de consulta (solo lectura, para el frontend) ──────────────────────
-- Devuelve el uso del mes actual sin modificar estado.
-- Devuelve NULL row si el usuario no ha hecho ningún call este mes (total=0).
CREATE OR REPLACE FUNCTION get_usage_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'period',    to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'),
    'total',     COALESCE(uc.total, 0),
    'expensive', COALESCE(uc.expensive, 0),
    'reset_at',  (date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '1 month')::text
  )
  FROM (SELECT 1) AS dummy
  LEFT JOIN usage_counters uc
    ON uc.user_id = p_user_id
   AND uc.period  = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
$$;
