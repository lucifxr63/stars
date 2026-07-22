-- ============================================================
-- Sprint 1B — Audit Separation
-- Separa el rastro de autoría del dataset público de entrenamiento.
--
-- Antes: training_data.user_id (tabla con "Public read" RLS) → re-identificación directa.
-- Después: training_data_audit (service_role only) contiene la FK user_id.
--          training_data queda sin user_id → activo anónimo colectivo.
--
-- El rate-limit de anonymize-idea (5/día) pasa a consultar training_data_audit.
-- ============================================================

-- ── 1. Crear tabla de auditoría privada ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_data_audit (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  training_data_id  UUID        NOT NULL REFERENCES public.training_data(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contributed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.training_data_audit ENABLE ROW LEVEL SECURITY;

-- Solo admins (service_role) pueden leer — ningún policy para roles normales
-- La ausencia de SELECT policy bloquea a todos los roles no-service.

COMMENT ON TABLE public.training_data_audit IS
  'Rastro de autoría del dataset de entrenamiento. Acceso restringido a service_role. No PII en training_data.';

-- Índice compuesto para el rate-limit: O(log n)
CREATE INDEX IF NOT EXISTS idx_training_data_audit_user_day
  ON public.training_data_audit (user_id, contributed_at DESC);

-- ── 2. Migrar user_id existente desde training_data ───────────────────────
INSERT INTO public.training_data_audit (training_data_id, user_id, contributed_at)
SELECT td.id, td.user_id, td.created_at
FROM public.training_data td
WHERE td.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 3. Eliminar user_id de training_data (convierte dataset en anónimo) ───
DROP INDEX IF EXISTS public.idx_training_data_user_day;

ALTER TABLE public.training_data
  DROP COLUMN IF EXISTS user_id;

COMMENT ON TABLE public.training_data IS
  'Dataset de ideas anonimizadas para fine-tuning. Sin user_id — ver training_data_audit para autoría.';
