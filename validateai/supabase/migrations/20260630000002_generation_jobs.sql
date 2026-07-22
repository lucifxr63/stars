-- Fase 15 (11C-a): cola de jobs de generación para desacoplar la ejecución de la
-- pestaña del navegador. El frontend ENCOLA (status=queued); un worker server-side
-- (Edge process-generation-jobs, invocado por pg_cron) ejecuta las tasks y avanza
-- el estado. La fuente de verdad de orquestación es esta tabla; el worker también
-- sincroniza validations.status + generation_progress para no romper el widget.

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_id UUID        NOT NULL REFERENCES public.validations(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier          TEXT        NOT NULL DEFAULT 'free',
  mode          TEXT        NOT NULL DEFAULT 'detailed',   -- quick | detailed | premium
  is_premium    BOOLEAN     NOT NULL DEFAULT false,
  status        TEXT        NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'partial', 'done', 'failed')),
  -- tasks: [{ id, type, status: pending|success|error, attempts, last_error }]
  tasks         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  context       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  attempts      INT         NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotencia de encolado: un solo job ACTIVO por validación.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_generation_job
  ON public.generation_jobs(validation_id)
  WHERE status IN ('queued', 'running');

-- El worker barre por estado activo, más antiguo primero.
CREATE INDEX IF NOT EXISTS idx_generation_jobs_active
  ON public.generation_jobs(status, created_at)
  WHERE status IN ('queued', 'running');

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- SELECT: el usuario lee SUS jobs (para el polling del widget).
-- Escritura (INSERT/UPDATE): sin política → solo service_role (Edge) puede escribir.
CREATE POLICY "read_own_generation_jobs"
  ON public.generation_jobs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
