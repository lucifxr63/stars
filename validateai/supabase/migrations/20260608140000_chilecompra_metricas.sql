-- Tabla de métricas calculadas de Mercado Público / ChileCompra.
-- Cada fila = cálculo completo de M1-M10 para un RUT en una fecha dada.
-- Actualización sugerida: semanal (datos de ChileCompra tienen lag 24-48h).

create table if not exists public.chilecompra_metricas (
  id              uuid default gen_random_uuid() primary key,
  rut             text not null,
  calculado_al    date not null,

  -- M1/M2: Ingresos y tendencia
  ingreso_fiscal_12m          bigint,          -- CLP — OC activas últimos 12m
  ingreso_fiscal_12m_anterior bigint,          -- CLP — OC activas meses 13-24
  tendencia_pct               numeric(7,2),    -- % variación interanual (null si sin histórico)

  -- M3: Deuda del Estado
  deuda_estado_pendiente_clp  bigint,          -- OC sin pagar >60 días
  oc_pendientes_count         int,

  -- M4: Trato directo
  trato_directo_pct           numeric(6,2),    -- % por conteo
  trato_directo_monto_pct     numeric(6,2),    -- % por monto

  -- M5: Concentración por organismo
  top_organismo_nombre        text,
  top_organismo_pct           numeric(6,2),
  organismos_count            int,

  -- M6: Tamaño de contratos
  max_contrato_clp            bigint,          -- histórico completo
  max_contrato_12m_clp        bigint,          -- últimos 12 meses
  ticket_promedio_clp         bigint,

  -- M7: Diversificación sectorial
  sectores_count              int,
  distribucion_sectorial      jsonb,           -- { "Salud": 5000000, "Municipal": 2000000 }

  -- M8: Win rate licitaciones competitivas
  win_rate_pct                numeric(6,2),    -- null si 0 licitaciones participadas
  licit_participadas          int,
  licit_ganadas               int,

  -- M9: Competidores frecuentes
  competidores_frecuentes     jsonb,           -- [{ rut, coincidencias }]

  -- M10: Oportunidades abiertas (calculado on-demand, puede ser null)
  oportunidades_abiertas      int,

  -- Métrica maestra: requiere cruzar con SII
  dependencia_fiscal_pct      numeric(6,2),    -- null hasta integración SII

  -- Metadatos del cálculo
  oc_procesadas               int,             -- cantidad de OC usadas
  fetched_at                  timestamptz default now()
);

create unique index if not exists chilecompra_metricas_rut_fecha_idx
  on public.chilecompra_metricas(rut, calculado_al);

create index if not exists chilecompra_metricas_rut_idx
  on public.chilecompra_metricas(rut, calculado_al desc);

-- RLS: solo service role puede escribir; lectura abierta para funciones internas
alter table public.chilecompra_metricas enable row level security;

create policy "service_role_all" on public.chilecompra_metricas
  for all using (auth.role() = 'service_role');

create policy "authenticated_select" on public.chilecompra_metricas
  for select using (auth.role() = 'authenticated');
