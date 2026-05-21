-- ============================================================
-- S3: Tabla de logs de auditoría del motor RAG
-- ============================================================

create table if not exists public.rag_audit_logs (
  id               uuid        primary key default gen_random_uuid(),
  run_id           uuid        not null,               -- agrupa los logs de una ejecución
  query            text        not null,
  category         text        not null,               -- 'legal' | 'gtm' | 'methodology' | 'market' | 'edge'
  expected_keyword text,                               -- palabra clave esperada en la respuesta
  answer           text,
  sources_count    int         not null default 0,
  has_sources      boolean     not null default false,
  keyword_found    boolean     not null default false,
  precision_score  float       not null default 0,     -- 0.0 - 1.0
  latency_ms       float       not null,
  chunks_retrieved int         not null default 0,
  model_used       text,
  error            text,
  created_at       timestamptz not null default now()
);

create index rag_audit_logs_run_id_idx    on public.rag_audit_logs (run_id);
create index rag_audit_logs_created_at_idx on public.rag_audit_logs (created_at desc);
create index rag_audit_logs_category_idx  on public.rag_audit_logs (category);

alter table public.rag_audit_logs enable row level security;
create policy "service_full_rag_audit_logs"
  on public.rag_audit_logs for all using (true) with check (true);

-- Vista de resumen por run
create or replace view public.rag_audit_summary as
select
  run_id,
  min(created_at)                                          as started_at,
  count(*)                                                 as total_queries,
  round(avg(precision_score)::numeric, 3)                 as avg_precision,
  round(avg(latency_ms)::numeric, 0)                      as avg_latency_ms,
  sum(case when keyword_found then 1 else 0 end)           as keyword_hits,
  sum(case when has_sources   then 1 else 0 end)           as queries_with_sources,
  sum(case when error is not null then 1 else 0 end)       as errors,
  round((sum(case when keyword_found then 1 else 0 end)::float / count(*) * 100)::numeric, 1) as hit_rate_pct
from public.rag_audit_logs
group by run_id
order by started_at desc;
