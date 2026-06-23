-- ============================================================
-- Cashflow — Burn Rate Autopilot: cashflow.recurring_expense (CASHFLOW_PRD_PART_3)
-- ============================================================
-- Un "Gasto Recurrente" NO es una factura ni una transacción: es una REGLA de
-- proyección. El frontend (projection.ts) la expande en "eventos fantasma" al
-- vuelo sobre el horizonte del gráfico. Cero filas futuras en BD.
--
-- RLS plana con owner_id desnormalizado (= auth.uid()), consistente con el resto
-- del esquema (perf <50ms, sin subconsultas).
-- ============================================================

create table cashflow.recurring_expense (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references cashflow.tenant(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  amount     numeric(15, 2) not null check (amount > 0),
  currency   text not null default 'CLP',
  frequency  text not null check (frequency in ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
  next_date  date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cf_recurring_owner on cashflow.recurring_expense(owner_id);
create index idx_cf_recurring_tenant on cashflow.recurring_expense(tenant_id);

alter table cashflow.recurring_expense enable row level security;

create policy "cf_recurring_crud_own" on cashflow.recurring_expense for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger cf_recurring_set_updated_at before update on cashflow.recurring_expense
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.recurring_expense to authenticated;
