-- ============================================================
-- Sprint 1 / Fase 0 — Fix rate-limit de anonymize-idea
-- Agrega user_id a training_data para que el límite diario (5/día)
-- funcione correctamente. Sin esta columna la query devuelve NULL y
-- el gate nunca rechaza peticiones.
-- ============================================================

ALTER TABLE public.training_data
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice compuesto para la consulta de rate-limit (O(log n)):
-- SELECT COUNT(*) FROM training_data WHERE user_id = $1 AND created_at >= today
CREATE INDEX IF NOT EXISTS idx_training_data_user_day
  ON public.training_data (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
