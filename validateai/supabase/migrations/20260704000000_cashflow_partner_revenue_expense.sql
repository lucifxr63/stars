-- ============================================================
-- Cashflow — Aportes de socios / Gastos / Ingresos SaaS
-- (reconciliación de nextstep.md sobre el modelo PRD vivo)
-- ============================================================
-- ⚠️ BORRADOR — NO APLICADO A PROD. Revisar y aplicar de forma AISLADA
--    (SQL Editor, una sola transacción) + `migration repair --status applied
--    20260704000000`. NUNCA `supabase db push` contra este proyecto
--    (tracking de migraciones roto). Ver memoria validus-migration-tracking-broken.
--
-- nextstep.md proponía un esquema PARALELO (enterprises / enterprise_users con
-- RLS por subconsulta). Eso (a) colisiona con el modelo `cashflow` ya vivo
-- (tenant/bank_account/transaction/invoice) y (b) viola la regla de context.md:
-- "Prohibición de subconsultas en RLS". Reconciliación adoptada:
--
--   * Se RE-USA `cashflow.tenant` como la entidad empresa (multi-tenant ya vivo).
--   * Se AÑADEN 3 tablas nuevas en el esquema aislado `cashflow`:
--       partner_contributions  (Aportes de Socios — préstamo a la empresa)
--       expense                (Gastos Operacionales — funded_by + IVA)
--       revenue                (Ingresos SaaS — USD→CLP + comisión + IVA)
--   * RLS PLANA `owner_id = (select auth.uid())`, `owner_id` desnormalizado +
--     tenant_id para integridad — idéntico al resto del esquema.
--   * IVA: NO se hardcodea 19%. `vat_amount` es editable y `vat_status`
--     ('AFECTO' | 'EXENTO') alimenta el toggle de UI. SII → Fase 2.
-- ============================================================

create extension if not exists "uuid-ossp";

-- helper updated_at (idempotente; ya existe en prod, se redefine sin daño)
create or replace function cashflow.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. cashflow.partner_contributions  (Aportes de Socios)
-- ============================================================
-- Inyección de capital bajo premisa de PRÉSTAMO a la empresa (deuda
-- capitalizable). Trazabilidad de emisor + referencia de transacción.
create table cashflow.partner_contributions (
  id                    uuid primary key default uuid_generate_v4(),
  tenant_id             uuid not null references cashflow.tenant(id) on delete cascade,
  owner_id              uuid not null references auth.users(id) on delete cascade,
  record_date           date not null default current_date,
  partner_name          text not null,
  amount_clp            numeric(16, 2) not null check (amount_clp > 0),
  transaction_reference text,
  financial_item        text,
  description           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_cf_contrib_owner on cashflow.partner_contributions(owner_id);
create index idx_cf_contrib_owner_date on cashflow.partner_contributions(owner_id, record_date desc);
create index idx_cf_contrib_tenant on cashflow.partner_contributions(tenant_id);

alter table cashflow.partner_contributions enable row level security;
create policy "cf_contrib_crud_own" on cashflow.partner_contributions for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger cf_contrib_set_updated_at before update on cashflow.partner_contributions
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.partner_contributions to authenticated;

-- ============================================================
-- 2. cashflow.expense  (Gastos Operacionales con fuente de fondeo + IVA)
-- ============================================================
-- Distinto de `transaction` (movimiento real genérico): captura la FUENTE de
-- liquidez (Cuenta Empresa vs Aporte de Socios) y el desglose neto/IVA/total.
create table cashflow.expense (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references cashflow.tenant(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  record_date  date not null default current_date,
  funded_by    text not null default 'COMPANY' check (funded_by in ('COMPANY', 'PARTNER')),
  category     text,
  provider     text,
  description  text,
  net_amount   numeric(16, 2) not null check (net_amount >= 0),
  -- IVA configurable manualmente (NO 19% rígido). vat_status alimenta el toggle.
  vat_status   text not null default 'EXENTO' check (vat_status in ('AFECTO', 'EXENTO')),
  vat_amount   numeric(16, 2) not null default 0 check (vat_amount >= 0),
  total_amount numeric(16, 2) not null check (total_amount >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_cf_expense_owner on cashflow.expense(owner_id);
create index idx_cf_expense_owner_date on cashflow.expense(owner_id, record_date desc);
create index idx_cf_expense_tenant on cashflow.expense(tenant_id);

alter table cashflow.expense enable row level security;
create policy "cf_expense_crud_own" on cashflow.expense for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger cf_expense_set_updated_at before update on cashflow.expense
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.expense to authenticated;

-- ============================================================
-- 3. cashflow.revenue  (Ingresos SaaS — conciliación multimoneda)
-- ============================================================
-- Conciliación USD→CLP de la pasarela (Lemon Squeezy), comisión deducida e
-- IVA Débito configurable. net_income_clp = lo que realmente entra a caja.
create table cashflow.revenue (
  id                 uuid primary key default uuid_generate_v4(),
  tenant_id          uuid not null references cashflow.tenant(id) on delete cascade,
  owner_id           uuid not null references auth.users(id) on delete cascade,
  record_date        date not null default current_date,
  client_name        text,
  plan_name          text,
  gross_amount_usd   numeric(16, 2) not null default 0 check (gross_amount_usd >= 0),
  exchange_rate      numeric(16, 4) not null default 0 check (exchange_rate >= 0),
  gross_amount_clp   numeric(16, 2) not null default 0 check (gross_amount_clp >= 0),
  gateway_commission numeric(16, 2) not null default 0 check (gateway_commission >= 0),
  net_income_clp     numeric(16, 2) not null default 0 check (net_income_clp >= 0),
  -- IVA configurable manualmente (NO 19% rígido).
  vat_status         text not null default 'EXENTO' check (vat_status in ('AFECTO', 'EXENTO')),
  vat_amount         numeric(16, 2) not null default 0 check (vat_amount >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_cf_revenue_owner on cashflow.revenue(owner_id);
create index idx_cf_revenue_owner_date on cashflow.revenue(owner_id, record_date desc);
create index idx_cf_revenue_tenant on cashflow.revenue(tenant_id);

alter table cashflow.revenue enable row level security;
create policy "cf_revenue_crud_own" on cashflow.revenue for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger cf_revenue_set_updated_at before update on cashflow.revenue
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.revenue to authenticated;

-- Recargar el cache de esquema de PostgREST para exponer las tablas vía API.
notify pgrst, 'reload schema';
