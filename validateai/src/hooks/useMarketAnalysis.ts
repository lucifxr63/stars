import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { MarketInsights, RawSeriesPoint } from '@/types/market'

interface UseMarketAnalysisParams {
  validationId: string | null
  ideaDescription: string | null
  industry: string | null
}

export function useMarketAnalysis({
  validationId,
  ideaDescription,
  industry,
}: UseMarketAnalysisParams) {
  const [data, setData] = useState<MarketInsights | null>(null)
  const [rawSeries, setRawSeries] = useState<RawSeriesPoint[]>([])
  const [caenes, setCaenes] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!validationId || !ideaDescription || !industry) return

    setLoading(true)
    setError(null)

    supabase
      .from('market_ai_insights')
      .select('insights_json, caenes_code, raw_series')
      .eq('validation_id', validationId)
      .maybeSingle()
      .then(({ data: cached, error: dbErr }) => {
        if (dbErr) console.error('DB error:', dbErr)

        if (cached?.insights_json) {
          setData(cached.insights_json as MarketInsights)
          setCaenes(cached.caenes_code)
          setRawSeries((cached.raw_series as RawSeriesPoint[]) ?? [])
          setLoading(false)
          return
        }

        supabase.functions
          .invoke('market-analyze', {
            body: { idea_description: ideaDescription, industry, validation_id: validationId },
          })
          .then(({ data: res, error: fnErr }) => {
            if (fnErr) {
              setError(fnErr.message)
            } else if (res?.insights) {
              setData(res.insights as MarketInsights)
              setCaenes(res.caenes)
              setRawSeries((res.raw_series as RawSeriesPoint[]) ?? [])
            }
          })
          .catch((err) => setError(String(err)))
          .finally(() => setLoading(false))
      })
  }, [validationId, ideaDescription, industry])

  return { data, rawSeries, caenes, loading, error }
}
