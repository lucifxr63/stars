-- Sprint P-C: Protección anti-billing-attack para análisis Premium.
-- Trigger que bloquea INSERTs en validations cuando el usuario ya alcanzó
-- el límite de 999 análisis premium en el mes calendario actual.
-- El bloqueo ocurre a nivel de base de datos, no solo de aplicación.

CREATE OR REPLACE FUNCTION public.check_premium_monthly_limit()
RETURNS TRIGGER AS $$
DECLARE
  monthly_count INT;
BEGIN
  -- El trigger solo actúa en modo premium; detallado/rápido no se limitan aquí.
  IF NEW.validation_mode IS DISTINCT FROM 'premium' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO monthly_count
  FROM public.validations
  WHERE user_id      = NEW.user_id
    AND validation_mode = 'premium'
    AND created_at   >= date_trunc('month', NOW() AT TIME ZONE 'UTC');

  IF monthly_count >= 999 THEN
    -- El código de error 'premium_limit_exceeded' es capturado en la Edge Function
    -- y devuelto al frontend como HTTP 429 con mensaje claro.
    RAISE EXCEPTION 'premium_limit_exceeded'
      USING DETAIL = 'Monthly limit of 999 premium analyses reached for this account.',
            HINT   = 'Upgrade plan or wait until next billing cycle.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asociar el trigger ANTES del INSERT para bloquear antes de escribir.
DROP TRIGGER IF EXISTS enforce_premium_monthly_limit ON public.validations;

CREATE TRIGGER enforce_premium_monthly_limit
  BEFORE INSERT ON public.validations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_premium_monthly_limit();

COMMENT ON FUNCTION public.check_premium_monthly_limit() IS
  'Sprint P-C: Bloquea análisis premium cuando el usuario supera 999/mes. Anti-billing-attack.';
