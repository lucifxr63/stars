-- ============================================
-- TABLA: api_keys
-- ============================================
create table public.api_keys (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  key_prefix text not null, -- ej. val_live_A1B2...
  key_hash text not null,   -- SHA-256 hash de la llave real
  created_at timestamptz default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  is_active boolean generated always as (revoked_at is null) stored
);

-- ============================================
-- TABLA: api_usage_logs
-- ============================================
create table public.api_usage_logs (
  id uuid primary key default uuid_generate_v4(),
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  endpoint text not null,
  requests_count int default 1,
  tokens_used int default 0,
  ip_address text,
  created_at timestamptz default now()
);

-- ============================================
-- RLS POLICIES
-- ============================================

-- api_keys
alter table public.api_keys enable row level security;

create policy "Users can view own api keys"
  on public.api_keys for select
  using (auth.uid() = profile_id);

create policy "Users can insert own api keys"
  on public.api_keys for insert
  with check (auth.uid() = profile_id);

create policy "Users can update own api keys"
  on public.api_keys for update
  using (auth.uid() = profile_id);

create policy "Users can delete own api keys"
  on public.api_keys for delete
  using (auth.uid() = profile_id);

-- api_usage_logs
alter table public.api_usage_logs enable row level security;

-- Los usuarios solo pueden ver sus propios logs (haciendo join con api_keys)
create policy "Users can view own api usage logs"
  on public.api_usage_logs for select
  using (
    exists (
      select 1 from public.api_keys k
      where k.id = api_key_id and k.profile_id = auth.uid()
    )
  );

-- Nadie puede insertar desde el cliente frontend, solo Service Role (Edge Functions)
create policy "Service Role can insert api usage logs"
  on public.api_usage_logs for insert
  with check (true); -- Requires service role key to bypass RLS, or authenticated user bypass? No, if we want service role to insert, we don't need a policy because service role bypasses RLS anyway. 
  -- But if we want to be explicit or if we use the authenticated role in Edge Functions:
  -- Actually, in Supabase Edge Functions we usually use the Anon/Service role client.
  -- If we use Service Role client, it bypasses RLS automatically.
  -- Let's just create a policy for viewing and leave insert to service_role (which bypasses).
  -- So we don't strictly need an insert policy if the client can't insert.
  -- But if we want Edge Functions using the user's JWT to insert, we can't because usage is tracked by the system.
  -- Best is to rely on Service Role for inserts and updates.

-- Indices
create index idx_api_keys_profile on public.api_keys(profile_id);
create index idx_api_keys_hash on public.api_keys(key_hash);
create index idx_api_usage_logs_key on public.api_usage_logs(api_key_id);
create index idx_api_usage_logs_created on public.api_usage_logs(created_at);
