-- ============================================================================
-- Cashflow — Discriminador de modelo + Backend de lectura (read-side RPCs)
-- Versión: 20260624120000
-- ============================================================================
-- ALCANCE (aprobado por la Mesa, Reverse Friction Check 2026-06-24):
--   El esquema `cashflow` y sus tablas transaccionales YA ESTÁN EN PRODUCCIÓN.
--   Esta migración es ESTRICTAMENTE ADITIVA. No redefine ni altera datos de las
--   tablas base. Solo:
--     1. Agrega `tenant.business_model` (discriminador del Workspace Switcher).
--     2. Agrega `tenant.ppm_rate` (tasa PPM para la provisión de Caja Restringida).
--     3. Crea índices parciales que acotan las ventanas de período.
--     4. Crea las RPCs de lectura `metrics_pyme` / `metrics_saas` que devuelven
--        el JSON con la forma exacta que espera `useDashboardMetricsPayload`.
--
-- PROTOCOLO DE DESPLIEGUE (tracking de migraciones roto — ver memoria del equipo
-- y ARCHITECTURE.md §1):
--   • NUNCA `supabase db push`.
--   • Aplicar este archivo COMPLETO en una sola transacción vía SQL Editor o el
--     Management API query endpoint del proyecto fcdhcntyvsydnvjwopfe.
--   • La fila de versión en `supabase_migrations.schema_migrations` se inserta al
--     final de esta misma transacción.
--
-- MODELO DE CAJA RESTRINGIDA (decisiones de diseño aprobadas):
--   • IVA estricto: débito (ventas afectas del período) − crédito (expense.vat_amount).
--   • PPM configurable por tenant (tenant.ppm_rate, default 0 = sin PPM).
--   • PERFORMANCE: la provisión depende SOLO del período fiscal abierto (el IVA se
--     liquida mensualmente vía F29), no del histórico de por vida. Cada agregación
--     se acota con `>= v_start AND < v_end` → index-range, nunca seq-scan total.
--     Escala futura: snapshotear períodos cerrados (inmutables) vía pg_cron y
--     live-computar solo el mes abierto (engancha con la deuda de ARCHITECTURE.md §4).
-- ============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DDL aditivo sobre `cashflow.tenant`
-- ─────────────────────────────────────────────────────────────────────────────

-- Discriminador de modelo de negocio. Default seguro: los tenants vivos quedan
-- como 'pyme-tradicional' sin intervención (no rompe comportamiento existente).
alter table cashflow.tenant
  add column if not exists business_model text not null default 'pyme-tradicional';

-- Tasa PPM (Pago Provisional Mensual) en porcentaje 0–100. Default 0 = sin PPM
-- hasta que el tenant la configure; no altera la provisión de tenants actuales.
alter table cashflow.tenant
  add column if not exists ppm_rate numeric not null default 0;

-- CHECK constraints idempotentes (Postgres no soporta ADD CONSTRAINT IF NOT EXISTS).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_business_model_chk') then
    alter table cashflow.tenant
      add constraint tenant_business_model_chk
      check (business_model in ('pyme-tradicional', 'startup-saas'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tenant_ppm_rate_chk') then
    alter table cashflow.tenant
      add constraint tenant_ppm_rate_chk
      check (ppm_rate >= 0 and ppm_rate <= 100);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Índices de soporte (alinean la RLS plana con la ventana del período)
-- ─────────────────────────────────────────────────────────────────────────────
-- Todos prefijan owner_id porque la RLS plana filtra por owner_id = auth.uid().
-- Así cada agregación de período es un index-range scan + aggregate.
create index if not exists idx_invoice_owner_issue   on cashflow.invoice  (owner_id, issue_date);
create index if not exists idx_invoice_owner_pending  on cashflow.invoice  (owner_id, due_date) where status = 'PENDING';
create index if not exists idx_expense_owner_date     on cashflow.expense  (owner_id, record_date);
create index if not exists idx_revenue_owner_date     on cashflow.revenue  (owner_id, record_date);
create index if not exists idx_transaction_owner_date on cashflow.transaction (owner_id, transaction_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper de formato (espejo de src/lib/utils.ts → formatCLPShort)
-- ─────────────────────────────────────────────────────────────────────────────
-- Genera el `display` exacto ("$4,8M", "$120K", "$0") que ya consumen los widgets.
create or replace function cashflow.fmt_clp_short(amount numeric)
returns text
language sql
immutable
as $$
  select case
    when abs(coalesce(amount, 0)) >= 1000000 then
      (case when amount < 0 then '-' else '' end) || '$' ||
      replace(to_char(abs(amount) / 1000000.0, 'FM999990.0'), '.', ',') || 'M'
    when abs(coalesce(amount, 0)) >= 1000 then
      (case when amount < 0 then '-' else '' end) || '$' ||
      to_char(round(abs(amount) / 1000.0), 'FM999990') || 'K'
    else
      (case when amount < 0 then '-' else '' end) || '$' || to_char(abs(coalesce(amount, 0)), 'FM999990')
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC — modelo PyME Tradicional
-- ─────────────────────────────────────────────────────────────────────────────
-- Firma:  cashflow.metrics_pyme(p_tenant_id uuid, p_period text 'YYYY-MM') → jsonb
-- Devuelve un MetricsPayload: { widgetId: { value?, display, tone?, note?, trend? } }.
-- SECURITY INVOKER: corre con el JWT del llamante → la RLS plana acota los datos.
create or replace function cashflow.metrics_pyme(
  p_tenant_id uuid,
  p_period    text default to_char(now(), 'YYYY-MM')
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = cashflow, public
as $$
declare
  v_uid    uuid    := auth.uid();
  v_start  date    := to_date(p_period || '-01', 'YYYY-MM-DD');     -- inicio período (incl.)
  v_end    date    := (to_date(p_period || '-01', 'YYYY-MM-DD') + interval '1 month')::date; -- fin (excl.)
  v_rate   numeric;        -- IVA (fracción)
  v_ppm    numeric;        -- PPM (fracción)
  v_cash       numeric := 0;
  v_ventas     numeric := 0;   -- ventas afectas del período (bruto, AR)
  v_iva_deb    numeric := 0;
  v_iva_cred   numeric := 0;
  v_iva_neto   numeric := 0;
  v_restricted numeric := 0;
  v_ar_pend    numeric := 0;
  v_ap_pend    numeric := 0;
  v_overdue    int     := 0;
  v_wc         numeric := 0;
  v_trend      jsonb;
begin
  -- Tasa del tenant (acotada por RLS: solo el dueño ve su fila).
  select default_tax_rate / 100.0, ppm_rate / 100.0
    into v_rate, v_ppm
  from cashflow.tenant
  where id = p_tenant_id and owner_id = v_uid;

  if v_rate is null then
    return '{}'::jsonb;  -- tenant inexistente o ajeno → payload vacío
  end if;

  -- Caja actual: saldo mantenido por trigger (O(#cuentas), trivial).
  select coalesce(sum(current_balance), 0) into v_cash
  from cashflow.bank_account
  where owner_id = v_uid and tenant_id = p_tenant_id;

  -- Ventas afectas del período abierto → débito fiscal contenido en el bruto.
  select coalesce(sum(total_amount), 0) into v_ventas
  from cashflow.invoice
  where owner_id = v_uid and tenant_id = p_tenant_id
    and type = 'AR'
    and issue_date >= v_start and issue_date < v_end;

  v_iva_deb := v_ventas * (v_rate / (1 + v_rate));

  -- Crédito fiscal: IVA real de gastos afectos del período (columna explícita).
  select coalesce(sum(vat_amount), 0) into v_iva_cred
  from cashflow.expense
  where owner_id = v_uid and tenant_id = p_tenant_id
    and vat_status = 'AFECTO'
    and record_date >= v_start and record_date < v_end;

  v_iva_neto   := greatest(0, v_iva_deb - v_iva_cred);
  v_restricted := round(v_iva_neto + v_ventas * v_ppm);   -- IVA neto + PPM

  -- Cuentas por cobrar/pagar pendientes (índice parcial status='PENDING').
  select
    coalesce(sum(total_amount) filter (where type = 'AR'), 0),
    coalesce(sum(total_amount) filter (where type = 'AP'), 0),
    coalesce(count(*) filter (where type = 'AR' and due_date < current_date), 0)
  into v_ar_pend, v_ap_pend, v_overdue
  from cashflow.invoice
  where owner_id = v_uid and tenant_id = p_tenant_id
    and status = 'PENDING';

  v_wc := v_cash + v_ar_pend - v_ap_pend;   -- aprox. capital de trabajo

  -- Tendencia: neto mensual (IN−OUT) de los últimos 6 meses, acotado por ventana.
  select coalesce(jsonb_agg(net order by m), '[]'::jsonb) into v_trend
  from (
    select gs::date as m,
      coalesce((
        select sum(case when t.type = 'IN' then t.amount else -t.amount end)
        from cashflow.transaction t
        where t.owner_id = v_uid
          and t.account_id in (select id from cashflow.bank_account where owner_id = v_uid and tenant_id = p_tenant_id)
          and t.transaction_date >= gs
          and t.transaction_date <  gs + interval '1 month'
      ), 0) as net
    from generate_series(v_start - interval '5 months', v_start, interval '1 month') gs
  ) s;

  return jsonb_build_object(
    'currentCashWidget', jsonb_build_object(
      'value', v_cash, 'display', cashflow.fmt_clp_short(v_cash),
      'tone', case when v_cash >= 0 then 'positive' else 'negative' end,
      'note', 'Disponible en cuentas'),
    'restrictedCashWidget', jsonb_build_object(
      'value', v_restricted, 'display', cashflow.fmt_clp_short(v_restricted),
      'tone', 'warning',
      'note', round(v_rate * 100) || '% IVA' || case when v_ppm > 0 then ' + ' || round(v_ppm * 100, 2) || '% PPM' else '' end || ' del período'),
    'workingCapitalWidget', jsonb_build_object(
      'value', v_wc, 'display', cashflow.fmt_clp_short(v_wc),
      'tone', case when v_wc >= 0 then 'neutral' else 'negative' end,
      'note', 'Caja + CxC − CxP'),
    'liquidityProjectionWidget', jsonb_build_object(
      'display', cashflow.fmt_clp_short(v_cash),
      'tone', 'neutral', 'note', 'Neto mensual · últimos 6 meses', 'trend', v_trend),
    'receivablesWidget', jsonb_build_object(
      'value', v_ar_pend, 'display', cashflow.fmt_clp_short(v_ar_pend),
      'tone', case when v_overdue > 0 then 'warning' else 'neutral' end,
      'note', v_overdue || ' factura(s) vencida(s)')
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC — modelo Startup SaaS
-- ─────────────────────────────────────────────────────────────────────────────
-- Firma:  cashflow.metrics_saas(p_tenant_id uuid, p_period text 'YYYY-MM') → jsonb
-- Burn / runway / MRR desde revenue.net_income_clp y expense.total_amount.
create or replace function cashflow.metrics_saas(
  p_tenant_id uuid,
  p_period    text default to_char(now(), 'YYYY-MM')
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = cashflow, public
as $$
declare
  v_uid       uuid := auth.uid();
  v_start     date := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_end       date := (to_date(p_period || '-01', 'YYYY-MM-DD') + interval '1 month')::date;
  v_prev      date := (to_date(p_period || '-01', 'YYYY-MM-DD') - interval '1 month')::date;
  v_cash      numeric := 0;
  v_rev       numeric := 0;   -- MRR del período
  v_rev_prev  numeric := 0;
  v_exp       numeric := 0;
  v_burn      numeric := 0;
  v_burn_prev numeric := 0;
  v_runway    numeric;        -- meses; null = ∞
  v_trend     jsonb;
  v_owner_ok  boolean;
begin
  select true into v_owner_ok
  from cashflow.tenant where id = p_tenant_id and owner_id = v_uid;
  if v_owner_ok is null then
    return '{}'::jsonb;
  end if;

  select coalesce(sum(current_balance), 0) into v_cash
  from cashflow.bank_account
  where owner_id = v_uid and tenant_id = p_tenant_id;

  -- Ingreso recurrente neto (KPI de caja SaaS) — período actual y previo.
  select
    coalesce(sum(net_income_clp) filter (where record_date >= v_start and record_date < v_end), 0),
    coalesce(sum(net_income_clp) filter (where record_date >= v_prev  and record_date < v_start), 0)
  into v_rev, v_rev_prev
  from cashflow.revenue
  where owner_id = v_uid and tenant_id = p_tenant_id
    and record_date >= v_prev and record_date < v_end;

  -- Gasto del período (base de quema).
  select coalesce(sum(total_amount), 0) into v_exp
  from cashflow.expense
  where owner_id = v_uid and tenant_id = p_tenant_id
    and record_date >= v_start and record_date < v_end;

  v_burn      := greatest(0, v_exp - v_rev);
  v_burn_prev := greatest(0, (
    select coalesce(sum(total_amount), 0) from cashflow.expense
    where owner_id = v_uid and tenant_id = p_tenant_id
      and record_date >= v_prev and record_date < v_start
  ) - v_rev_prev);
  v_runway := case when v_burn > 0 then round(v_cash / v_burn, 1) else null end;

  -- Tendencia de quema: gasto mensual de los últimos 6 meses.
  select coalesce(jsonb_agg(exp order by m), '[]'::jsonb) into v_trend
  from (
    select gs::date as m,
      coalesce((
        select sum(e.total_amount) from cashflow.expense e
        where e.owner_id = v_uid and e.tenant_id = p_tenant_id
          and e.record_date >= gs and e.record_date < gs + interval '1 month'
      ), 0) as exp
    from generate_series(v_start - interval '5 months', v_start, interval '1 month') gs
  ) s;

  return jsonb_build_object(
    'burnRateWidget', jsonb_build_object(
      'value', v_burn, 'display', cashflow.fmt_clp_short(v_burn) || '/mes',
      'delta', case when v_burn_prev > 0 then round((v_burn - v_burn_prev) / v_burn_prev, 4) else null end,
      'tone', case when v_burn > 0 then 'negative' else 'positive' end,
      'note', 'Quema neta mensual'),
    'runwayWidget', jsonb_build_object(
      'value', v_runway,
      'display', case when v_runway is null then '∞' when v_runway > 24 then '> 24 meses' else replace(v_runway::text, '.', ',') || ' meses' end,
      'tone', case when v_runway is not null and v_runway < 6 then 'warning' else 'neutral' end,
      'note', 'A burn rate actual'),
    'mrrWidget', jsonb_build_object(
      'value', v_rev, 'display', cashflow.fmt_clp_short(v_rev),
      'delta', case when v_rev_prev > 0 then round((v_rev - v_rev_prev) / v_rev_prev, 4) else null end,
      'tone', 'positive', 'note', 'Ingreso recurrente mensual'),
    'burnTrendWidget', jsonb_build_object(
      'display', cashflow.fmt_clp_short(v_burn),
      'tone', 'negative', 'note', 'Quema · últimos 6 meses', 'trend', v_trend),
    'cashBalanceWidget', jsonb_build_object(
      'value', v_cash, 'display', cashflow.fmt_clp_short(v_cash),
      'tone', 'neutral', 'note', 'Caja en banco')
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Permisos de ejecución
-- ─────────────────────────────────────────────────────────────────────────────
grant execute on function cashflow.metrics_pyme(uuid, text) to authenticated;
grant execute on function cashflow.metrics_saas(uuid, text) to authenticated;
grant execute on function cashflow.fmt_clp_short(numeric)   to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Registro de versión (tracking manual — ver protocolo en el encabezado)
-- ─────────────────────────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name)
values ('20260624120000', 'cashflow_business_model_and_read_rpcs')
on conflict (version) do nothing;

commit;
