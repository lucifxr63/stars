// Edge Function: survey-analyze
// Procesa respuestas cualitativas con LLM usando Structured Outputs.
// Implementa el paradigma descrito en VALIDATEAI_CLIENTES.MD:
//   - Extracción semántica: problema central, severidad, soluciones actuales, WTP, friction score
//   - Pipeline de privacidad: marca submissions como 'pseudonymized' después del análisis
// POST /survey-analyze body: { form_id }  (procesa todas las submissions 'raw' del form)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRK      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'https://validateai.cl',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  };
}

function json(data: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ── Schema de Structured Output (según el doc) ────────────
// El LLM debe retornar EXACTAMENTE este JSON para cada respuesta
const ANALYSIS_SYSTEM_PROMPT = `Eres un analista experto en Customer Development y metodología "The Mom Test".
Tu función es analizar respuestas de encuestas de validación de problemas de mercado.

Debes retornar EXCLUSIVAMENTE un objeto JSON válido con esta estructura exacta (sin texto adicional):
{
  "central_problem": "descripción concisa del problema central identificado",
  "severity": "tolerable" | "critico" | "paralizante",
  "current_solutions": ["solución1", "solución2"],
  "willingness_to_pay": true | false,
  "friction_score": <número entero del 1 al 10>,
  "key_quotes": ["cita textual 1", "cita textual 2"],
  "mom_test_signals": {
    "talks_about_past": true | false,
    "mentions_money_spent": true | false,
    "reveals_workarounds": true | false
  }
}

Criterios:
- severity "tolerable": el encuestado convive con el problema sin urgencia
- severity "critico": el problema afecta operaciones regularmente y tiene consecuencias reales
- severity "paralizante": el problema detiene operaciones o tiene consecuencias financieras graves
- willingness_to_pay: true SOLO si el encuestado menciona haber gastado dinero o tiempo significativo en soluciones actuales
- friction_score: 1=mínima fricción, 10=fricción máxima paralizante
- mom_test_signals: indicadores de que la respuesta sigue el método "The Mom Test" (habla de hechos pasados, no hipótesis)`;

// ── Análisis de una submission individual ────────────────
async function analyzeSingleSubmission(
  responseData: Record<string, unknown>,
  formFields: Array<{ id: string; label: string; type: string }>,
): Promise<Record<string, unknown> | null> {
  // Construir texto de la respuesta para el LLM
  const lines: string[] = [];
  for (const field of formFields) {
    const val = responseData[field.id];
    if (val === undefined || val === null || val === '') continue;
    const valStr = Array.isArray(val) ? val.join(', ') : String(val);
    lines.push(`Pregunta: ${field.label}\nRespuesta: ${valStr}`);
  }

  if (lines.length === 0) return null;
  const responseText = lines.join('\n\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Analiza esta respuesta de encuesta de Customer Development:\n\n${responseText}`,
      }],
    }),
  });

  if (!response.ok) {
    console.error('[survey-analyze] Anthropic error:', response.status, await response.text());
    return null;
  }

  const result = await response.json();
  const text = result.content?.[0]?.text ?? '';

  // Detectar refusal del modelo
  if (result.stop_reason === 'end_turn' && !text.trim().startsWith('{')) {
    console.warn('[survey-analyze] Model refusal or unexpected output:', text.slice(0, 200));
    return null;
  }

  try {
    // Extraer JSON de la respuesta (por si el modelo añade texto antes/después)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    console.error('[survey-analyze] JSON parse error:', text.slice(0, 300));
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401, req);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SRK);
  const userClient = createClient(
    SUPABASE_URL,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Invalid session' }, 401, req);

  try {
    const { form_id } = await req.json();
    if (!form_id) return json({ error: 'form_id is required' }, 400, req);

    // Verificar que el form pertenece al usuario
    const { data: form, error: formError } = await supabaseAdmin
      .from('survey_forms')
      .select('id, schema_json')
      .eq('id', form_id)
      .eq('client_id', user.id)
      .single();

    if (formError || !form) return json({ error: 'Form not found' }, 404, req);

    // Obtener submissions pendientes de análisis
    const { data: submissions, error: subError } = await supabaseAdmin
      .from('survey_submissions')
      .select('id, response_data')
      .eq('form_id', form_id)
      .eq('anonymization_status', 'raw')
      .is('analysis_result', null)
      .limit(50); // procesar en lotes de 50

    if (subError) throw subError;
    if (!submissions || submissions.length === 0) {
      return json({ ok: true, processed: 0, message: 'No pending submissions' }, 200, req);
    }

    const formFields = (form.schema_json as { fields: Array<{ id: string; label: string; type: string }> }).fields;
    let processed = 0;
    let failed = 0;

    // Procesar en paralelo con concurrencia limitada (3 simultáneas)
    const CONCURRENCY = 3;
    for (let i = 0; i < submissions.length; i += CONCURRENCY) {
      const batch = submissions.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (sub) => {
        const analysis = await analyzeSingleSubmission(
          sub.response_data as Record<string, unknown>,
          formFields,
        );

        if (analysis) {
          const { error: updateError } = await supabaseAdmin
            .from('survey_submissions')
            .update({
              analysis_result: analysis,
              anonymization_status: 'pseudonymized',
            })
            .eq('id', sub.id);

          if (updateError) {
            console.error('[survey-analyze] Update error:', updateError);
            failed++;
          } else {
            processed++;
          }
        } else {
          failed++;
        }
      }));
    }

    console.log(`[survey-analyze] form=${form_id} processed=${processed} failed=${failed}`);
    return json({ ok: true, processed, failed, total: submissions.length }, 200, req);

  } catch (err) {
    console.error('[survey-analyze]', err);
    return json({ error: 'Internal server error' }, 500, req);
  }
});
