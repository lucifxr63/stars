-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLA: profiles (extiende auth.users)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- TABLA: validations
-- ============================================
create table public.validations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'in_progress' check (status in ('in_progress', 'completed', 'archived')),
  current_step int default 1 check (current_step between 1 and 6),

  idea_name text,
  idea_description text,
  idea_industry text,

  questions_answers jsonb default '[]'::jsonb,

  customer_segment text,
  customer_pain_points text[],
  customer_context text,

  value_proposition text,
  differentiator text,

  mvp_type text check (mvp_type in ('web_app', 'mobile_app', 'service', 'marketplace', 'saas', 'api')),
  mvp_features jsonb default '[]'::jsonb,
  mvp_user_flow text,

  summary_json jsonb,
  ai_feedback text,
  validation_score int check (validation_score between 0 and 100),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.validations enable row level security;

create policy "Users can CRUD own validations"
  on public.validations for all
  using (auth.uid() = user_id);

create index idx_validations_user on public.validations(user_id);
create index idx_validations_status on public.validations(status);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.validations
  for each row execute function update_updated_at();

-- ============================================
-- TABLA: ai_interactions
-- ============================================
create table public.ai_interactions (
  id uuid primary key default uuid_generate_v4(),
  validation_id uuid references public.validations(id) on delete cascade,
  step int not null,
  prompt_type text not null,
  input_data jsonb not null,
  output_data jsonb not null,
  tokens_used int,
  model text default 'claude-sonnet-4-20250514',
  created_at timestamptz default now()
);

alter table public.ai_interactions enable row level security;

create policy "Users can view own AI interactions"
  on public.ai_interactions for select
  using (
    exists (
      select 1 from public.validations v
      where v.id = validation_id and v.user_id = auth.uid()
    )
  );
