import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useMarketAnalysis } from '@/hooks/useMarketAnalysis'
import type { RawSeriesPoint } from '@/types/market'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ArrowLeft, RefreshCw, ShieldAlert, Info, Map } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { MarketSizing } from '@/types/validation'

const ChileMarketMap = lazy(() =>
  import('@/components/market/ChileMarketMap').then(m => ({ default: m.ChileMarketMap }))
)

const TREND_CONFIG = {
  creciente:   { icon: TrendingUp,   color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' },
  estable:     { icon: Minus,        color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' },
  decreciente: { icon: TrendingDown, color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20' },
}

const PLAYER_TYPE_CONFIG: Record<string, string> = {
  incumbente:    'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10',
  startup:       'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  internacional: 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20',
}

function formatClp(millions: number): string {
  if (millions >= 1_000_000) return `${(millions / 1_000_000).toFixed(1)} B CLP`
  if (millions >= 1_000)     return `${(millions / 1_000).toFixed(1)} MM CLP`
  return `${millions.toFixed(0)} M CLP`
}

function SectionCard({ title, children, className = '', icon }: {
  title?: string; children: React.ReactNode; className?: string; icon?: React.ReactNode
}) {
  return (
    <div className={`bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-4 border-b border-gray-50 dark:border-white/5 flex items-center gap-2">
          {icon && <span className="text-gray-400">{icon}</span>}
          <h3 className="text-sm font-bold text-gray-700 dark:text-[#C4C4D4]">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const isHigh = confidence >= 70
  const isMid  = confidence >= 40
  const color  = isHigh ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
               : isMid  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
               :           'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
  const label  = isHigh ? 'Alta' : isMid ? 'Parcial' : 'Baja'

  return (
    <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold ${color}`}>
      <Info className="h-3 w-3 flex-shrink-0" />
      Confianza {label} ({confidence}% datos reales BCCh)
    </div>
  )
}

function SeriesChart({ series }: { series: RawSeriesPoint[] }) {
  const withData = series.filter(s => s.obs && s.obs.length > 0)
  if (withData.length === 0) return null

  const sectorSerie = withData[0]
  const pibTotal = withData.find(s => s.label === 'PIB total Chile')

  const chartData = [...sectorSerie.obs]
    .sort((a, b) => a.obs_date.localeCompare(b.obs_date))
    .map(p => {
      const pibPoint = pibTotal?.obs.find(o => o.obs_date === p.obs_date)
      return {
        date: p.obs_date.slice(0, 7),
        [sectorSerie.label]: p.value,
        ...(pibPoint ? { 'PIB total Chile': pibPoint.value } : {}),
      }
    })

  if (chartData.length < 2) return null

  return (
    <SectionCard title={`Serie histórica BCCh — ${sectorSerie.label}`}>
      <p className="text-xs text-gray-400 mb-4">Datos reales del Banco Central de Chile (últimos 5 años)</p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} width={60} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', background: '#1a1a2e', color: '#F0EFF8' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            <Line type="monotone" dataKey={sectorSerie.label} stroke="#14b8a6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            {pibTotal && (
              <Line type="monotone" dataKey="PIB total Chile" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  )
}

export function MarketStudy() {
  const { validationId } = useParams<{ validationId: string }>()
  const navigate = useNavigate()
  const [ideaDescription, setIdeaDescription] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const [marketSizing, setMarketSizing] = useState<MarketSizing | null>(null)

  useEffect(() => {
    if (!validationId) return
    supabase
      .from('validations')
      .select('idea_description, idea_name, idea_industry, market_sizing')
      .eq('id', validationId)
      .single()
      .then(({ data }) => {
        if (data) {
          setIdeaDescription(data.idea_description ?? data.idea_name)
          setIndustry(data.idea_industry)
          if (data.market_sizing) setMarketSizing(data.market_sizing as MarketSizing)
        }
      })
  }, [validationId])

  const { data, rawSeries, caenes, loading, error } = useMarketAnalysis({
    validationId: validationId ?? null,
    ideaDescription,
    industry,
  })

  const trendCfg = data ? TREND_CONFIG[data.trend] ?? TREND_CONFIG.estable : TREND_CONFIG.estable
  const TrendIcon = trendCfg.icon

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 border border-gray-100 dark:border-white/5 transition-all flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-[#F0EFF8] leading-none">
              Estudio de mercado
            </h1>
            <p className="text-xs text-gray-400 mt-1">Chile · Datos BCCh + INE</p>
          </div>
          {data && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <ConfidenceBadge confidence={data.data_confidence ?? 0} />
              <span className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300">
                CAENES: {caenes}
              </span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-5 mb-6">
            <p className="text-red-700 dark:text-red-400 text-sm">Error al cargar el estudio: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Reintentar
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
            <Skeleton className="h-64 w-full rounded-2xl" />
            <p className="text-center text-sm text-gray-400 animate-pulse">
              Consultando Banco Central de Chile e INE…
            </p>
          </div>
        )}

        {data && !loading && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">

            {/* ── Columna izquierda ── */}
            <div className="space-y-5 min-w-0">

              {/* Tendencia principal */}
              <SectionCard>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{data.sector_name}</p>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-[#F0EFF8] leading-snug">{data.trend_description}</h2>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <TrendIcon className={`h-4 w-4 ${trendCfg.color}`} />
                    <span className={`text-sm font-bold ${trendCfg.color}`}>
                      {data.trend_pct > 0 ? '+' : ''}{data.trend_pct}% anual
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${trendCfg.bg}`}>
                      {data.trend}
                    </span>
                  </div>
                </div>
              </SectionCard>

              {/* Métricas clave */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {data.key_metrics.map((m, i) => (
                  <div key={i} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{m.label}</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8] leading-none mb-1">{m.value}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{m.context}</p>
                  </div>
                ))}
              </div>

              {/* Serie histórica real */}
              <SeriesChart series={rawSeries} />

              {/* TAM / SAM */}
              <SectionCard title="Tamaño de mercado">
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">{data.tam_description}</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'TAM', value: data.tam_clp },
                      { name: 'SAM', value: data.sam_clp },
                    ]} barSize={56}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                      <YAxis tickFormatter={formatClp} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} width={90} />
                      <Tooltip
                        formatter={(v: unknown) => formatClp(v as number)}
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', background: '#1a1a2e', color: '#F0EFF8' }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#14b8a6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">TAM — Mercado total</p>
                    <p className="font-black text-gray-900 dark:text-[#F0EFF8]">{formatClp(data.tam_clp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">SAM — Mercado accesible (Chile)</p>
                    <p className="font-black text-gray-900 dark:text-[#F0EFF8]">{formatClp(data.sam_clp)}</p>
                  </div>
                </div>
              </SectionCard>

              {/* Fit de la idea */}
              {data.idea_fit && (
                <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl p-5">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">
                    Encaje de tu idea en este mercado
                  </p>
                  <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.idea_fit}</p>
                </div>
              )}

              {/* Jugadores clave */}
              {data.key_players?.length > 0 && (
                <SectionCard title="Jugadores clave en Chile">
                  <div className="space-y-3">
                    {data.key_players.map((p, i) => (
                      <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-white/5 last:border-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex-shrink-0 ${PLAYER_TYPE_CONFIG[p.type] ?? PLAYER_TYPE_CONFIG.incumbente}`}>
                          {p.type}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">{p.name}</p>
                          {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Barreras de entrada */}
              {data.entry_barriers?.length > 0 && (
                <SectionCard title="Barreras de entrada" icon={<ShieldAlert className="h-4 w-4 text-orange-400" />}>
                  <ul className="space-y-2.5">
                    {data.entry_barriers.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-[#C4C4D4]">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}

              {/* Oportunidades y riesgos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SectionCard title="Oportunidades">
                  <ul className="space-y-2.5">
                    {data.opportunities.map((op, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-[#C4C4D4]">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        {op}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
                <SectionCard title="Riesgos">
                  <ul className="space-y-2.5">
                    {data.risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-[#C4C4D4]">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>

              {/* Regulación */}
              {data.regulation && (
                <SectionCard title="Regulación relevante">
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{data.regulation}</p>
                </SectionCard>
              )}

              {/* Estacionalidad */}
              {data.seasonality && data.seasonality !== 'Sin estacionalidad relevante' && (
                <SectionCard title="Estacionalidad">
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{data.seasonality}</p>
                </SectionCard>
              )}

              {/* Contexto Chile */}
              <SectionCard title="Contexto chileno">
                <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{data.chile_context}</p>
              </SectionCard>

              <p className="text-xs text-center text-gray-300 dark:text-gray-600 pb-4">
                Datos: Banco Central de Chile (BDE) · INE · Análisis: Claude / GPT-4o-mini
              </p>
            </div>

            {/* ── Columna derecha: Mapa 3D ── */}
            <div className="xl:sticky xl:top-6 space-y-4">
              <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 dark:border-white/5 flex items-center gap-2">
                  <Map className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-bold text-gray-700 dark:text-[#C4C4D4]">Distribución regional del mercado</h2>
                </div>
                <div className="p-5">
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">
                    Visualización 3D de TAM, SAM y SOM entre las 16 regiones de Chile.
                    La altura representa el tamaño relativo. Arrastra para rotar.
                  </p>
                  <div className="hidden sm:block rounded-xl overflow-hidden" style={{ height: '460px' }}>
                    <Suspense
                      fallback={
                        <div className="w-full h-full bg-[#030712] dark:bg-[#0A0A0F] rounded-xl flex flex-col items-center justify-center gap-3 text-gray-500 text-sm">
                          <div className="w-8 h-8 border-2 border-gray-700 border-t-teal-500 rounded-full animate-spin" />
                          Cargando mapa 3D…
                        </div>
                      }
                    >
                      <ChileMarketMap marketSizing={marketSizing} industry={industry} />
                    </Suspense>
                  </div>
                  {/* Mobile: mapa no disponible */}
                  <div className="sm:hidden bg-gray-50 dark:bg-[#0A0A0F] rounded-xl p-6 text-center text-xs text-gray-400">
                    El mapa 3D está disponible en pantallas más grandes.
                  </div>
                  <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center mt-3">
                    Distribución estimada · Pesos basados en PIB regional BCCh
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
