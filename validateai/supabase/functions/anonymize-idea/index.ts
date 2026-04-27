import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { Anthropic } from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { validation_id } = await req.json()
    if (!validation_id) throw new Error('Missing validation_id')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Obtener la validación
    const { data: validation, error } = await supabaseAdmin
      .from('validations')
      .select('idea_name, idea_description, idea_industry, target_country, business_model, customer_segment, value_proposition, validation_score, score_breakdown, risk_analysis')
      .eq('id', validation_id)
      .single()

    if (error || !validation) throw new Error('Validation not found')

    // 2. Llamar a Claude Haiku para anonimizar la descripción global de la idea
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    })

    const rawText = `
    Nombre: ${validation.idea_name}
    Descripción: ${validation.idea_description}
    Cliente: ${validation.customer_segment}
    Propuesta: ${validation.value_proposition}
    `

    const aiRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      temperature: 0,
      system: `Eres un asistente experto en privacidad y anonimización de datos. 
Tu tarea es leer la descripción de una startup y reescribirla en 2-3 frases de manera GENÉRICA y COMPLETAMENTE SECRETA, eliminando cualquier dato identificable, nombres propios, nombres de empresas reales, locaciones precisas o datos sensibles. Redacta el resumen preservando únicamente la mecánica del problema y solución. Responde SOLO con el texto anonimizado.`,
      messages: [{ role: 'user', content: rawText }]
    });

    const anonymizedSummary = Array.isArray(aiRes.content) ? (aiRes.content[0] as any).text : aiRes.content;

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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
