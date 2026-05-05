-- PASO 1: Tabla para logs de agentes de datos asíncronos (flujo Premium)
-- Almacena los JSONs crudos retornados por cada agente externo
-- y el resumen ejecutivo generado por el Sintetizador IA.

CREATE TABLE IF NOT EXISTS public.validation_agents_log (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_id uuid NOT NULL REFERENCES public.validations(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- JSONs crudos de cada agente (null si el agente falló)
  reddit_data   jsonb DEFAULT NULL,
  trends_data   jsonb DEFAULT NULL,

  -- Estado por agente: 'success' | 'error' | 'pending'
  reddit_status  text NOT NULL DEFAULT 'pending' CHECK (reddit_status  IN ('pending', 'success', 'error')),
  trends_status  text NOT NULL DEFAULT 'pending' CHECK (trends_status  IN ('pending', 'success', 'error')),

  -- Resumen ejecutivo generado por el Sintetizador IA (máx ~1000 chars)
  executive_summary text DEFAULT NULL,

  -- Metadata de ejecución
  agents_completed_at timestamptz DEFAULT NULL,
  synthesis_completed_at timestamptz DEFAULT NULL,
  error_details jsonb DEFAULT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices útiles para las queries del frontend
CREATE INDEX IF NOT EXISTS idx_val_agents_log_validation_id
  ON public.validation_agents_log(validation_id);

CREATE INDEX IF NOT EXISTS idx_val_agents_log_user_id
  ON public.validation_agents_log(user_id);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_val_agents_log_updated_at ON public.validation_agents_log;
CREATE TRIGGER trg_val_agents_log_updated_at
  BEFORE UPDATE ON public.validation_agents_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS: solo el propio usuario puede leer/escribir sus logs.
-- La Edge Function usa service_role (bypass RLS) para insertar.
-- ============================================================
ALTER TABLE public.validation_agents_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent logs"
  ON public.validation_agents_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT y UPDATE los hace solo la Edge Function con service_role key,
-- por lo que no se necesita policy pública para escritura.
-- Si en el futuro se requiere escritura desde el cliente, agregar:
-- CREATE POLICY "Users can insert own agent logs" ON public.validation_agents_log
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
