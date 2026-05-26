-- ============================================================
-- MIGRACIÓN: survey_anonymized_data
-- Data lake de inteligencia de mercado — datos irreversiblemente anonimizados.
-- K-anonimato (k≥5) + L-diversidad (l≥2) garantizados algorítmicamente.
-- Exento de Ley N° 21.719 y GDPR por su naturaleza ontológica (no datos personales).
-- ============================================================

CREATE TABLE public.survey_anonymized_data (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referencia débil al formulario (no trackeable a submission individual)
  form_id               UUID        NOT NULL REFERENCES public.survey_forms(id) ON DELETE CASCADE,
  -- Taxonomía generalizada — cuasi-identificadores reducidos en cardinalidad
  generalized_industry  TEXT,        -- Enum controlado, ver CHECK abajo
  generalized_role      TEXT,        -- Nivel de cargo generalizado
  generalized_tech_family TEXT,      -- Familia tecnológica de soluciones actuales
  -- Bucket de fricción generalizado (3 buckets: baja/media/alta)
  friction_bucket       TEXT        NOT NULL CHECK (friction_bucket IN ('baja', 'media', 'alta')),
  -- Atributos analíticos — preservados tras anonimización
  severity              TEXT        NOT NULL CHECK (severity IN ('tolerable', 'critico', 'paralizante')),
  willingness_to_pay    BOOLEAN     NOT NULL,
  central_problem       TEXT        NOT NULL,
  current_solutions     JSONB       NOT NULL DEFAULT '[]',
  key_quotes            JSONB       NOT NULL DEFAULT '[]',
  mom_test_signals      JSONB       NOT NULL DEFAULT '{}',
  -- Metadatos de privacidad (nunca vinculables a individuos)
  k_class_size          INTEGER     NOT NULL,  -- Tamaño de la clase de equivalencia al momento de anonimizar
  l_diversity_score     INTEGER     NOT NULL,  -- Valores distintos de severity en la clase
  anonymized_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Semana de creación (redondeo temporal para evitar reidentificación por timestamp exacto)
  week_bucket           TEXT        NOT NULL   -- Formato: '2026-W21'
);

-- CHECKs de taxonomía controlada
ALTER TABLE public.survey_anonymized_data ADD CONSTRAINT chk_industry CHECK (
  generalized_industry IS NULL OR generalized_industry IN (
    'Manufactura e Industria',
    'Tecnología y Software',
    'Operaciones TI',
    'Retail y Comercio',
    'Servicios Financieros',
    'Salud y Ciencias',
    'Educación',
    'Logística y Transporte',
    'Construcción e Inmobiliario',
    'Agroindustria',
    'Servicios Profesionales',
    'Otro'
  )
);

ALTER TABLE public.survey_anonymized_data ADD CONSTRAINT chk_role CHECK (
  generalized_role IS NULL OR generalized_role IN (
    'Fundador/Dueño',
    'Dirección C-Level',
    'Gerencia Media',
    'Operativo/Staff',
    'No especificado'
  )
);

ALTER TABLE public.survey_anonymized_data ADD CONSTRAINT chk_tech CHECK (
  generalized_tech_family IS NULL OR generalized_tech_family IN (
    'ERP/CRM',
    'Productividad (Office/Sheets)',
    'Comunicación (Slack/Teams/Email)',
    'Herramientas manuales (Excel/papel)',
    'Software especializado vertical',
    'Desarrollo propio',
    'Sin herramienta específica',
    'Múltiples herramientas'
  )
);

-- Índices analíticos para el data lake
CREATE INDEX idx_anon_form         ON public.survey_anonymized_data(form_id);
CREATE INDEX idx_anon_severity     ON public.survey_anonymized_data(severity);
CREATE INDEX idx_anon_industry     ON public.survey_anonymized_data(generalized_industry);
CREATE INDEX idx_anon_friction     ON public.survey_anonymized_data(friction_bucket);
CREATE INDEX idx_anon_week         ON public.survey_anonymized_data(week_bucket);
-- GIN para consultas sobre soluciones actuales y señales Mom Test
CREATE INDEX idx_anon_solutions    ON public.survey_anonymized_data USING GIN(current_solutions);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE public.survey_anonymized_data ENABLE ROW LEVEL SECURITY;

-- Solo el propietario del formulario puede leer su data lake anonimizada
CREATE POLICY "survey_anon_owner_read"
  ON public.survey_anonymized_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.survey_forms sf
      WHERE sf.id = form_id AND sf.client_id = auth.uid()
    )
  );

-- Nadie puede insertar/modificar desde el cliente (solo SERVICE_ROLE via Edge Function)

-- ── Comentarios ─────────────────────────────────────────────
COMMENT ON TABLE public.survey_anonymized_data IS
  'Data lake de inteligencia de mercado. Datos anonimizados irreversiblemente: k≥5 (k-anonimato) + l≥2 (l-diversidad). No constituyen datos personales bajo Ley 21.719 ni GDPR.';
COMMENT ON COLUMN public.survey_anonymized_data.k_class_size IS
  'Tamaño del grupo de equivalencia al momento de anonimizar. Mínimo garantizado: 5.';
COMMENT ON COLUMN public.survey_anonymized_data.week_bucket IS
  'Semana ISO del registro original (redondeado). Formato: YYYY-Www. Evita reidentificación por timestamp exacto.';
COMMENT ON COLUMN public.survey_anonymized_data.generalized_industry IS
  'Industria del encuestado mapeada a taxonomía de 12 categorías por el LLM. NULL si no inferible.';
