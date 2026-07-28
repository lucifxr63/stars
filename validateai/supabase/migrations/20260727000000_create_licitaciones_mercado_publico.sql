-- ================================================================================
-- TABLA CANÓNICA DE LICITACIONES Y OPORTUNIDADES B2G — BRALIDUS / MERCADO PÚBLICO
-- Cobertura completa para los 9 mecanismos de contratación bajo Ley 21.634
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.licitaciones_mercado_publico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_rut TEXT,
    buyer_org_code TEXT,
    source_type TEXT NOT NULL CHECK (
        source_type IN (
            'tender',             -- Licitación Pública (L1, LE, LP, LQ, LR)
            'agile_purchase',     -- Compra Ágil (COT via API v2)
            'private_tender',     -- Licitación Privada (B2)
            'convenio_marco',     -- Convenio Marco (CO)
            'grandes_compras',     -- Grandes Compras (> 1.000 UTM)
            'trato_directo',      -- Trato Directo (TD)
            'consulta_mercado',   -- Consulta Mercado / RFI
            'contrato_publico',   -- Contratos Públicos y Hitos
            'nuevos_mecanismos'   -- Compra de Innovación CPI Ley 21.634
        )
    ),
    status_code TEXT NOT NULL DEFAULT 'publicada' CHECK (
        status_code IN ('publicada', 'adjudicada', 'cerrada', 'desierta', 'revocada')
    ),
    amount_estimated NUMERIC(18, 2) DEFAULT 0,
    currency TEXT DEFAULT 'CLP',
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closing_at TIMESTAMPTZ,
    award_at TIMESTAMPTZ,
    category TEXT DEFAULT 'Contratación Pública',
    official_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    items JSONB DEFAULT '[]'::jsonb,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de alto rendimiento para filtros por tipo, fecha y estado
CREATE INDEX IF NOT EXISTS idx_mp_licitaciones_source_type ON public.licitaciones_mercado_publico(source_type);
CREATE INDEX IF NOT EXISTS idx_mp_licitaciones_status ON public.licitaciones_mercado_publico(status_code);
CREATE INDEX IF NOT EXISTS idx_mp_licitaciones_published ON public.licitaciones_mercado_publico(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_licitaciones_closing ON public.licitaciones_mercado_publico(closing_at ASC);
CREATE INDEX IF NOT EXISTS idx_mp_licitaciones_code ON public.licitaciones_mercado_publico(external_code);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.licitaciones_mercado_publico ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública y escritura para service_role
CREATE POLICY "Lectura pública de licitaciones Mercado Público"
    ON public.licitaciones_mercado_publico FOR SELECT
    USING (true);

CREATE POLICY "Escritura de licitaciones por Service Role"
    ON public.licitaciones_mercado_publico FOR ALL
    USING (auth.role() = 'service_role' OR auth.role() = 'postgres');

-- Trigger para actualización automática de updated_at
CREATE OR REPLACE FUNCTION update_licitaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_licitaciones_updated_at ON public.licitaciones_mercado_publico;
CREATE TRIGGER trg_licitaciones_updated_at
    BEFORE UPDATE ON public.licitaciones_mercado_publico
    FOR EACH ROW
    EXECUTE FUNCTION update_licitaciones_updated_at();
