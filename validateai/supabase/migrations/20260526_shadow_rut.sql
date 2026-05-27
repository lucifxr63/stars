-- ============================================================
-- Sprint 1A — Shadow RUT
-- Hashing HMAC-SHA256 del RUT chileno con pepper de Supabase Vault.
--
-- Requisito previo (una sola vez, vía SQL Editor de Supabase):
--   ALTER DATABASE postgres SET app.rut_pepper = '<valor-aleatorio-fuerte>';
--   Luego recargar: SELECT pg_reload_conf();
--
-- Día D (después de confirmar que ningún SELECT de la app lee profiles.rut):
--   ALTER TABLE public.profiles DROP COLUMN rut;
--   ALTER TABLE public.consent_logs DROP COLUMN rut;
-- ============================================================

-- pgcrypto provee hmac() — disponible por defecto en Supabase
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Agregar columna rut_hash a profiles ────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rut_hash TEXT;

-- ── 2. Agregar columna rut_hash a consent_logs ───────────────────────────
ALTER TABLE public.consent_logs
  ADD COLUMN IF NOT EXISTS rut_hash TEXT;

-- ── 3. Función de hashing ─────────────────────────────────────────────────
-- Lee el pepper desde Supabase Vault (secret name = 'rut_pepper').
-- SECURITY DEFINER permite al trigger acceder a vault.decrypted_secrets
-- sin exponer el secreto al rol que invoca la función.
CREATE OR REPLACE FUNCTION public.fn_hash_rut_value(plain_rut TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  pepper TEXT;
BEGIN
  SELECT decrypted_secret INTO pepper
  FROM vault.decrypted_secrets
  WHERE name = 'rut_pepper'
  LIMIT 1;

  IF plain_rut IS NULL OR plain_rut = '' THEN
    RETURN NULL;
  END IF;
  RETURN encode(
    hmac(
      convert_to(plain_rut,                         'UTF8'),
      convert_to(COALESCE(pepper, 'default-pepper'), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
END;
$$;

-- ── 4. Trigger para profiles (INSERT y UPDATE) ────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_hash_rut_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.rut IS NOT NULL AND NEW.rut != '' THEN
    NEW.rut_hash := public.fn_hash_rut_value(NEW.rut);
    NEW.rut      := NULL; -- Nullificar plaintext inmediatamente
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_rut_profiles ON public.profiles;
CREATE TRIGGER trg_hash_rut_profiles
  BEFORE INSERT OR UPDATE OF rut ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_hash_rut_profiles();

-- ── 5. Trigger para consent_logs (solo INSERT — tabla inmutable) ──────────
CREATE OR REPLACE FUNCTION public.fn_hash_rut_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.rut IS NOT NULL AND NEW.rut != '' THEN
    NEW.rut_hash := public.fn_hash_rut_value(NEW.rut);
    NEW.rut      := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_rut_consent ON public.consent_logs;
CREATE TRIGGER trg_hash_rut_consent
  BEFORE INSERT ON public.consent_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_hash_rut_consent();

-- ── 6. Backfill: hashear RUTs existentes en profiles ─────────────────────
-- Procesa en lote sin mantener transacción larga
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, rut FROM public.profiles WHERE rut IS NOT NULL AND rut != ''
  LOOP
    UPDATE public.profiles
    SET
      rut_hash = public.fn_hash_rut_value(r.rut),
      rut      = NULL
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 7. Backfill: hashear RUTs existentes en consent_logs ─────────────────
-- consent_logs es inmutable para users, pero SERVICE_ROLE puede actualizar para el backfill
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, rut FROM public.consent_logs WHERE rut IS NOT NULL AND rut != ''
  LOOP
    UPDATE public.consent_logs
    SET
      rut_hash = public.fn_hash_rut_value(r.rut),
      rut      = NULL
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 8. Índice para verificación de unicidad por hash ──────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_rut_hash ON public.profiles(rut_hash)
  WHERE rut_hash IS NOT NULL;

COMMENT ON COLUMN public.profiles.rut_hash IS
  'HMAC-SHA256 del RUT chileno. Pepper en app.rut_pepper. Columna rut siempre NULL post-trigger.';
COMMENT ON COLUMN public.consent_logs.rut_hash IS
  'HMAC-SHA256 del RUT chileno al momento del consentimiento. Columna rut siempre NULL post-trigger.';
