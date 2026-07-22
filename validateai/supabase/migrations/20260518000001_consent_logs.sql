-- ============================================================
-- MIGRACIÓN: consent_logs
-- Ley N° 21.719 de Protección de Datos Personales (Chile)
-- Vigente desde enero 2026
-- ============================================================

create table public.consent_logs (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  ip_address    text,                         -- IP del cliente al momento del consentimiento
  rut           text,                         -- RUT chileno formato XX.XXX.XXX-X
  consent_type  text        not null default 'data_processing',
  consented_at  timestamptz not null default now(),
  flagged       boolean     not null default false  -- false = sin consentimiento, true = aceptado
);

-- Índice para lookups rápidos por user_id (lo más frecuente)
create index idx_consent_logs_user on public.consent_logs(user_id);

-- Índice parcial para la query del middleware (solo registros válidos)
create index idx_consent_logs_flagged on public.consent_logs(user_id) where flagged = true;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.consent_logs enable row level security;

-- El usuario autenticado solo puede VER su propio registro
create policy "consent_logs_select_own"
  on public.consent_logs for select
  using (auth.uid() = user_id);

-- Nadie puede insertar desde el cliente (solo SERVICE_ROLE via Edge Function)
-- No se crea policy de INSERT → implícitamente bloqueado para roles no-service

-- Nadie puede DELETE ni UPDATE (inmutabilidad del consentimiento)
-- (No se crean policies de DELETE/UPDATE)

-- ============================================================
-- Comentarios de tabla para documentación
-- ============================================================
comment on table public.consent_logs is
  'Registro de consentimientos explícitos bajo Ley N° 21.719. Inmutable.';
comment on column public.consent_logs.flagged is
  'true = consentimiento aceptado. false = pendiente. El middleware rechaza con 403 si no existe registro con flagged=true.';
comment on column public.consent_logs.rut is
  'RUT chileno del usuario en formato XX.XXX.XXX-X. Opcional para usuarios extranjeros.';
