-- ============================================================
-- MIGRACIÓN: survey_module
-- Módulo de Encuestas Dinámicas para Customer Development
-- Basado en metodología "The Mom Test" + Ley N° 21.719 (Chile)
-- ============================================================

-- ── 1. survey_forms ────────────────────────────────────────
CREATE TABLE public.survey_forms (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  -- Estructura abstracta del formulario: campos, tipos, validaciones, lógica condicional
  schema_json   JSONB       NOT NULL DEFAULT '{"version":"1.0","fields":[]}',
  -- Definiciones de renderizado: orden, paginación, dependencias visuales
  ui_schema     JSONB       NOT NULL DEFAULT '{"order":[],"layout":"single-page","pages":[]}',
  is_published  BOOLEAN     NOT NULL DEFAULT false,
  -- Slug único para el enlace público (/s/:slug)
  unique_slug   TEXT        UNIQUE,
  -- Texto de consentimiento explícito (obligatorio Ley 21.719)
  consent_text  TEXT        NOT NULL DEFAULT 'Al enviar este formulario, consiento que mis respuestas sean procesadas para validar el proyecto del solicitante conforme a la Ley N° 21.719 de Protección de Datos Personales.',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para lookups de slug públicos
CREATE INDEX idx_survey_forms_slug    ON public.survey_forms(unique_slug) WHERE is_published = true;
CREATE INDEX idx_survey_forms_client  ON public.survey_forms(client_id);
-- GIN para búsquedas dentro del JSONB
CREATE INDEX idx_survey_forms_schema  ON public.survey_forms USING GIN(schema_json);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_survey_form_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER trg_survey_forms_updated_at
  BEFORE UPDATE ON public.survey_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_survey_form_timestamp();

-- ── 2. survey_submissions ──────────────────────────────────
CREATE TABLE public.survey_submissions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id               UUID        NOT NULL REFERENCES public.survey_forms(id) ON DELETE CASCADE,
  -- Mapeo clave-valor de respuestas según schema_json del formulario
  response_data         JSONB       NOT NULL DEFAULT '{}',
  -- Contexto: user-agent, timestamps, métricas de finalización
  metadata              JSONB       NOT NULL DEFAULT '{}',
  -- Pipeline de privacidad: raw → pseudonymized → anonymized
  anonymization_status  TEXT        NOT NULL DEFAULT 'raw'
    CHECK (anonymization_status IN ('raw', 'pseudonymized', 'anonymized')),
  -- Resultado del análisis LLM (Structured Output)
  analysis_result       JSONB,
  -- Consentimiento explícito del encuestado (obligatorio Ley 21.719)
  consent_given         BOOLEAN     NOT NULL DEFAULT false,
  consent_timestamp     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_survey_submissions_form    ON public.survey_submissions(form_id);
CREATE INDEX idx_survey_submissions_status  ON public.survey_submissions(anonymization_status);
-- GIN para búsquedas analíticas sobre response_data
CREATE INDEX idx_survey_submissions_data    ON public.survey_submissions USING GIN(response_data);
-- Índice parcial para el pipeline de anonimización
CREATE INDEX idx_survey_submissions_raw     ON public.survey_submissions(form_id)
  WHERE anonymization_status = 'raw';

-- ── 3. Row Level Security ──────────────────────────────────
ALTER TABLE public.survey_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_submissions ENABLE ROW LEVEL SECURITY;

-- survey_forms: el cliente solo ve/edita sus propios formularios
CREATE POLICY "survey_forms_owner_all"
  ON public.survey_forms FOR ALL
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- survey_forms: cualquiera puede leer un formulario publicado (para mostrar el form al encuestado)
CREATE POLICY "survey_forms_public_read"
  ON public.survey_forms FOR SELECT
  USING (is_published = true);

-- survey_submissions: el propietario del formulario puede leer todas las respuestas
CREATE POLICY "survey_submissions_owner_read"
  ON public.survey_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.survey_forms sf
      WHERE sf.id = form_id AND sf.client_id = auth.uid()
    )
  );

-- survey_submissions: cualquier persona puede insertar respuestas en un formulario publicado
-- (con consentimiento requerido — validado en la Edge Function survey-respond)
CREATE POLICY "survey_submissions_public_insert"
  ON public.survey_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.survey_forms sf
      WHERE sf.id = form_id AND sf.is_published = true
    )
    AND consent_given = true
  );

-- ── 4. Comentarios de tabla ────────────────────────────────
COMMENT ON TABLE public.survey_forms IS
  'Formularios de Customer Development dinámicos. schema_json almacena la estructura de campos en JSONB.';
COMMENT ON COLUMN public.survey_forms.schema_json IS
  'Estructura del formulario: {version, fields:[{id,type,label,required,validation,conditional,momTestScore}]}';
COMMENT ON COLUMN public.survey_forms.ui_schema IS
  'Definiciones de renderizado: {order, layout, pages, conditionals}';
COMMENT ON COLUMN public.survey_forms.consent_text IS
  'Texto de consentimiento mostrado al encuestado. Obligatorio Ley 21.719.';

COMMENT ON TABLE public.survey_submissions IS
  'Respuestas de encuestas. Pipeline de privacidad: raw → pseudonymized → anonymized.';
COMMENT ON COLUMN public.survey_submissions.anonymization_status IS
  'raw: datos personales identificables. pseudonymized: PII reemplazada con hash. anonymized: K-anonimato + L-diversidad aplicados.';
COMMENT ON COLUMN public.survey_submissions.analysis_result IS
  'Structured Output del LLM: {central_problem, severity, current_solutions, willingness_to_pay, friction_score, key_quotes}';
