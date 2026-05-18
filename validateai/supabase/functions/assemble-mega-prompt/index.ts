import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { validation_id } = await req.json();

    if (!validation_id) {
      return new Response(JSON.stringify({ error: 'validation_id is required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 1. Obtener validación base
    const { data: validation, error: validationError } = await supabase
      .from('validations')
      .select('*')
      .eq('id', validation_id)
      .eq('user_id', user.id)
      .single();

    if (validationError || !validation) {
      throw new Error('Validación no encontrada o sin acceso.');
    }

    // 2. Obtener contextos asíncronos (Fintoc, PJUD, INAPI)
    const { data: contexts, error: ctxError } = await supabase
      .from('temp_context')
      .select('source, payload, status')
      .eq('validation_id', validation_id);

    if (ctxError) {
      console.warn('Error obteniendo temp_context:', ctxError);
    }

    const contextMap = (contexts || []).reduce((acc: any, curr) => {
      acc[curr.source] = curr.payload;
      return acc;
    }, {});

    // 3. Ensamblar Mega-Prompt
    const megaPrompt = `
Eres un analista de venture capital extremadamente riguroso, al estilo de Paul Graham.
Evalúa la siguiente startup basándote estrictamente en los datos disponibles. No asumas ni inventes métricas financieras o legales si no están en los datos.

IDEA: ${validation.idea_name || 'N/A'}
INDUSTRIA: ${validation.idea_industry || 'N/A'}
MODELO DE NEGOCIO: ${validation.business_model || 'N/A'}
ETAPA: ${validation.business_stage || 'N/A'}
PUNTOS DE DOLOR: ${(validation.customer_pain_points || []).join(', ')}

CONTEXTO DE OPEN BANKING (Fintoc):
${JSON.stringify(contextMap.fintoc || 'No se conectó cuenta bancaria.')}

CONTEXTO JUDICIAL Y LEGAL (PJUD):
${JSON.stringify(contextMap.pjud || 'No se registraron causas judiciales.')}

CONTEXTO DE PROPIEDAD INTELECTUAL (INAPI):
${JSON.stringify(contextMap.inapi || 'No se revisaron marcas o patentes.')}

Tu tarea es generar un análisis de "Due Diligence" en formato JSON.
La salida debe adherirse estrictamente al siguiente esquema JSON sin markdown ni texto extra.
{
  "score": número (0-100),
  "legal_risk": "low" | "medium" | "high",
  "financial_health": "poor" | "fair" | "good" | "excellent",
  "ip_protection": "none" | "weak" | "strong",
  "red_flags": ["bandera roja 1", "bandera roja 2"],
  "strengths": ["fortaleza 1", "fortaleza 2"],
  "verdict_summary": "resumen ejecutivo del análisis"
}
`;

    // 4. Llamar a OpenAI (GPT-4o) con temperature 0
    const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        temperature: 0, // CRÍTICO: Determinístico para compliance
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: megaPrompt }],
      }),
    });

    if (!oaiRes.ok) {
      const errText = await oaiRes.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const oaiData = await oaiRes.json();
    const resultJson = JSON.parse(oaiData.choices[0].message.content);

    // 5. Actualizar la validación con el Due Diligence Score
    await supabase
      .from('validations')
      .update({ due_diligence_score: resultJson })
      .eq('id', validation_id);

    // 6. Marcar contextos como procesados
    await supabase
      .from('temp_context')
      .update({ status: 'processed' })
      .eq('validation_id', validation_id)
      .eq('status', 'pending');

    return new Response(JSON.stringify({ success: true, due_diligence_score: resultJson }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('assemble-mega-prompt error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
