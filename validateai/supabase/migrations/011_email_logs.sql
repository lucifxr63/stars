-- ============================================================
-- ValidateAI — Email logs table (for follow-up emails)
-- ============================================================

create table if not exists public.email_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  validation_id  uuid references public.validations(id) on delete cascade,
  email_type     text not null,  -- 'followup_7d', 'welcome', etc.
  sent_at        timestamptz not null default now(),
  metadata       jsonb default '{}'::jsonb
);

-- Index for querying by validation + type (deduplication check)
create index if not exists idx_email_logs_validation_type
  on public.email_logs(validation_id, email_type);

-- RLS: users can view their own logs; service role can insert
alter table public.email_logs enable row level security;

create policy "Users can view their own email logs"
  on public.email_logs for select
  using (auth.uid() = user_id);

-- Service role bypass (no policy needed for service role)

comment on table public.email_logs is
  'Tracks sent transactional emails to avoid duplicates and enable auditing.';
