export interface MarketInsights {
  sector_name: string
  caenes_code: string
  data_confidence: number
  trend: 'creciente' | 'estable' | 'decreciente'
  trend_description: string
  trend_pct: number
  key_metrics: {
    label: string
    value: string
    context: string
  }[]
  tam_clp: number
  sam_clp: number
  tam_description: string
  entry_barriers: string[]
  regulation: string
  key_players: {
    name: string
    type: 'incumbente' | 'startup' | 'internacional'
    notes: string
  }[]
  seasonality: string
  idea_fit: string
  opportunities: string[]
  risks: string[]
  chile_context: string
  error?: string
}

export interface RawSeriesPoint {
  id: string
  label: string
  points: number
  obs: { obs_date: string; value: number }[]
  latest: { obs_date: string; value: number } | null
}

export interface MarketAnalysisResult {
  caenes: string
  insights: MarketInsights
  raw_series: RawSeriesPoint[]
  cached?: boolean
}
