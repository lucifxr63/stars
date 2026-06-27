-- ============================================================
-- Cashflow Fase 2 — Settings de tenant (CFO Virtual)
-- ============================================================
-- Configuración fiscal (reserva de impuestos) y de alertas semanales.
-- ============================================================

alter table cashflow.tenant
  add column default_tax_rate numeric(5, 2) not null default 0.00 check (default_tax_rate >= 0 and default_tax_rate <= 100),
  add column weekly_alerts_enabled boolean not null default true;

notify pgrst, 'reload schema';
