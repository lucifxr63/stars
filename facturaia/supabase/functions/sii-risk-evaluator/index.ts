// FacturaIA — Edge Function: sii-risk-evaluator
// Motor de Riesgo Tributario con IA
// Evalúa facturas y genera un Tax Risk Score (0-100)
// Aprobación automática si: pagador es Gran Empresa Y score <= 35

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvoicePayload {
  invoice_id: string
  rut_emisor: string
  rut_receptor: string
  razon_social_receptor: string
  monto_total: number
  fecha_emision: string
  fecha_vencimiento: string
}

interface RiskScoreBreakdown {
  monto_score: number       // 0-25: riesgo por tamaño de la factura
  antiguedad_score: number  // 0-25: riesgo por antigüedad del receptor
  plazo_score: number       // 0-25: riesgo por plazo de vencimiento
  ai_score: number          // 0-25: análisis semántico IA
  total: number             // 0-100
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('No autorizado', 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verificar JWT del usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return errorResponse('Token inválido', 401)
    }

    const payload: InvoicePayload = await req.json()
    const { invoice_id, rut_emisor, rut_receptor, razon_social_receptor, monto_total, fecha_emision, fecha_vencimiento } = payload

    // Verificar que la factura pertenece al usuario
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, company_id, companies!inner(user_id)')
      .eq('id', invoice_id)
      .single()

    if (invoiceError || !invoice) {
      return errorResponse('Factura no encontrada', 404)
    }

    // Actualizar estado a en_evaluacion
    await supabase.from('invoices').update({ estado: 'en_evaluacion' }).eq('id', invoice_id)

    // 1. Verificar si el pagador es Gran Empresa
    const { data: granEmpresa } = await supabase
      .from('gran_empresa_ruts')
      .select('rut, razon_social')
      .eq('rut', rut_receptor)
      .eq('activo', true)
      .maybeSingle()

    const pagadorEsGranEmpresa = !!granEmpresa

    // 2. Calcular score por reglas de negocio
    const breakdown = await calculateRiskScore({
      monto_total,
      fecha_emision,
      fecha_vencimiento,
      rut_receptor,
      razon_social_receptor,
      pagadorEsGranEmpresa,
    })

    // 3. Análisis IA con Claude para el componente semántico
    const aiScore = await getAIRiskScore({
      rut_emisor,
      rut_receptor,
      razon_social_receptor,
      monto_total,
      fecha_emision,
      fecha_vencimiento,
      pagadorEsGranEmpresa,
    })

    breakdown.ai_score = aiScore
    breakdown.total = breakdown.monto_score + breakdown.antiguedad_score + breakdown.plazo_score + aiScore

    // 4. Determinar recomendación
    const COMMISSION_RATE = 0.015
    const comisionFlat = Math.round(monto_total * COMMISSION_RATE)
    const montoATransferir = monto_total - comisionFlat

    let recomendacion: 'aprobar' | 'revisar' | 'rechazar'
    let razon: string
    let aprobacionAutomatica = false

    if (pagadorEsGranEmpresa && breakdown.total <= 35) {
      recomendacion = 'aprobar'
      razon = `Pagador Gran Empresa (${granEmpresa?.razon_social}). Risk Score bajo (${breakdown.total}/100). Aprobación automática activada.`
      aprobacionAutomatica = true
    } else if (breakdown.total <= 50) {
      recomendacion = 'aprobar'
      razon = `Risk Score aceptable (${breakdown.total}/100). Pagador verificado.`
    } else if (breakdown.total <= 70) {
      recomendacion = 'revisar'
      razon = `Risk Score moderado (${breakdown.total}/100). Requiere revisión manual por el equipo de riesgo.`
    } else {
      recomendacion = 'rechazar'
      razon = `Risk Score alto (${breakdown.total}/100). Riesgo tributario elevado detectado.`
    }

    // 5. Guardar evaluación
    const { data: assessment, error: assessError } = await supabase
      .from('risk_assessments')
      .insert({
        invoice_id,
        tax_risk_score: breakdown.total,
        score_breakdown: breakdown,
        pagador_es_gran_empresa: pagadorEsGranEmpresa,
        aprobacion_automatica: aprobacionAutomatica,
        recomendacion,
        razon,
        monto_a_transferir: montoATransferir,
        comision_flat: comisionFlat,
      })
      .select()
      .single()

    if (assessError) throw assessError

    // 6. Actualizar estado de la factura
    const nuevoEstado = recomendacion === 'rechazar' ? 'rechazada' : 'aprobada'
    await supabase.from('invoices').update({ estado: nuevoEstado }).eq('id', invoice_id)

    // 7. Audit log
    await supabase.rpc('log_audit_event', {
      p_user_id: user.id,
      p_action: 'risk.evaluated',
      p_table: 'risk_assessments',
      p_record_id: assessment.id,
      p_new: assessment,
    })

    return new Response(
      JSON.stringify({
        success: true,
        assessment: {
          ...assessment,
          pagador_gran_empresa_nombre: granEmpresa?.razon_social ?? null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('sii-risk-evaluator error:', err)
    return errorResponse('Error interno del servidor', 500)
  }
})

// ─── Helpers ────────────────────────────────────────────────

async function calculateRiskScore(params: {
  monto_total: number
  fecha_emision: string
  fecha_vencimiento: string
  rut_receptor: string
  razon_social_receptor: string
  pagadorEsGranEmpresa: boolean
}): Promise<RiskScoreBreakdown> {
  const { monto_total, fecha_emision, fecha_vencimiento, pagadorEsGranEmpresa } = params

  // Score por monto (facturas muy grandes o muy pequeñas son más riesgosas)
  let montoScore = 5
  if (monto_total < 500_000) montoScore = 20    // Muy pequeña, posible fragmentación
  else if (monto_total > 500_000_000) montoScore = 18  // Muy grande
  else if (monto_total >= 1_000_000 && monto_total <= 50_000_000) montoScore = 5  // Rango óptimo

  // Descuento si Gran Empresa
  if (pagadorEsGranEmpresa) montoScore = Math.max(0, montoScore - 10)

  // Score por plazo de vencimiento
  const diasHastaVencimiento = Math.floor(
    (new Date(fecha_vencimiento).getTime() - new Date(fecha_emision).getTime()) / (1000 * 60 * 60 * 24)
  )
  let plazoScore = 10
  if (diasHastaVencimiento <= 30) plazoScore = 5   // Corto plazo = bajo riesgo
  else if (diasHastaVencimiento <= 60) plazoScore = 10
  else if (diasHastaVencimiento <= 90) plazoScore = 15
  else plazoScore = 22  // Más de 90 días = mayor incertidumbre

  // Score por antigüedad (simplificado - en producción consultar SII)
  const antiguedadScore = pagadorEsGranEmpresa ? 3 : 12

  return {
    monto_score: montoScore,
    antiguedad_score: antiguedadScore,
    plazo_score: plazoScore,
    ai_score: 0,  // Se llena después
    total: 0,
  }
}

async function getAIRiskScore(params: {
  rut_emisor: string
  rut_receptor: string
  razon_social_receptor: string
  monto_total: number
  fecha_emision: string
  fecha_vencimiento: string
  pagadorEsGranEmpresa: boolean
}): Promise<number> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    console.warn('ANTHROPIC_API_KEY no configurada, usando score por defecto')
    return params.pagadorEsGranEmpresa ? 5 : 12
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey })

    const prompt = `Eres un analista de riesgo tributario para una Fintech chilena llamada FacturaIA.
Analiza esta factura y asigna un puntaje de riesgo tributario del componente de análisis semántico entre 0 y 25 (0=sin riesgo, 25=riesgo máximo).

Datos de la factura:
- RUT Emisor: ${params.rut_emisor}
- RUT Receptor: ${params.rut_receptor}
- Razón Social Receptor: ${params.razon_social_receptor}
- Monto Total: $${params.monto_total.toLocaleString('es-CL')} CLP
- Fecha Emisión: ${params.fecha_emision}
- Fecha Vencimiento: ${params.fecha_vencimiento}
- Pagador es Gran Empresa registrada: ${params.pagadorEsGranEmpresa ? 'SÍ' : 'NO'}

Factores a considerar:
1. Consistencia entre razón social y RUT
2. Monto coherente con el tipo de empresa
3. Plazos razonables para el mercado chileno
4. Señales de operación fantasma o fraccionamiento

Responde SOLO con un número entero entre 0 y 25. Nada más.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '10'
    const score = parseInt(text, 10)

    if (isNaN(score) || score < 0 || score > 25) return 10

    return score
  } catch (err) {
    console.error('Error llamando a Claude:', err)
    return params.pagadorEsGranEmpresa ? 5 : 12
  }
}

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
