-- ============================================================
-- Épica 4: Webhooks y Eventos (Arquitectura orientada a eventos)
-- Tabla para gestionar las suscripciones de los desarrolladores
-- ============================================================

create table public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  
  endpoint_url text not null check (endpoint_url ~ '^https?://'),
  events text[] not null default '{}',
  secret text not null default encode(gen_random_bytes(32), 'hex'),
  is_active boolean not null default true,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices para búsqueda rápida por tenant y eventos
create index idx_webhook_subs_profile on public.webhook_subscriptions(profile_id);
create index idx_webhook_subs_events on public.webhook_subscriptions using gin(events);

-- ============================================
-- RLS POLICIES
-- ============================================
alter table public.webhook_subscriptions enable row level security;

-- Los usuarios solo pueden ver sus propios webhooks
create policy "Users can view own webhooks"
  on public.webhook_subscriptions for select
  using (auth.uid() = profile_id);

-- Los usuarios pueden insertar sus webhooks
create policy "Users can insert own webhooks"
  on public.webhook_subscriptions for insert
  with check (auth.uid() = profile_id);

-- Los usuarios pueden actualizar sus webhooks
create policy "Users can update own webhooks"
  on public.webhook_subscriptions for update
  using (auth.uid() = profile_id);

-- Los usuarios pueden eliminar sus webhooks
create policy "Users can delete own webhooks"
  on public.webhook_subscriptions for delete
  using (auth.uid() = profile_id);

-- ============================================
-- FUNCIONES TRIGGER
-- ============================================
create or replace function update_webhook_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tr_webhook_subs_updated_at
before update on public.webhook_subscriptions
for each row execute procedure update_webhook_updated_at();
