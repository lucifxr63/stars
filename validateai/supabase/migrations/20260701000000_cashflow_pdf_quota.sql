-- ============================================================
-- Cashflow — Contención del Beta: cuota mensual de lecturas de PDF (nuevo.md)
-- ============================================================
-- Máx 10 PDFs/usuario/mes en fase Beta, para proteger el costo de tokens.
-- La función parse-pdf llama a la RPC ANTES de invocar al LLM; si excede,
-- responde 429 sin gastar tokens.

create table cashflow.pdf_usage (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  period     text not null,                      -- 'YYYY-MM'
  count      int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, period)
);

alter table cashflow.pdf_usage enable row level security;

-- El usuario puede LEER su propia cuota (para mostrar X/10 en la UI).
create policy "cf_pdf_usage_select_own" on cashflow.pdf_usage for select
  using (owner_id = (select auth.uid()));

grant select on cashflow.pdf_usage to authenticated;
-- Sin grants de insert/update: las escrituras pasan solo por la RPC SECURITY DEFINER.

-- RPC atómica: verifica e incrementa la cuota del mes en curso.
-- Devuelve { allowed, used, limit }. SECURITY DEFINER → bypassa RLS para escribir,
-- pero el dueño se deriva de auth.uid() (no se puede falsear).
create or replace function cashflow.check_and_increment_pdf_usage(p_limit int default 10)
returns jsonb
language plpgsql
security definer
set search_path = cashflow, public
as $$
declare
  v_uid    uuid := auth.uid();
  v_period text := to_char(now(), 'YYYY-MM');
  v_count  int;
begin
  if v_uid is null then
    raise exception 'no auth';
  end if;

  insert into cashflow.pdf_usage (owner_id, period, count)
  values (v_uid, v_period, 0)
  on conflict (owner_id, period) do nothing;

  select count into v_count
  from cashflow.pdf_usage
  where owner_id = v_uid and period = v_period
  for update;

  if v_count >= p_limit then
    return jsonb_build_object('allowed', false, 'used', v_count, 'limit', p_limit);
  end if;

  update cashflow.pdf_usage
  set count = count + 1, updated_at = now()
  where owner_id = v_uid and period = v_period;

  return jsonb_build_object('allowed', true, 'used', v_count + 1, 'limit', p_limit);
end $$;

grant execute on function cashflow.check_and_increment_pdf_usage(int) to authenticated;
