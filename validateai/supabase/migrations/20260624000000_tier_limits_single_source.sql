-- ============================================================
-- Fuente única de verdad para los límites de tier (#7)
-- ============================================================
-- Antes: los límites por tier estaban hardcodeados con un CASE duplicado en
-- check_and_increment_usage() Y en get_usage_summary() Y en el frontend
-- (tierLimits.ts). Tres copias → divergencia silenciosa (la UI podía mostrar
-- una cuota distinta a la que el backend realmente aplica).
--
-- Ahora: una sola función tier_limit(tier, kind) es la fuente en la DB; ambas
-- RPC la usan, y get_usage_summary expone los límites para que el frontend los
-- lea del servidor en vez de hardcodearlos. tierLimits.ts queda como fallback
-- pre-carga, con un test que valida que coincida (sync guard en CI).
-- ============================================================

-- ── Fuente única en la DB ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tier_limit(p_tier text, p_kind text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'expensive' THEN CASE p_tier
      WHEN 'free'    THEN 0
      WHEN 'basic'   THEN 5
      WHEN 'pro'     THEN 50
      WHEN 'premium' THEN 999
      WHEN 'admin'   THEN 999
      ELSE 0
    END
    ELSE CASE p_tier      -- 'total'
      WHEN 'free'    THEN 3
      WHEN 'basic'   THEN 15
      WHEN 'pro'     THEN 50
      WHEN 'premium' THEN 999
      WHEN 'admin'   THEN 999
      ELSE 3
    END
  END;
$$;

-- ── check_and_increment_usage: usa tier_limit() en vez del CASE inline ────────
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
  v_total_limit  int  := public.tier_limit(p_tier, 'total');
  v_exp_limit    int  := public.tier_limit(p_tier, 'expensive');
  v_row          usage_counters%ROWTYPE;
BEGIN
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

-- ── get_usage_summary: ahora también expone los límites (server-authoritative) ─
CREATE OR REPLACE FUNCTION get_usage_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- tier efectivo: degrada a free si la suscripción venció (mismo criterio que ai-validate)
  WITH eff AS (
    SELECT CASE
      WHEN p.tier_expires_at IS NOT NULL AND p.tier_expires_at < now() THEN 'free'
      ELSE COALESCE(p.tier, 'free')
    END AS tier
    FROM (SELECT 1) AS dummy
    LEFT JOIN public.profiles p ON p.id = p_user_id
  )
  SELECT jsonb_build_object(
    'period',          to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'),
    'total',           COALESCE(uc.total, 0),
    'expensive',       COALESCE(uc.expensive, 0),
    'reset_at',        (date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '1 month')::text,
    'total_limit',     public.tier_limit(eff.tier, 'total'),
    'expensive_limit', public.tier_limit(eff.tier, 'expensive')
  )
  FROM eff
  LEFT JOIN usage_counters uc
    ON uc.user_id = p_user_id
   AND uc.period  = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
$$;
