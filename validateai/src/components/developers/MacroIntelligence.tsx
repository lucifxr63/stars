import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Database, RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink,
} from 'lucide-react';
import CorrelationChart from '@/components/developers/CorrelationChart';

type Observation = { date: string; value: number | null };

type MacroMetadata = {
  series_id: string;
  fuente: string;
  url_fuente: string;
  unidad: string;
  frecuencia: string;
  ultima_fecha: string | null;
  ultimo_valor: number | null;
  observaciones: Observation[];
};

type KnowledgeNode = {
  document_title: string;
  metadata: MacroMetadata;
};

type SeriesConfig = {
  seriesId: string;
  title: string;
  color: string;
  gradientId: string;
  unit: string;
  shortLabel: string;
  periodsBack: number;
};

const SERIES: SeriesConfig[] = [
  {
    seriesId:    'GDP',
    title:       'PIB USA (GDP)',
    color:       '#0EB5C6',
    gradientId:  'gradGDP_vi',
    unit:        'B USD',
    shortLabel:  'PIB USA',
    periodsBack: 4,
  },
  {
    seriesId:    'CPIAUCSL',
    title:       'Inflación USA (CPI All Urban Consumers)',
    color:       '#F59E0B',
    gradientId:  'gradCPI_vi',
    unit:        'índice',
    shortLabel:  'CPI',
    periodsBack: 12,
  },
  {
    seriesId:    'FEDFUNDS',
    title:       'Tasa de Fondos Federales (Fed Funds Rate)',
    color:       '#8B5CF6',
    gradientId:  'gradFed_vi',
    unit:        '%',
    shortLabel:  'Fed Funds',
    periodsBack: 12,
  },
];

// Phase 3A — OpenBB / FRED extendido
const PHASE3A_SERIES: SeriesConfig[] = [
  {
    seriesId:    'UNRATE',
    title:       'Desempleo USA (Unemployment Rate)',
    color:       '#FB923C',
    gradientId:  'gradUNRATE',
    unit:        '%',
    shortLabel:  'Desempleo USA',
    periodsBack: 12,
  },
  {
    seriesId:    'M2SL',
    title:       'M2 Money Supply USA',
    color:       '#38BDF8',
    gradientId:  'gradM2SL',
    unit:        'mil M USD',
    shortLabel:  'M2 Supply',
    periodsBack: 12,
  },
  {
    seriesId:    'T10Y2Y',
    title:       'Spread Curva 10Y-2Y USA (Indicador Recesion)',
    color:       '#F87171',
    gradientId:  'gradT10Y2Y',
    unit:        '%',
    shortLabel:  'Yield Spread',
    periodsBack: 12,
  },
  {
    seriesId:    'BAMLH0A0HYM2',
    title:       'High Yield Credit Spread (Apetito Riesgo Credito)',
    color:       '#E879F9',
    gradientId:  'gradHY',
    unit:        '%',
    shortLabel:  'HY Spread',
    periodsBack: 12,
  },
  {
    seriesId:    'INDPRO',
    title:       'Produccion Industrial USA (Industrial Production Index)',
    color:       '#34D399',
    gradientId:  'gradINDPRO',
    unit:        'idx',
    shortLabel:  'Prod. Industrial',
    periodsBack: 12,
  },
  {
    seriesId:    'DEXCHUS',
    title:       'USD/CNY (Tipo de Cambio Yuan)',
    color:       '#A78BFA',
    gradientId:  'gradCNY',
    unit:        'CNY/USD',
    shortLabel:  'USD/CNY',
    periodsBack: 12,
  },
];

// Phase 3B — EconDB / Chile Macro
const PHASE3B_SERIES: SeriesConfig[] = [
  {
    seriesId:    'URATE_CL',
    title:       'Desempleo Chile (% fuerza laboral)',
    color:       '#FCD34D',
    gradientId:  'gradURATECL',
    unit:        '%',
    shortLabel:  'Desempleo Chile',
    periodsBack: 12,
  },
  {
    seriesId:    'NIIP_CL',
    title:       'Posicion de Inversion Internacional Chile (NIIP)',
    color:       '#6EE7B7',
    gradientId:  'gradNIIP',
    unit:        'M USD',
    shortLabel:  'NIIP Chile',
    periodsBack: 4,
  },
  {
    seriesId:    'CPI_CL',
    title:       'Inflacion Chile (CPI Indice Precios Consumidor)',
    color:       '#FDA4AF',
    gradientId:  'gradCPICL',
    unit:        'índice',
    shortLabel:  'IPC Chile',
    periodsBack: 12,
  },
];

const ALL_SERIES = [...SERIES, ...PHASE3A_SERIES, ...PHASE3B_SERIES];

const tooltipStyle = {
  backgroundColor: '#12121A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: '#F0EFF8',
  fontSize: '12px',
};

function syncAgo(date: Date | null): string {
  if (!date) return 'desconocido';
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'hace menos de 1 min';
  if (diffMin < 60) return `hace ${diffMin} min`;
  return `hace ${Math.floor(diffMin / 60)}h`;
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return '—';
  if (unit === 'B USD') return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (unit === '%') return value.toFixed(2);
  return value.toFixed(2);
}

function computeTrend(obs: Observation[], periodsBack: number): number | null {
  const valid = obs.filter(o => o.value !== null);
  if (valid.length < periodsBack + 1) return null;
  const latest = valid[0].value as number;
  const prev   = valid[periodsBack].value as number;
  if (prev === 0) return null;
  return ((latest - prev) / Math.abs(prev)) * 100;
}

function chartPoints(node: KnowledgeNode | undefined, limit = 24) {
  if (!node) return [];
  return [...node.metadata.observaciones]
    .filter(o => o.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map(o => ({ date: o.date.slice(0, 7), value: o.value as number }));
}

export function MacroIntelligence() {
  const [nodes,      setNodes]      = useState<Map<string, KnowledgeNode>>(new Map());
  const [loading,    setLoading]    = useState(true);
  const [lastSync,   setLastSync]   = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rutInput,   setRutInput]   = useState('');

  async function fetchData() {
    setRefreshing(true);
    const { data, error } = await supabase
      .from('knowledge_nodes')
      .select('document_title, metadata')
      .in('category', [
        'Macroeconomia',
        'Empleo USA', 'Liquidez Global', 'Riesgo Macro', 'Riesgo Credito',
        'Ciclo Industrial', 'Forex Global', 'Chile Macro',
      ]);

    if (!error && data) {
      const map = new Map<string, KnowledgeNode>();
      for (const row of data as KnowledgeNode[]) {
        const cfg = ALL_SERIES.find(s => s.title === row.document_title);
        if (cfg) map.set(cfg.seriesId, row);
      }
      setNodes(map);
      setLastSync(new Date());
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-4">

      {/* Cabecera */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center">
            <Database className="w-4 h-4 text-teal-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">
              Financial Intelligence
            </h2>
            <p className="text-[10px] text-gray-400 dark:text-[#8B8AA0]">
              AnimusPY · FRED + OpenBB Phase 3 · Federal Reserve / EconDB
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-[10px] text-gray-400 dark:text-[#8B8AA0] border border-gray-100 dark:border-white/10 rounded-full px-2.5 py-1 hidden sm:inline">
              {syncAgo(lastSync)}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={refreshing}
            aria-label="Actualizar datos macro"
            className="p-2 rounded-xl border border-gray-100 dark:border-white/10 hover:border-teal-400/60 transition text-gray-400 hover:text-teal-500 cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stat cards + mini charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SERIES.map(cfg => {
          const node  = nodes.get(cfg.seriesId);
          const meta  = node?.metadata;
          const trend = meta ? computeTrend(meta.observaciones, cfg.periodsBack) : null;
          const data  = chartPoints(node);

          return (
            <div
              key={cfg.seriesId}
              className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: cfg.color }}
                >
                  {cfg.shortLabel}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 border border-gray-100 dark:border-white/10 rounded-full px-2 py-0.5">
                    FRED
                  </span>
                  {meta?.url_fuente && (
                    <a
                      href={meta.url_fuente}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-teal-400 transition cursor-pointer"
                      aria-label={`Ver ${cfg.shortLabel} en FRED`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="h-7 w-28 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse mb-1" />
              ) : (
                <p className="text-xl font-black text-gray-900 dark:text-[#F0EFF8] tabular-nums leading-none">
                  {formatValue(meta?.ultimo_valor ?? null, cfg.unit)}
                  <span className="text-xs font-normal text-gray-400 ml-1.5">{cfg.unit}</span>
                </p>
              )}

              <p className="text-[10px] text-gray-400 dark:text-[#8B8AA0] mt-1 mb-2">
                {meta?.ultima_fecha ?? '—'} · {meta?.frecuencia ?? '—'}
              </p>

              {!loading && (
                trend !== null ? (
                  <div className={`flex items-center gap-1 text-[11px] font-semibold mb-3 ${
                    trend > 0.5 ? 'text-emerald-500' : trend < -0.5 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {trend > 0.5
                      ? <TrendingUp  className="w-3 h-3" />
                      : trend < -0.5
                      ? <TrendingDown className="w-3 h-3" />
                      : <Minus className="w-3 h-3" />
                    }
                    {Math.abs(trend).toFixed(1)}% vs año anterior
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-3">
                    <Minus className="w-3 h-3" /> sin variación calculable
                  </div>
                )
              )}

              {loading ? (
                <div className="h-28 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
              ) : data.length === 0 ? (
                <div className="h-28 flex items-center justify-center">
                  <span className="text-xs text-gray-400">Sin datos</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={110}>
                  <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={cfg.gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={cfg.color} stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: '#8B8AA0' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => (v as string).slice(2, 7)}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: '#F0EFF8' }}
                      labelStyle={{ color: '#8B8AA0', marginBottom: 4 }}
                      formatter={(v) => [
                        `${(v as number).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cfg.unit}`,
                        cfg.shortLabel,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={cfg.color}
                      strokeWidth={2}
                      fill={`url(#${cfg.gradientId})`}
                      dot={false}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase 3A — Indicadores Avanzados USA */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#8B8AA0]">
            Indicadores Avanzados USA
          </span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-white/5" />
          <span className="text-[10px] text-teal-500 border border-teal-500/30 rounded-full px-2 py-0.5 font-bold">
            OpenBB Phase 3A
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PHASE3A_SERIES.map(cfg => {
            const node  = nodes.get(cfg.seriesId);
            const meta  = node?.metadata;
            const trend = meta ? computeTrend(meta.observaciones, cfg.periodsBack) : null;
            const pts   = chartPoints(node, 18);
            return (
              <div
                key={cfg.seriesId}
                className="bg-white dark:bg-[#12121A] rounded-xl border border-gray-100 dark:border-white/5 p-3 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
                    {cfg.shortLabel}
                  </span>
                  {meta?.url_fuente && (
                    <a href={meta.url_fuente} target="_blank" rel="noopener noreferrer"
                      className="text-gray-300 hover:text-teal-400 transition" aria-label={cfg.shortLabel}>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                {loading ? (
                  <div className="h-5 w-16 bg-gray-100 dark:bg-white/5 rounded animate-pulse mb-1" />
                ) : (
                  <p className="text-sm font-black text-gray-900 dark:text-[#F0EFF8] tabular-nums leading-none">
                    {formatValue(meta?.ultimo_valor ?? null, cfg.unit)}
                    <span className="text-[9px] font-normal text-gray-400 ml-1">{cfg.unit}</span>
                  </p>
                )}
                {!loading && trend !== null && (
                  <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1 ${
                    trend > 0.5 ? 'text-emerald-500' : trend < -0.5 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {trend > 0.5 ? <TrendingUp className="w-2.5 h-2.5" /> : trend < -0.5 ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                    {Math.abs(trend).toFixed(1)}%
                  </div>
                )}
                {!loading && pts.length > 0 && (
                  <div className="mt-2">
                    <ResponsiveContainer width="100%" height={52}>
                      <AreaChart data={pts} margin={{ top: 1, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={cfg.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={cfg.color} stopOpacity={0}   />
                          </linearGradient>
                        </defs>
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          itemStyle={{ color: '#F0EFF8' }}
                          labelStyle={{ color: '#8B8AA0', marginBottom: 4 }}
                          formatter={(v) => [`${(v as number).toFixed(2)} ${cfg.unit}`, cfg.shortLabel]}
                        />
                        <Area type="monotone" dataKey="value" stroke={cfg.color} strokeWidth={1.5}
                          fill={`url(#${cfg.gradientId})`} dot={false} connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase 3B — Chile Macro */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#8B8AA0]">
            Chile Macro
          </span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-white/5" />
          <span className="text-[10px] text-amber-500 border border-amber-500/30 rounded-full px-2 py-0.5 font-bold">
            OpenBB Phase 3B · EconDB
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PHASE3B_SERIES.map(cfg => {
            const node  = nodes.get(cfg.seriesId);
            const meta  = node?.metadata;
            const trend = meta ? computeTrend(meta.observaciones, cfg.periodsBack) : null;
            const pts   = chartPoints(node, 24);
            return (
              <div
                key={cfg.seriesId}
                className="bg-white dark:bg-[#12121A] rounded-xl border border-gray-100 dark:border-white/5 p-3.5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
                    {cfg.shortLabel}
                  </span>
                  {meta?.url_fuente && (
                    <a href={meta.url_fuente} target="_blank" rel="noopener noreferrer"
                      className="text-gray-300 hover:text-teal-400 transition">
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                {loading ? (
                  <div className="h-5 w-20 bg-gray-100 dark:bg-white/5 rounded animate-pulse mb-1" />
                ) : (
                  <p className="text-base font-black text-gray-900 dark:text-[#F0EFF8] tabular-nums leading-none">
                    {formatValue(meta?.ultimo_valor ?? null, cfg.unit)}
                    <span className="text-[10px] font-normal text-gray-400 ml-1">{cfg.unit}</span>
                  </p>
                )}
                <p className="text-[10px] text-gray-400 dark:text-[#8B8AA0] mt-1 mb-2">
                  {meta?.ultima_fecha ?? '—'} · mensual
                </p>
                {!loading && trend !== null && (
                  <div className={`flex items-center gap-1 text-[10px] font-semibold mb-2 ${
                    trend > 0.5 ? 'text-emerald-500' : trend < -0.5 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {trend > 0.5 ? <TrendingUp className="w-3 h-3" /> : trend < -0.5 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {Math.abs(trend).toFixed(1)}% vs año anterior
                  </div>
                )}
                {!loading && pts.length > 0 && (
                  <ResponsiveContainer width="100%" height={70}>
                    <AreaChart data={pts} margin={{ top: 1, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={cfg.gradientId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.28} />
                          <stop offset="95%" stopColor={cfg.color} stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#8B8AA0' }} axisLine={false}
                        tickLine={false} tickFormatter={v => (v as string).slice(2, 7)} interval="preserveStartEnd" />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: '#F0EFF8' }}
                        labelStyle={{ color: '#8B8AA0', marginBottom: 4 }}
                        formatter={(v) => [`${(v as number).toFixed(2)} ${cfg.unit}`, cfg.shortLabel]}
                      />
                      <Area type="monotone" dataKey="value" stroke={cfg.color} strokeWidth={1.5}
                        fill={`url(#${cfg.gradientId})`} dot={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Correlación Macro <-> PYME */}
      <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">
            Correlación Macro ↔ PYME
          </h3>
          <p className="text-[11px] text-gray-400 dark:text-[#8B8AA0] mt-0.5">
            H1 · Sensibilidad al costo del dinero &nbsp;·&nbsp;
            H2 · Traslado de precios &nbsp;·&nbsp;
            H3 · Elasticidad de demanda
          </p>
        </div>

        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
            RUT empresa
          </label>
          <input
            type="text"
            value={rutInput}
            onChange={e => setRutInput(e.target.value.trim())}
            placeholder="76543210-K"
            className="w-full max-w-xs bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-gray-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition"
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Sin RUT muestra solo la línea macro como referencia de mercado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CorrelationChart
            hypothesis="H1"
            macroTitle="Tasa de Fondos Federales (Fed Funds Rate)"
            macroLabel="Fed Funds Rate"
            macroUnit="%"
            pymeMetric="net_cash_flow_clp"
            pymeLabel="Flujo de Caja"
            pymeUnit="CLP"
            companyRut={rutInput}
          />
          <CorrelationChart
            hypothesis="H2"
            macroTitle="Inflación USA (CPI All Urban Consumers)"
            macroLabel="CPI"
            macroUnit="índice"
            pymeMetric="avg_ticket_clp"
            pymeLabel="Ticket Promedio"
            pymeUnit="CLP"
            companyRut={rutInput}
          />
          <CorrelationChart
            hypothesis="H3"
            macroTitle="PIB USA (GDP)"
            macroLabel="GDP"
            macroUnit="bill. USD"
            pymeMetric="monthly_volume_clp"
            pymeLabel="Volumen Mensual"
            pymeUnit="CLP"
            companyRut={rutInput}
          />
        </div>
      </div>

    </div>
  );
}
