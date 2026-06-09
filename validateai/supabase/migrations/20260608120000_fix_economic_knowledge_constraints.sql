-- Agrega constraint único en (provider, indicator) para que el upsert
-- onConflict funcione correctamente en cron-uf-daily, fred-sync y chilecompra-fetch.
-- También agrega created_at que faltaba en la migración original.

alter table public.economic_knowledge
  add column if not exists created_at timestamp with time zone
    default timezone('utc'::text, now()) not null;

-- Constraint único requerido para upsert con onConflict: 'provider,indicator'
alter table public.economic_knowledge
  drop constraint if exists economic_knowledge_provider_indicator_key;

alter table public.economic_knowledge
  add constraint economic_knowledge_provider_indicator_key
  unique (provider, indicator);
