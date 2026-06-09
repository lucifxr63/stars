-- Series temporales financieras por empresa PYME.
-- Una fila por empresa por mes. Alimenta los gráficos de correlación macro ↔ operativo.
-- La tabla es agnóstica a la fuente: manual, CSV o API de terceros.

CREATE TABLE IF NOT EXISTS public.pyme_financials (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_rut               text        NOT NULL,
  period                    date        NOT NULL,   -- siempre primer día del mes: 2025-01-01

  -- Flujo de efectivo
  net_cash_flow_clp         numeric,               -- flujo de caja neto
  days_credit_granted       integer,               -- días de crédito promedio otorgados

  -- Operación
  cogs_clp                  numeric,               -- costo de ventas
  inventory_variation_pct   numeric,               -- variación de inventario (%)

  -- Ventas
  avg_ticket_clp            numeric,               -- ticket promedio por transacción
  monthly_volume_clp        numeric,               -- volumen transaccional total del mes

  -- Trazabilidad
  source                    text        NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('manual', 'csv_upload', 'api_push')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_company_period UNIQUE (company_rut, period)
);

CREATE INDEX IF NOT EXISTS idx_pyme_fin_rut_period
  ON public.pyme_financials (company_rut, period DESC);

-- RLS: cada empresa solo ve sus propios datos (vinculado por RUT declarado en profiles)
ALTER TABLE public.pyme_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pyme_financials_service_all"
  ON public.pyme_financials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_pyme_financials_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pyme_financials_updated_at
  BEFORE UPDATE ON public.pyme_financials
  FOR EACH ROW EXECUTE FUNCTION update_pyme_financials_updated_at();
