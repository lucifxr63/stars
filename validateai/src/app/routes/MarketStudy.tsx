import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useMarketAnalysis } from '@/hooks/useMarketAnalysis'
import type { RawSeriesPoint } from '@/types/market'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ArrowLeft, RefreshCw, ShieldAlert, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const TREND_CONFIG = {
  creciente:   { icon: TrendingUp,   color: 'text-green-600',  badge: 'default' as const },
  estable:     { icon: Minus,        color: 'text-yellow-600', badge: 'secondary' as const },
  decreciente: { icon: TrendingDown, color: 'text-red-600',    badge: 'destructive' as const },
}

const PLAYER_TYPE_CONFIG = {
  incumbente:    'bg-gray-100 text-gray-700 border-gray-200',
  startup:       'bg-blue-50 text-blue-700 border-blue-200',
  internacional: 'bg-purple-50 text-purple-700 border-purple-200',
}

function formatClp(millions: number): string {
  if (millions >= 1_000_000) return `${(millions / 1_000_000).toFixed(1)} B CLP`
  if (millions >= 1_000)     return `${(millions / 1_000).toFixed(1)} MM CLP`
  return `${millions.toFixed(0)} M CLP`
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const isHigh = confidence >= 70
  const isMid  = confidence >= 40
  const color  = isHigh ? 'text-green-700 bg-green-50 border-green-200'
               : isMid  ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
               :           'text-red-700 bg-red-50 border-red-200'
  const label  = isHigh ? 'Alta' : isMid ? 'Parcial' : 'Baja'
  const tip    = isHigh
    ? 'La mayoría de los datos provienen de series reales del BCCh.'
    : isMid
    ? 'Algunos datos son del BCCh, el resto es estimación del modelo.'
    : 'Pocos datos reales disponibles — los valores son estimaciones del modelo.'

  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${color}`} title={tip}>
      <Info className="h-3 w-3" />
      Confianza {label} ({confidence}% datos reales BCCh)
    </div>
  )
}

function SeriesChart({ series }: { series: RawSeriesPoint[] }) {
  const withData = series.filter(s => s.obs && s.obs.length > 0)
  if (withData.length === 0) return null

  // Mostrar solo la serie del sector (primera) y PIB total como comparación
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Serie histórica BCCh — {sectorSerie.label}</CardTitle>
        <p className="text-xs text-muted-foreground">Datos reales del Banco Central de Chile (últimos 5 años)</p>
      </CardHeader>
      <CardContent>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={60} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey={sectorSerie.label}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              {pibTotal && (
                <Line
                  type="monotone"
                  dataKey="PIB total Chile"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function MarketStudy() {
  const { validationId } = useParams<{ validationId: string }>()
  const navigate = useNavigate()
  const [ideaDescription, setIdeaDescription] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)

  useEffect(() => {
    if (!validationId) return
    supabase
      .from('validations')
      .select('idea_description, idea_name, idea_industry')
      .eq('id', validationId)
      .single()
      .then(({ data }) => {
        if (data) {
          setIdeaDescription(data.idea_description ?? data.idea_name)
          setIndustry(data.idea_industry)
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
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Estudio de mercado</h1>
            <p className="text-muted-foreground text-sm">Chile · Datos BCCh + INE</p>
          </div>
          {data && (
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <ConfidenceBadge confidence={data.data_confidence ?? 0} />
              <Badge variant="outline">CAENES: {caenes}</Badge>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <Card className="border-destructive mb-6">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">Error al cargar el estudio: {error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
                <RefreshCw className="h-3 w-3 mr-2" /> Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64 w-full" />
            <p className="text-center text-sm text-muted-foreground animate-pulse">
              Consultando Banco Central de Chile e INE…
            </p>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <div className="space-y-6">

            {/* Tendencia */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">{data.sector_name}</p>
                <h2 className="text-xl font-semibold mb-3">{data.trend_description}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <TrendIcon className={`h-4 w-4 ${trendCfg.color}`} />
                  <span className={`font-medium ${trendCfg.color}`}>
                    {data.trend_pct > 0 ? '+' : ''}{data.trend_pct}% anual
                  </span>
                  <Badge variant={trendCfg.badge}>{data.trend}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Métricas clave */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {data.key_metrics.map((m, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-2xl font-semibold my-1">{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.context}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Serie histórica real */}
            <SeriesChart series={rawSeries} />

            {/* TAM / SAM */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tamaño de mercado</CardTitle>
                <p className="text-xs text-muted-foreground">{data.tam_description}</p>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'TAM', value: data.tam_clp },
                      { name: 'SAM', value: data.sam_clp },
                    ]} barSize={60}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={formatClp} axisLine={false} tickLine={false} width={90} />
                      <Tooltip formatter={(v) => formatClp(v as number)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">TAM — Mercado total</p>
                    <p className="font-semibold">{formatClp(data.tam_clp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SAM — Mercado accesible (Chile)</p>
                    <p className="font-semibold">{formatClp(data.sam_clp)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fit de la idea */}
            {data.idea_fit && (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader>
                  <CardTitle className="text-base text-blue-800 dark:text-blue-300">
                    Encaje de tu idea en este mercado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{data.idea_fit}</p>
                </CardContent>
              </Card>
            )}

            {/* Jugadores clave */}
            {data.key_players?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Jugadores clave en Chile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.key_players.map((p, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${PLAYER_TYPE_CONFIG[p.type] ?? PLAYER_TYPE_CONFIG.incumbente}`}>
                          {p.type}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{p.name}</p>
                          {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Barreras de entrada */}
            {data.entry_barriers?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-orange-500" />
                    Barreras de entrada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.entry_barriers.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Oportunidades y riesgos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-green-700 dark:text-green-400">Oportunidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.opportunities.map((op, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        {op}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-700 dark:text-red-400">Riesgos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Regulación */}
            {data.regulation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Regulación relevante</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{data.regulation}</p>
                </CardContent>
              </Card>
            )}

            {/* Estacionalidad */}
            {data.seasonality && data.seasonality !== 'Sin estacionalidad relevante' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Estacionalidad</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{data.seasonality}</p>
                </CardContent>
              </Card>
            )}

            {/* Contexto Chile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contexto chileno</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{data.chile_context}</p>
              </CardContent>
            </Card>

            <p className="text-xs text-center text-muted-foreground">
              Datos: Banco Central de Chile (BDE) · INE · Análisis: GPT-4o-mini (OpenAI)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
