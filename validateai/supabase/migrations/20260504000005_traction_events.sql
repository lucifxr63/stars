-- Traction events: hitos de tracción real registrados manualmente por el founder
create table if not exists public.traction_events (
  id          uuid primary key default gen_random_uuid(),
  validation_id uuid not null references public.validations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null check (
    event_type in ('pre_order', 'loi', 'active_user', 'interview', 'revenue', 'other')
  ),
  value       numeric,            -- cantidad: $, #usuarios, etc.
  value_unit  text,               -- 'CLP', 'USD', 'users', etc.
  event_date  date not null default current_date,
  title       text not null,      -- "5 pre-orders confirmados"
  notes       text,               -- contexto adicional
  created_at  timestamptz not null default now()
);

-- RLS
alter table public.traction_events enable row level security;

create policy "Users can manage their own traction events"
  on public.traction_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index para queries por validación
create index if not exists traction_events_validation_id_idx
  on public.traction_events(validation_id, event_date desc);
