-- FacturaIA: Tabla para Cartas de Intención (LOI) — Design Partners
-- Sprint 4: Go-to-Market

CREATE TABLE IF NOT EXISTS public.loi_submissions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre                    VARCHAR(255) NOT NULL,
  empresa                   VARCHAR(255) NOT NULL,
  rut                       VARCHAR(12),
  email                     VARCHAR(255) NOT NULL UNIQUE,
  telefono                  VARCHAR(30),
  volumen_mensual_estimado  BIGINT DEFAULT 0,
  estado                    VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                              CHECK (estado IN ('pendiente','contactado','onboarded','descartado')),
  notas_internas            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla pública para inserción sin autenticación (pre-registro)
ALTER TABLE public.loi_submissions ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede insertar (formulario público)
CREATE POLICY "loi_public_insert" ON public.loi_submissions
  FOR INSERT WITH CHECK (true);

-- Solo admin puede leer
CREATE POLICY "loi_admin_read" ON public.loi_submissions
  FOR SELECT TO admin_facturaia USING (true);

CREATE INDEX idx_loi_estado ON public.loi_submissions(estado);
CREATE INDEX idx_loi_created_at ON public.loi_submissions(created_at DESC);
