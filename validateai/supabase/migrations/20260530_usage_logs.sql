-- Tabla de log de uso por usuario para rate limiting en ai-validate.
-- El guard en el edge function lee esta tabla antes de cada llamada AI.

CREATE TABLE IF NOT EXISTS usage_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  prompt_type text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índice para la query de rate limit: user + ventana de 24h
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_day
  ON usage_logs (user_id, created_at DESC);

-- RLS: solo service_role puede leer/insertar (el edge function usa service key)
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON usage_logs
  USING (false)
  WITH CHECK (false);
