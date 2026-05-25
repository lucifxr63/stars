import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]

// ── OWASP LLM01: Input Sanitization ──────────────────────────────────────────
// Bloquea patrones de prompt injection antes de que el texto del fundador
// llegue al modelo. Un PDF o formulario malicioso podría contener instrucciones
// ocultas que sobrescriban el system prompt o expongan secrets de entorno.
//
// Referencia: OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection
const INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|your)\s+instructions/i,  label: 'override_instructions' },
  { pattern: /forget\s+(everything|all|your\s+system)/i,                  label: 'forget_context' },
  { pattern: /you\s+are\s+now\s+(a|an)\s+/i,                            label: 'persona_override' },
  { pattern: /new\s+(persona|identity|role)\s*:/i,                        label: 'role_injection' },
  { pattern: /system\s+prompt\s*:/i,                                      label: 'system_prompt_leak' },
  { pattern: /reveal\s+(your\s+)?(instructions|prompt|api\s+key)/i,       label: 'secret_extraction' },
  { pattern: /Deno\.env\.get/i,                                           label: 'env_access_attempt' },
  { pattern: /process\.env\./i,                                           label: 'node_env_attempt' },
  { pattern: /ANTHROPIC_API_KEY|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE/i,  label: 'secret_name_probing' },
  { pattern: /<script[\s\S]*?>/i,                                         label: 'xss_attempt' },
  { pattern: /\{\{.*?\}\}/,                                               label: 'template_injection' },
  { pattern: /\$\{.*?\}/,                                                 label: 'js_template_injection' },
]

const MAX_INPUT_CHARS = 4_000  // Límite razonable para descripción de startup

interface SanitizeResult {
  safe: boolean
  sanitized: string
  flags: string[]
}

function sanitizeInput(text: string): SanitizeResult {
  if (!text || typeof text !== 'string') return { safe: false, sanitized: '', flags: ['invalid_type'] }

  // Límite de longitud — textos excesivamente largos pueden ser vectores de ataque
  const truncated = text.slice(0, MAX_INPUT_CHARS)

  const flags: string[] = []
  let sanitized = truncated

  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      flags.push(label)
      sanitized = sanitized.replace(pattern, '[CONTENIDO_SANITIZADO]')
    }
  }

  return { safe: flags.length === 0, sanitized, flags }
}

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

    // 2. Sanitizar inputs ANTES de enviar al modelo (OWASP LLM01)
    const fieldsToSanitize = [
      validation.idea_name ?? '',
      validation.idea_description ?? '',
      validation.customer_segment ?? '',
      validation.value_proposition ?? '',
    ].join(' ')

    const sanitizeResult = sanitizeInput(fieldsToSanitize)

    if (!sanitizeResult.safe) {
      // Loguear el intento de inyección para auditoría — no exponer los flags al cliente
      console.warn(`[anonymize-idea] Prompt injection bloqueado para user_id=${user.id}`, {
        flags: sanitizeResult.flags,
        validation_id,
      })
      // Continuar con el texto sanitizado (no bloqueamos al usuario legítimo que
      // accidentalmente usó una frase que coincide con un patrón).
      // Si el porcentaje de flags es alto (>3), sí bloqueamos.
      if (sanitizeResult.flags.length > 3) {
        return new Response(JSON.stringify({
          error: 'input_rejected',
          message: 'El texto contiene contenido no permitido. Revisa la descripción de tu idea.',
        }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

    // Usar texto sanitizado — los campos individuales también pasan por sanitizeInput
    const sanitizeName    = sanitizeInput(validation.idea_name ?? '').sanitized
    const sanitizeDesc    = sanitizeInput(validation.idea_description ?? '').sanitized
    const sanitizeSegment = sanitizeInput(validation.customer_segment ?? '').sanitized
    const sanitizeProp    = sanitizeInput(validation.value_proposition ?? '').sanitized

    const rawText = `
    Nombre: ${sanitizeName}
    Descripción: ${sanitizeDesc}
    Cliente: ${sanitizeSegment}
    Propuesta: ${sanitizeProp}
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
        user_id: user.id,
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

