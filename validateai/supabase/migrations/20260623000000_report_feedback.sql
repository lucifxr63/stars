-- ============================================================
-- Feedback de calidad del reporte — persistencia accionable
-- ============================================================
-- Reemplaza el micro-feedback fire-and-forget que solo iba a PostHog como
-- evento agregado. Ahora el feedback queda ligado a la validación concreta y
-- a la sección, para poder cerrar el loop y refinar el RAG con casos reales.
--
-- El evento PostHog (micro_feedback) se sigue emitiendo desde el cliente para
-- no perder la analítica de embudo; esta tabla es la fuente accionable.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.report_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_id   uuid NOT NULL REFERENCES public.validations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Satisfacción global de la sección (1-5). Nullable: el usuario puede dejar
  -- solo dimensiones o texto sin poner rating.
  rating          int  CHECK (rating BETWEEN 1 AND 5),
  -- Sección/prompt sobre el que opina (ej: 'playbook_analysis', 'market_sizing').
  section         text NOT NULL DEFAULT 'report',
  -- Qué datos estaban mal, abierto (ej: ["TAM","competidores"]). [] = nada.
  dimensions_wrong jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Comentario libre opcional (Mom Test: lo que el usuario quiera agregar).
  free_text       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_feedback_validation ON public.report_feedback(validation_id);
CREATE INDEX IF NOT EXISTS idx_report_feedback_created     ON public.report_feedback(created_at DESC);

ALTER TABLE public.report_feedback ENABLE ROW LEVEL SECURITY;

-- El dueño de la validación inserta su propio feedback.
DROP POLICY IF EXISTS "report_feedback_owner_insert" ON public.report_feedback;
CREATE POLICY "report_feedback_owner_insert"
  ON public.report_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- El dueño puede leer su propio feedback (para mostrar "ya opinaste").
DROP POLICY IF EXISTS "report_feedback_owner_select" ON public.report_feedback;
CREATE POLICY "report_feedback_owner_select"
  ON public.report_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- El admin lee todo (panel /admin). Reutiliza public.is_admin() de 002_admin_policies.sql.
DROP POLICY IF EXISTS "report_feedback_admin_select" ON public.report_feedback;
CREATE POLICY "report_feedback_admin_select"
  ON public.report_feedback
  FOR SELECT
  USING (public.is_admin());

COMMENT ON TABLE public.report_feedback IS
  'Feedback de calidad del usuario sobre un reporte/sección. Fuente accionable para refinar el RAG; complementa (no reemplaza) el evento PostHog micro_feedback.';
