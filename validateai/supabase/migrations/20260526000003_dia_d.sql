-- ============================================================
-- Día D — Eliminar columna rut de profiles y consent_logs
--
-- Pre-condiciones cumplidas:
--   - rut_hash existe en ambas tablas y fue populado (sprint 1A)
--   - register-consent actualizado: escribe rut_hash, no rut
--   - Profile.tsx actualizado: llama RPC update_my_rut_hash, no escribe rut
--
-- Esta migración:
--   1. Crea RPC autenticada para que el frontend hashee RUT vía DB
--   2. Elimina triggers (ya no son necesarios)
--   3. Elimina columna rut de ambas tablas
-- ============================================================

-- ── 1. RPC: el frontend la llama para actualizar rut_hash del perfil propio ───
CREATE OR REPLACE FUNCTION public.update_my_rut_hash(plain_rut TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF plain_rut IS NULL OR plain_rut = '' THEN
    RETURN;
  END IF;
  UPDATE public.profiles
  SET rut_hash = public.fn_hash_rut_value(plain_rut)
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_rut_hash(TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_my_rut_hash IS
  'Hashea el RUT del usuario autenticado y persiste solo el hash. El plaintext nunca se almacena.';

-- ── 2. Eliminar triggers (la lógica pasa al edge function y al RPC) ──────────
DROP TRIGGER IF EXISTS trg_hash_rut_profiles ON public.profiles;
DROP TRIGGER IF EXISTS trg_hash_rut_consent  ON public.consent_logs;

DROP FUNCTION IF EXISTS public.fn_hash_rut_profiles();
DROP FUNCTION IF EXISTS public.fn_hash_rut_consent();

-- fn_hash_rut_value() se conserva — lo usan el RPC y register-consent

-- ── 3. Eliminar columnas rut (siempre NULL post-sprint 1A) ───────────────────
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS rut;

ALTER TABLE public.consent_logs
  DROP COLUMN IF EXISTS rut;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT column_name, table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'consent_logs')
  AND column_name = 'rut';
-- Debe retornar 0 filas
