-- Persiste el progreso de cada task de generación por separado.
-- Permite reanudar la generación si se interrumpe (conexión caída, tab cerrado).

ALTER TABLE validations
  ADD COLUMN IF NOT EXISTS generation_progress jsonb NOT NULL DEFAULT '{}';

-- RPC atómica: actualiza una sola key del JSONB sin race conditions.
CREATE OR REPLACE FUNCTION merge_generation_progress(
  p_id     uuid,
  p_key    text,
  p_status text
) RETURNS void
LANGUAGE sql AS $$
  UPDATE validations
  SET    generation_progress = generation_progress || jsonb_build_object(p_key, p_status)
  WHERE  id = p_id;
$$;
