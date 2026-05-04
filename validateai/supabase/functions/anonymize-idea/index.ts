import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const { validation_id } = await req.json()
    if (!validation_id) throw new Error('Missing validation_id')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ── Rate limit: 5 anonimizaciones/día por usuario ────────────────────────
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const { count: callsToday } = await supabaseAdmin
      .from('training_data')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString())
    if ((callsToday ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: 'rate_limit', message: 'Límite diario de anonimizaciones alcanzado.' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Obtener la validación
    const { data: validation, error } = await supabaseAdmin
      .from('validations')
      .select('idea_name, idea_description, idea_industry, target_country, business_model, customer_segment, value_proposition, validation_score, score_breakdown, risk_analysis')
      .eq('id', validation_id)
      .single()

    if (error || !validation) throw new Error('Validation not found')

    // 2. Llamar a Claude Haiku para anonimizar (fetch directo, consistente con ai-validate)
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

    const rawText = `
    Nombre: ${validation.idea_name}
    Descripción: ${validation.idea_description}
    Cliente: ${validation.customer_segment}
    Propuesta: ${validation.value_proposition}
    `

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        temperature: 0,
        system: `Eres un asistente experto en privacidad y anonimización de datos. 
Tu tarea es leer la descripción de una startup y reescribirla en 2-3 frases de manera GENÉRICA y COMPLETAMENTE SECRETA, eliminando cualquier dato identificable, nombres propios, nombres de empresas reales, locaciones precisas o datos sensibles. Redacta el resumen preservando únicamente la mecánica del problema y solución. Responde SOLO con el texto anonimizado.`,
        messages: [{ role: 'user', content: rawText }]
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      throw new Error(`Anthropic API error ${aiRes.status}: ${errText}`)
    }

    const aiData = await aiRes.json()
    const anonymizedSummary = (aiData.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')

    // 3. Guardar en training_data
    const scoresJSON = {
      score: validation.validation_score,
      breakdown: validation.score_breakdown,
      risk_score: validation.risk_analysis?.overallRiskScore ?? null
    }

    const { error: insertError } = await supabaseAdmin
      .from('training_data')
      .insert({
        industry: validation.idea_industry,
        geography: validation.target_country,
        idea_summary: anonymizedSummary,
        scores: scoresJSON,
        outcome: 'unknown'
      })

    if (insertError) throw insertError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[anonymize-idea] Error:', message)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

