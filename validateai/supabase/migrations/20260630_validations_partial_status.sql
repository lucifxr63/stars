-- Fase 15 (11B): estado 'partial'/'failed' explícito en validations.status.
-- Hoy runTasksInBackground marca siempre 'completed' aunque fallen secciones; el
-- fallo parcial vivía solo en generation_progress (JSONB). Ampliamos el CHECK para
-- que el estado sea honesto en BD y la UI pueda surfaciarlo.
--   completed = todas las secciones del tier OK
--   partial   = algunas OK, algunas error
--   failed    = ninguna OK
-- El nombre 'validations_status_check' es el autogenerado por el CHECK de columna
-- en 001_initial_schema.sql (status in ('in_progress','completed','archived')).

ALTER TABLE public.validations DROP CONSTRAINT IF EXISTS validations_status_check;

ALTER TABLE public.validations
  ADD CONSTRAINT validations_status_check
  CHECK (status IN ('in_progress', 'completed', 'archived', 'partial', 'failed'));
