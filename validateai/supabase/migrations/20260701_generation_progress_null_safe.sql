-- Fase 16 (11D): merge_generation_progress tragaba el progreso cuando
-- validations.generation_progress era NULL. En prod la columna quedó nullable
-- (la migración previa con NOT NULL DEFAULT '{}' no aplicó por IF NOT EXISTS sobre
-- una columna pre-existente), y en Postgres `NULL || jsonb = NULL`, así que cada
-- merge sobre una fila con progreso NULL se perdía silenciosamente (afectaba el
-- conteo por-task del widget en premium y no-premium).
--
-- Fix: COALESCE en el RPC + endurecer la columna (default + backfill).

ALTER TABLE validations ALTER COLUMN generation_progress SET DEFAULT '{}'::jsonb;
UPDATE validations SET generation_progress = '{}'::jsonb WHERE generation_progress IS NULL;

CREATE OR REPLACE FUNCTION merge_generation_progress(
  p_id     uuid,
  p_key    text,
  p_status text
) RETURNS void
LANGUAGE sql AS $$
  UPDATE validations
  SET    generation_progress = COALESCE(generation_progress, '{}'::jsonb) || jsonb_build_object(p_key, p_status)
  WHERE  id = p_id;
$$;
