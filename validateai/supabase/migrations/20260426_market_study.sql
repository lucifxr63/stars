-- ──────────────────────────────────────────────────────────────
-- TABLA 1: Caché de clasificaciones INE
-- ──────────────────────────────────────────────────────────────
create table if not exists market_ine_classifications (
  id            uuid primary key default gen_random_uuid(),
  input_text    text not null,
  caenes_code   text not null,
  caenes_prob   numeric,
  ciuo_code     text,
  ciuo_prob     numeric,
  classified_at timestamptz default now()
);

create index if not exists idx_ine_class_input
  on market_ine_classifications(input_text);

-- ──────────────────────────────────────────────────────────────
-- TABLA 2: Caché de series BCCh
-- ──────────────────────────────────────────────────────────────
create table if not exists market_bde_data (
  id          uuid primary key default gen_random_uuid(),
  series_id   text not null,
  series_desc text,
  obs_date    date not null,
  value       numeric,
  fetched_at  timestamptz default now(),
  unique(series_id, obs_date)
);

create index if not exists idx_bde_series_date
  on market_bde_data(series_id, obs_date desc);

-- ──────────────────────────────────────────────────────────────
-- TABLA 3: Insights de mercado por validación
-- ──────────────────────────────────────────────────────────────
create table if not exists market_ai_insights (
  id            uuid primary key default gen_random_uuid(),
  validation_id uuid references public.validations(id) on delete cascade,
  caenes_code   text,
  zone          text default 'CL',
  insights_json jsonb,
  raw_series    jsonb,
  generated_at  timestamptz default now(),
  unique(validation_id)
);

create index if not exists idx_market_insights_validation
  on market_ai_insights(validation_id);

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────
alter table market_ine_classifications enable row level security;
alter table market_bde_data enable row level security;
alter table market_ai_insights enable row level security;

-- Datos macro: lectura pública (son datos del BCCh, no privados)
create policy "public read bde"
  on market_bde_data for select using (true);

create policy "public read ine"
  on market_ine_classifications for select using (true);

-- Insights: solo el dueño de la validación puede leer
create policy "owner read insights"
  on market_ai_insights for select
  using (
    validation_id in (
      select id from validations where user_id = auth.uid()
    )
  );
