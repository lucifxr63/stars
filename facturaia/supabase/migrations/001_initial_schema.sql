-- FacturaIA: Schema inicial
-- Cumplimiento: Ley Fintec Chile + Ley 19.628 Protección de Datos Personales
-- Requiere extensión uuid-ossp

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: companies
-- Representa a cada PYME registrada en la plataforma
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rut             VARCHAR(12) NOT NULL UNIQUE,  -- Formato: 12.345.678-9
  razon_social    VARCHAR(255) NOT NULL,
  giro            VARCHAR(255),
  direccion       TEXT,
  email_contacto  VARCHAR(255),
  telefono        VARCHAR(20),
  es_gran_empresa BOOLEAN NOT NULL DEFAULT false,  -- Flag para aprobación automática
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: invoices
-- Facturas subidas por cada PYME para solicitar liquidez
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id              UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  folio                   VARCHAR(50) NOT NULL,
  rut_emisor              VARCHAR(12) NOT NULL,
  rut_receptor            VARCHAR(12) NOT NULL,
  razon_social_receptor   VARCHAR(255) NOT NULL,
  monto_neto              BIGINT NOT NULL,  -- En CLP, sin decimales
  monto_iva               BIGINT NOT NULL,
  monto_total             BIGINT NOT NULL,
  fecha_emision           DATE NOT NULL,
  fecha_vencimiento       DATE NOT NULL,
  estado                  VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','en_evaluacion','aprobada','rechazada','liquidada')),
  archivo_url             TEXT,  -- URL a Supabase Storage (cifrado en reposo)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, folio, rut_emisor)
);

-- ============================================================
-- TABLA: risk_assessments
-- Resultado del motor de IA para cada factura evaluada
-- ============================================================
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id              UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tax_risk_score          SMALLINT NOT NULL CHECK (tax_risk_score BETWEEN 0 AND 100),
  score_breakdown         JSONB NOT NULL DEFAULT '{}',  -- Detalle de factores del score
  pagador_es_gran_empresa BOOLEAN NOT NULL DEFAULT false,
  aprobacion_automatica   BOOLEAN NOT NULL DEFAULT false,
  recomendacion           VARCHAR(10) NOT NULL CHECK (recomendacion IN ('aprobar','revisar','rechazar')),
  razon                   TEXT NOT NULL,
  monto_a_transferir      BIGINT NOT NULL,  -- monto_total - comision
  comision_flat           BIGINT NOT NULL,  -- 1.5% del monto_total
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Trigger: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Índices para queries frecuentes
-- ============================================================
CREATE INDEX idx_companies_user_id ON public.companies(user_id);
CREATE INDEX idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX idx_invoices_estado ON public.invoices(estado);
CREATE INDEX idx_risk_assessments_invoice_id ON public.risk_assessments(invoice_id);
