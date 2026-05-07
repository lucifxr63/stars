-- FacturaIA: Audit Logs
-- Requisito crítico CMF: trazabilidad de TODAS las operaciones financieras
-- Retención mínima: 5 años (art. 33 Ley Fintec)

-- ============================================================
-- TABLA: audit_logs (append-only, sin UPDATE ni DELETE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      VARCHAR(50) NOT NULL,   -- ej: 'invoice.created', 'risk.evaluated'
  table_name  VARCHAR(100) NOT NULL,
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: nadie puede borrar ni actualizar audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- La PYME solo ve sus propios logs
CREATE POLICY "audit_select_own" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Solo el sistema (service_role) puede insertar
-- El cliente no puede insertar directamente
CREATE POLICY "audit_insert_service_only" ON public.audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- Lectura total para admin
CREATE POLICY "admin_select_all_audit" ON public.audit_logs
  FOR SELECT TO admin_facturaia USING (true);

-- Índices para búsquedas frecuentes por auditoría CMF
CREATE INDEX idx_audit_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_action ON public.audit_logs(action);
CREATE INDEX idx_audit_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_created_at ON public.audit_logs(created_at DESC);

-- ============================================================
-- Función: log_audit_event (llamar desde Edge Functions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id   UUID,
  p_action    VARCHAR,
  p_table     VARCHAR,
  p_record_id UUID DEFAULT NULL,
  p_old       JSONB DEFAULT NULL,
  p_new       JSONB DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (p_user_id, p_action, p_table, p_record_id, p_old, p_new)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============================================================
-- TABLA: gran_empresa_ruts
-- RUTs pre-aprobados de grandes empresas (pagadores confiables)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gran_empresa_ruts (
  rut         VARCHAR(12) PRIMARY KEY,
  razon_social VARCHAR(255) NOT NULL,
  categoria   VARCHAR(50) NOT NULL DEFAULT 'gran_empresa',
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos iniciales de muestra (grandes empresas Chile)
INSERT INTO public.gran_empresa_ruts (rut, razon_social) VALUES
  ('96.806.980-2', 'Falabella Retail S.A.'),
  ('99.322.000-6', 'Cencosud S.A.'),
  ('76.354.771-9', 'Ripley Corp S.A.'),
  ('96.571.220-8', 'Entel S.A.'),
  ('90.160.000-7', 'Banco Santander Chile'),
  ('97.030.000-7', 'Banco de Chile'),
  ('90.400.000-1', 'BancoEstado'),
  ('99.580.280-7', 'Walmart Chile S.A.'),
  ('76.048.256-3', 'Amazon Web Services Chile'),
  ('96.982.040-2', 'LATAM Airlines Group')
ON CONFLICT (rut) DO NOTHING;

-- RLS en gran_empresa_ruts: solo lectura pública (necesario para evaluar facturas)
ALTER TABLE public.gran_empresa_ruts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gran_empresa_read_all" ON public.gran_empresa_ruts
  FOR SELECT USING (true);
