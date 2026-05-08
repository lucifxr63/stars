-- Table to store periodic external API fetches (CMF, SII) to act as a Knowledge Base and save tokens
create table if not exists public.economic_knowledge (
    id uuid default gen_random_uuid() primary key,
    provider text not null, -- e.g., 'CMF', 'SII'
    indicator text not null, -- e.g., 'Dolar', 'UF Mensual'
    data_json jsonb not null, -- raw JSON from the API
    context_text text, -- optional structured text to help the RAG/AI
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.economic_knowledge enable row level security;

create policy "Admins can read economic knowledge"
    on public.economic_knowledge for select
    to authenticated
    using (true); -- In a real app we'd restrict to admins, but here all authenticated can read

create policy "Admins can insert economic knowledge"
    on public.economic_knowledge for insert
    to authenticated
    with check (true);

create policy "Admins can update economic knowledge"
    on public.economic_knowledge for update
    to authenticated
    using (true);

-- Indexes for fast querying by indicator and provider
create index if not exists idx_economic_knowledge_provider_indicator
    on public.economic_knowledge (provider, indicator);
