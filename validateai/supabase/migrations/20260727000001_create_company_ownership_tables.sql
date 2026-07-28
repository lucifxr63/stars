-- ================================================================================
-- TABLA DE INTELIGENCIA SOCIETARIA Y MALLAS EMPRESARIALES — BRALIDUS S-PULSE
-- Cobertura para Diarios Oficiales, CMF y Registro de Comercio de Chile
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rut TEXT NOT NULL UNIQUE,
    legal_name TEXT NOT NULL,
    fantasy_name TEXT,
    company_type TEXT CHECK (company_type IN ('SpA', 'SA', 'Ltda', 'EIRL', 'Sociedad en Comandita', 'Sociedad Colectiva')),
    constitution_date DATE,
    social_capital_clp NUMERIC(18, 2) DEFAULT 0,
    sii_status TEXT DEFAULT 'activo',
    diario_oficial_cve TEXT,
    cbr_inscription TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_ownership_meshes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_rut TEXT NOT NULL,
    partner_rut TEXT NOT NULL,
    partner_name TEXT NOT NULL,
    partner_type TEXT NOT NULL CHECK (partner_type IN ('person', 'company')),
    ownership_percentage NUMERIC(5, 2) DEFAULT 0 CHECK (ownership_percentage BETWEEN 0 AND 100),
    role TEXT NOT NULL CHECK (role IN ('shareholder', 'legal_representative', 'director', 'administrator')),
    entry_date DATE,
    source_document TEXT DEFAULT 'Diario Oficial Chile',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de búsqueda acelerada
CREATE INDEX IF NOT EXISTS idx_company_profiles_rut ON public.company_profiles(rut);
CREATE INDEX IF NOT EXISTS idx_company_profiles_name ON public.company_profiles(legal_name);
CREATE INDEX IF NOT EXISTS idx_company_ownership_target ON public.company_ownership_meshes(target_rut);
CREATE INDEX IF NOT EXISTS idx_company_ownership_partner ON public.company_ownership_meshes(partner_rut);

-- Row Level Security (RLS)
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_ownership_meshes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de perfiles societarios" ON public.company_profiles FOR SELECT USING (true);
CREATE POLICY "Escritura de perfiles por service_role" ON public.company_profiles FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'postgres');

CREATE POLICY "Lectura pública de mallas societarias" ON public.company_ownership_meshes FOR SELECT USING (true);
CREATE POLICY "Escritura de mallas por service_role" ON public.company_ownership_meshes FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'postgres');
