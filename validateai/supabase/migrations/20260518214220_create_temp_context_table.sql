-- Migration para temp_context (Almacén temporal de asincronía)
-- Utilizado por webhooks (PJUD, Fintoc, etc.) antes de ser procesado por la IA.

CREATE TABLE temp_context (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  validation_id uuid REFERENCES validations(id) ON DELETE CASCADE NOT NULL,
  source text NOT NULL, -- Ej: 'fintoc', 'pjud', 'inapi'
  payload jsonb NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  created_at timestamp with time zone DEFAULT now()
);

-- Índices de búsqueda para agilizar la recolección
CREATE INDEX idx_temp_context_validation_id ON temp_context(validation_id);
CREATE INDEX idx_temp_context_user_id ON temp_context(user_id);
CREATE INDEX idx_temp_context_status ON temp_context(status);

-- RLS: Seguridad
ALTER TABLE temp_context ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden leer su propio contexto temporal (útil para Realtime UI)
CREATE POLICY "Users can view their own temp_context"
ON temp_context FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Solo service_role puede insertar o modificar (via webhooks/edge functions)
-- (El SDK de Fintoc o PJUD lo usan con la Service Key)
CREATE POLICY "Service role full access on temp_context"
ON temp_context FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
