-- FacturaIA: Row Level Security (RLS)
-- Requisito crítico: cada PYME solo accede a sus propios datos
-- Cumplimiento: Ley 19.628 Chile - Principio de Finalidad y Seguridad

-- ============================================================
-- Habilitar RLS en todas las tablas sensibles
-- ============================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES: companies
-- Una PYME solo ve y modifica su propia empresa
-- ============================================================
CREATE POLICY "companies_select_own" ON public.companies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "companies_insert_own" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "companies_update_own" ON public.companies
  FOR UPDATE USING (auth.uid() = user_id);

-- No permitimos DELETE de empresas (protección de datos históricos para CMF)

-- ============================================================
-- POLICIES: invoices
-- Una PYME solo accede a facturas de su empresa
-- ============================================================
CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE companies.id = invoices.company_id
        AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "invoices_insert_own" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE companies.id = invoices.company_id
        AND companies.user_id = auth.uid()
    )
  );

CREATE POLICY "invoices_update_own" ON public.invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE companies.id = invoices.company_id
        AND companies.user_id = auth.uid()
    )
  );

-- ============================================================
-- POLICIES: risk_assessments
-- Solo lectura para la PYME dueña de la factura
-- Escritura reservada para la Edge Function (service_role)
-- ============================================================
CREATE POLICY "risk_select_own" ON public.risk_assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.invoices
      JOIN public.companies ON companies.id = invoices.company_id
      WHERE invoices.id = risk_assessments.invoice_id
        AND companies.user_id = auth.uid()
    )
  );

-- ============================================================
-- ROLE: admin_facturaia
-- Para la Mesa Directiva (acceso de solo lectura a todo)
-- Nota: En producción, asignar este role manualmente vía Supabase Dashboard
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin_facturaia') THEN
    CREATE ROLE admin_facturaia;
  END IF;
END
$$;

CREATE POLICY "admin_select_all_companies" ON public.companies
  FOR SELECT TO admin_facturaia USING (true);

CREATE POLICY "admin_select_all_invoices" ON public.invoices
  FOR SELECT TO admin_facturaia USING (true);

CREATE POLICY "admin_select_all_risk" ON public.risk_assessments
  FOR SELECT TO admin_facturaia USING (true);
