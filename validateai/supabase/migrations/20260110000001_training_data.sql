-- ============================================================
-- ValidateAI — Fase 4.3: Dataset de entrenamiento + consentimiento
-- ============================================================

-- Columna de consentimiento en profiles
alter table public.profiles
  add column if not exists training_consent boolean default false,
  add column if not exists training_consent_at timestamptz;

-- Tabla de datos de entrenamiento (anonimizados)
create table if not exists public.training_data (
  id           uuid primary key default gen_random_uuid(),
  industry     text,
  geography    text,
  idea_summary text,   -- anonimizado por Haiku
  scores       jsonb,  -- { score, breakdown, risk_score }
  outcome      text    check (outcome in ('launched', 'pivoted', 'abandoned', 'unknown')),
  created_at   timestamptz default now()
);

-- RLS: solo service_role puede insertar/modificar; lectura pública para estadísticas
alter table public.training_data enable row level security;

create policy "Public read training_data"
  on public.training_data for select
  using (true);

-- No se crea policy de insert/update: solo service_role (edge function) puede escribir

-- Función pública de estadísticas por industria (para el dashboard de admin)
create or replace function get_industry_stats()
returns table (
  industry      text,
  avg_score     numeric,
  total_ideas   bigint,
  launched_pct  numeric
)
language sql stable
as $$
  select
    industry,
    round(avg((scores->>'score')::numeric), 1)   as avg_score,
    count(*)                                      as total_ideas,
    round(
      100.0 * count(*) filter (where outcome = 'launched') / nullif(count(*), 0),
      1
    )                                             as launched_pct
  from public.training_data
  where industry is not null
  group by industry
  order by total_ideas desc;
$$;
