import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function extractJSON(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1) return trimmed.slice(first, last + 1);
  return trimmed;
}

function buildSystemPrompt(platform: 'linkedin' | 'instagram'): string {
  const format = platform === 'linkedin'
    ? 'formato cuadrado 1:1 para LinkedIn; tono profesional B2B, lenguaje de autoridad y liderazgo de pensamiento'
    : 'formato vertical 4:5 para Instagram; tono visual B2C, lenguaje directo y emocional orientado al consumidor';

  return `Eres un experto en marketing de contenidos y storytelling para redes sociales.
Tu tarea es generar el contenido textual de un carrusel de 7 diapositivas optimizado para ${format}.

REGLAS ESTRICTAS:
1. Slide 1 (cover): Hook potente. Máx 10 palabras en headline. Detiene el scroll con un punto de dolor o pregunta provocadora.
2. Slides 2-6 (body): UNA sola idea por slide. Usa el marco PAS o AIDA. Headline máx 8 palabras, body máx 40 palabras.
3. Slide 7 (cta): Llamado a la acción claro y específico. Headline máx 10 palabras, body máx 30 palabras.
4. Todos los textos en español.
5. Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin explicaciones.

SCHEMA JSON REQUERIDO (no cambies los nombres de campo):
{
  "campaign_title": "string (título interno de la campaña, máx 60 chars)",
  "slides": [
    {
      "id": "slide-1",
      "type": "cover",
      "headline": "string",
      "body": "string",
      "icon": "string (emoji opcional)"
    },
    {
      "id": "slide-2",
      "type": "body",
      "headline": "string",
      "body": "string",
      "icon": "string (emoji opcional)"
    },
    ... (slides 3-6 igual que slide-2, type "body")
    {
      "id": "slide-7",
      "type": "cta",
      "headline": "string",
      "body": "string",
      "icon": "string (emoji opcional)"
    }
  ]
}`;
}

function buildUserPrompt(ctx: Record<string, unknown>): string {
  return `Genera un carrusel basado en esta idea de negocio validada:

IDEA: ${ctx.idea_name ?? 'Sin nombre'}
DESCRIPCIÓN: ${ctx.idea_description ?? 'Sin descripción'}
INDUSTRIA: ${ctx.idea_industry ?? 'No especificada'}
SEGMENTO OBJETIVO: ${ctx.customer_segment ?? 'No especificado'}
MODELO DE NEGOCIO: ${ctx.business_model ?? 'No especificado'}
PROPUESTA DE VALOR: ${ctx.value_prop ?? 'No especificada'}
PROBLEMA QUE RESUELVE: ${ctx.problem ?? 'No especificado'}
SOLUCIÓN ACTUAL DEL MERCADO: ${ctx.current_solution ?? 'No especificada'}

Asegúrate de que la narrativa fluya con coherencia: el hook del cover conecte con el problema, los slides intermedios desarrollen la solución con datos o pasos, y el CTA sea concreto y orientado a resultados.`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { platform = 'linkedin', context = {} } = body as {
      platform: 'linkedin' | 'instagram';
      context: Record<string, unknown>;
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: buildSystemPrompt(platform),
        messages: [{ role: 'user', content: buildUserPrompt(context) }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${err}`);
    }

    const anthropicData = await response.json();
    const rawText = anthropicData.content?.[0]?.text ?? '';
    const jsonStr = extractJSON(rawText);
    const parsed = JSON.parse(jsonStr);

    // Validación mínima de estructura
    if (!Array.isArray(parsed.slides) || parsed.slides.length < 7) {
      throw new Error('Respuesta de IA con estructura inválida');
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
