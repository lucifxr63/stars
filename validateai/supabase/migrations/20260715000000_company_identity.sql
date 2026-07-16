-- Identidad de empresa compartida del ecosistema Scouttech.
--
-- Una fila por usuario (auth.users compartido entre Validus/Denarius/Licitus/nexus/Bralidus).
-- Guarda el RUT de la EMPRESA/startup analizada — un identificador de negocio, público en el
-- Registro de Empresas y Sociedades (RES) — junto a su razón social. NO es el RUT PERSONAL del
-- usuario: ese sigue hasheado y nunca en claro (ver 20260526_dia_d.sql, Ley 21.719).
--
-- Cualquier app del ecosistema la lee para pasar `company_rut` a Bralidus → S-Pulse (grafo
-- societario). Se recolecta una sola vez; todas las apps la comparten.

create table if not exists public.company_identity (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  company_rut  text not null,
  company_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.company_identity is
  'Identidad de empresa (RUT de negocio + razón social) del usuario, compartida por el ecosistema Scouttech. NO es el RUT personal (ese va hasheado, Día D).';
comment on column public.company_identity.company_rut is
  'RUT de la empresa/startup analizada, formato con guión (ej: 76123456-K). Identificador de negocio, no PII personal.';

-- ── RLS: cada usuario ve/edita solo su propia fila ───────────────────────────
alter table public.company_identity enable row level security;

create policy "company_identity_own_select"
  on public.company_identity for select
  using (auth.uid() = user_id);

create policy "company_identity_own_insert"
  on public.company_identity for insert
  with check (auth.uid() = user_id);

create policy "company_identity_own_update"
  on public.company_identity for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── updated_at (reusa la función existente del schema compartido) ─────────────
create trigger company_identity_set_updated_at
  before update on public.company_identity
  for each row execute function public.set_updated_at();
