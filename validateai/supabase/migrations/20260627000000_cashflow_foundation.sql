-- ============================================================
-- Cashflow MVP — Fundación de datos (esquema aislado `cashflow`)
-- ============================================================
-- Producto hermano de Validus en el MISMO proyecto Supabase, pero
-- bajo un esquema estrictamente aislado para soportar un futuro SSO
-- sin mezclar datos de ambos productos.
--
-- Decisiones de ingeniería (ver context.md):
--   * Desnormalización controlada: `auth_user_id` vive directo en
--     `categories` y `transactions` para RLS plana y rápida.
--   * RLS sin JOINs ni subconsultas de tablas: política plana
--     `auth_user_id = (select auth.uid())`. El `(select ...)` permite
--     que Postgres cachee auth.uid() como initPlan (1 vez por query,
--     no por fila) — clave para el objetivo < 50ms.
--   * ON DELETE CASCADE en todas las refs a auth.users: si el usuario
--     borra su cuenta central, sus datos de cashflow se eliminan.
--   * Trigger de identidad INDEPENDIENTE del de Validus
--     (on_auth_user_created). Ambos coexisten sobre auth.users.
--
-- Exposición a la API: este esquema se añade a `schemas` en
-- config.toml; sin eso supabase-js no lo alcanza. RLS sigue siendo
-- el guardián real; los GRANT solo abren la puerta para que RLS filtre.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- Esquema y permisos base
-- ------------------------------------------------------------
create schema if not exists cashflow;

grant usage on schema cashflow to anon, authenticated;

-- ------------------------------------------------------------
-- Helper: mantener updated_at (local al esquema cashflow)
-- ------------------------------------------------------------
create or replace function cashflow.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- TABLA: cashflow.profiles  (extiende la identidad de auth.users)
-- ============================================================
create table cashflow.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cashflow.profiles enable row level security;

create policy "cf_profiles_select_own"
  on cashflow.profiles for select
  using (id = (select auth.uid()));

create policy "cf_profiles_update_own"
  on cashflow.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create trigger cf_profiles_set_updated_at
  before update on cashflow.profiles
  for each row execute function cashflow.set_updated_at();

grant select, update on cashflow.profiles to authenticated;

-- ============================================================
-- TABLA: cashflow.categories  (clasificación ingreso/egreso)
-- ============================================================
create table cashflow.categories (
  id            uuid primary key default uuid_generate_v4(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  kind          text not null check (kind in ('income', 'expense')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_cf_categories_user on cashflow.categories(auth_user_id);

alter table cashflow.categories enable row level security;

create policy "cf_categories_crud_own"
  on cashflow.categories for all
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create trigger cf_categories_set_updated_at
  before update on cashflow.categories
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.categories to authenticated;

-- ============================================================
-- TABLA: cashflow.transactions  (registro contable principal)
-- ============================================================
create table cashflow.transactions (
  id            uuid primary key default uuid_generate_v4(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  category_id   uuid references cashflow.categories(id) on delete set null,
  amount        numeric(14, 2) not null check (amount > 0),
  kind          text not null check (kind in ('income', 'expense')),
  description   text,
  occurred_at   date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_cf_transactions_user on cashflow.transactions(auth_user_id);
create index idx_cf_transactions_user_date on cashflow.transactions(auth_user_id, occurred_at desc);

alter table cashflow.transactions enable row level security;

create policy "cf_transactions_crud_own"
  on cashflow.transactions for all
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create trigger cf_transactions_set_updated_at
  before update on cashflow.transactions
  for each row execute function cashflow.set_updated_at();

grant select, insert, update, delete on cashflow.transactions to authenticated;

-- ============================================================
-- Trigger de identidad: auto-provisión de cashflow.profiles
-- ============================================================
-- INDEPENDIENTE del trigger de Validus (on_auth_user_created).
-- Idempotente: un usuario SSO puede existir antes de entrar a Cashflow,
-- por eso on conflict do nothing.
create or replace function cashflow.handle_new_user()
returns trigger as $$
begin
  insert into cashflow.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_cashflow
  after insert on auth.users
  for each row execute function cashflow.handle_new_user();

-- Backfill: usuarios ya existentes en el proyecto compartido también
-- obtienen su perfil de cashflow (SSO retroactivo).
insert into cashflow.profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
from auth.users u
on conflict (id) do nothing;
