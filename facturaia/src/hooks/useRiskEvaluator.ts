import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type RiskAssessment = Database['public']['Tables']['risk_assessments']['Row']

interface EvaluateParams {
  invoice_id: string
  rut_emisor: string
  rut_receptor: string
  razon_social_receptor: string
  monto_total: number
  fecha_emision: string
  fecha_vencimiento: string
}

interface UseRiskEvaluatorReturn {
  evaluate: (params: EvaluateParams) => Promise<RiskAssessment | null>
  assessment: RiskAssessment | null
  loading: boolean
  error: string | null
  reset: () => void
}

export function useRiskEvaluator(): UseRiskEvaluatorReturn {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function evaluate(params: EvaluateParams): Promise<RiskAssessment | null> {
    setLoading(true)
    setError(null)
    setAssessment(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No autenticado')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const response = await fetch(
        `${supabaseUrl}/functions/v1/sii-risk-evaluator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(params),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Error al evaluar la factura')
      }

      setAssessment(data.assessment)
      return data.assessment
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setAssessment(null)
    setError(null)
    setLoading(false)
  }

  return { evaluate, assessment, loading, error, reset }
}
