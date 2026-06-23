-- ============================================================
-- Cashflow MVP — Re-modelado al PRD (tenant / bank_account / transaction / invoice)
-- ============================================================
-- Reemplaza el modelo plano inicial (categories/transactions por usuario) por
-- el modelo financiero multi-tenant del CASHFLOW_PRD.md:
--   tenant -> bank_account -> transaction   (movimientos reales)
--   tenant -> invoice                       (A/R y A/P, motor de proyección)
--
-- DECISIÓN DE RLS (Friction Check):
-- El PRD pide RLS "anclado al tenant". Pero el context.md prohíbe subconsultas
-- en RLS (perf <50ms). Reconciliación: DESNORMALIZAR `owner_id` (= auth.uid())
-- en TODAS las tablas tenant-scoped → la RLS queda PLANA `owner_id = auth.uid()`,
-- sin JOINs, mientras tenant_id/account_id mantienen la integridad relacional.
--
-- Proyecto Supabase compartido con Validus → esquema aislado `cashflow`, sin
-- tocar `public`. owner_id referencia auth.users con ON DELETE CASCADE.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 0. Drop del modelo plano inicial (sin datos reales)
-- ------------------------------------------------------------
drop table if exists cashflow.transactions cascade;
drop table if exists cashflow.categories cascade;

-- helper updated_at (idempotente)
create or replace function cashflow.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. cashflow.tenant
-- ============================================================
create table cashflow.tenant (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Mi empresa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cf_tenant_owner on cashflow.tenant(owner_id);

alter table cashflow.tenant enable row level security;
create policy "cf_tenant_crud_own" on cashflow.tenant for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger cf_tenant_set_updated_at before update on cashflow.tenant
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.tenant to authenticated;

-- ============================================================
-- 2. cashflow.bank_account
-- ============================================================
create table cashflow.bank_account (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references cashflow.tenant(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  currency        text not null default 'CLP',
  current_balance numeric(16, 2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_cf_account_owner on cashflow.bank_account(owner_id);
create index idx_cf_account_tenant on cashflow.bank_account(tenant_id);

alter table cashflow.bank_account enable row level security;
create policy "cf_account_crud_own" on cashflow.bank_account for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger cf_account_set_updated_at before update on cashflow.bank_account
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.bank_account to authenticated;

-- ============================================================
-- 3. cashflow.transaction  (movimiento real de caja)
-- ============================================================
create table cashflow.transaction (
  id               uuid primary key default uuid_generate_v4(),
  account_id       uuid not null references cashflow.bank_account(id) on delete cascade,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  transaction_date date not null default current_date,
  amount           numeric(16, 2) not null check (amount > 0),
  type             text not null check (type in ('IN', 'OUT')),
  category         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_cf_tx_owner on cashflow.transaction(owner_id);
create index idx_cf_tx_owner_date on cashflow.transaction(owner_id, transaction_date desc);
create index idx_cf_tx_account on cashflow.transaction(account_id);

alter table cashflow.transaction enable row level security;
create policy "cf_tx_crud_own" on cashflow.transaction for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger cf_tx_set_updated_at before update on cashflow.transaction
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.transaction to authenticated;

-- ============================================================
-- 4. cashflow.invoice  (A/R y A/P — motor de proyección)
-- ============================================================
create table cashflow.invoice (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references cashflow.tenant(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('AR', 'AP')),
  total_amount  numeric(16, 2) not null check (total_amount > 0),
  currency      text not null default 'CLP',
  contact_name  text,
  issue_date    date not null default current_date,
  due_date      date not null,
  status        text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'CANCELLED')),
  source_system text not null default 'MANUAL' check (source_system in ('MANUAL', 'SII', 'ODOO')),
  external_id   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_cf_invoice_owner on cashflow.invoice(owner_id);
create index idx_cf_invoice_owner_due on cashflow.invoice(owner_id, due_date);
create index idx_cf_invoice_owner_type_status on cashflow.invoice(owner_id, type, status);

alter table cashflow.invoice enable row level security;
create policy "cf_invoice_crud_own" on cashflow.invoice for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create trigger cf_invoice_set_updated_at before update on cashflow.invoice
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.invoice to authenticated;

-- ============================================================
-- 5. Mantenimiento de current_balance (trigger sobre transaction)
-- ============================================================
-- Mantiene bank_account.current_balance consistente: IN suma, OUT resta.
-- Cubre insert / delete / update (incl. cambio de cuenta).
create or replace function cashflow.apply_tx_balance()
returns trigger as $$
declare
  delta_old numeric(16, 2) := 0;
  delta_new numeric(16, 2) := 0;
begin
  if (TG_OP = 'DELETE' or TG_OP = 'UPDATE') then
    delta_old := case when OLD.type = 'IN' then OLD.amount else -OLD.amount end;
    update cashflow.bank_account set current_balance = current_balance - delta_old
      where id = OLD.account_id;
  end if;
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    delta_new := case when NEW.type = 'IN' then NEW.amount else -NEW.amount end;
    update cashflow.bank_account set current_balance = current_balance + delta_new
      where id = NEW.account_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger cf_tx_apply_balance
  after insert or update or delete on cashflow.transaction
  for each row execute function cashflow.apply_tx_balance();

-- ============================================================
-- 6. Identidad: profile + tenant por defecto al registrarse (TTV <5min)
-- ============================================================
create or replace function cashflow.handle_new_user()
returns trigger as $$
begin
  insert into cashflow.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;

  -- Tenant por defecto: solo si el usuario aún no tiene ninguno.
  insert into cashflow.tenant (owner_id, name)
  select new.id, 'Mi empresa'
  where not exists (select 1 from cashflow.tenant where owner_id = new.id);

  return new;
end;
$$ language plpgsql security definer;

-- Backfill: tenant por defecto para usuarios existentes sin tenant.
insert into cashflow.tenant (owner_id, name)
select u.id, 'Mi empresa'
from auth.users u
where not exists (select 1 from cashflow.tenant t where t.owner_id = u.id);
