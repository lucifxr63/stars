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

  return `Eres un analista de datos, experto en marketing de contenidos y storytelling.
Tu tarea es generar el contenido textual de un carrusel de 7 diapositivas optimizado para ${format}.
Te proporcionaremos datos crudos, tendencias del mercado, patrones de startups, contexto personalizado o reportes de agencias (INE, BCCE, RAGs).
Tu misión es estructurar una narrativa coherente extrayendo insights clave de estos datos.

REGLAS ESTRICTAS:
1. Slide 1 (cover): Hook potente. Máx 10 palabras en headline. Detiene el scroll con un dato sorprendente, punto de dolor o pregunta provocadora.
2. Slides 2-6 (body): UNA sola idea o dato por slide. Presenta evidencia, desarrollo del problema y pasos de la solución. Headline máx 8 palabras, body máx 40 palabras.
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
    {
      "id": "slide-3",
      "type": "body",
      "headline": "string",
      "body": "string",
      "icon": "string (emoji opcional)"
    },
    {
      "id": "slide-4",
      "type": "body",
      "headline": "string",
      "body": "string",
      "icon": "string (emoji opcional)"
    },
    {
      "id": "slide-5",
      "type": "body",
      "headline": "string",
      "body": "string",
      "icon": "string (emoji opcional)"
    },
    {
      "id": "slide-6",
      "type": "body",
      "headline": "string",
      "body": "string",
      "icon": "string (emoji opcional)"
    },
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
  const center = ctx.center as string ?? 'custom';
  const frame = ctx.frame as string ?? 'PAS';
  const adminData = ctx.adminData ? JSON.stringify(ctx.adminData, null, 2) : 'No especificado';
  const customData = ctx.customData as string ?? '';

  let prompt = \`Genera una narrativa de datos (Data Story) basada en la siguiente información y enfoque.

ENFOQUE TEMÁTICO (Centro de Información): \${center}
MARCO NARRATIVO A UTILIZAR: \${frame} (Aplica los principios de \${frame} a las slides intermedias)

DATOS INTERNOS DISPONIBLES:
\${adminData}
\`;

  if (customData.trim()) {
    prompt += \`
DATOS PERSONALIZADOS (RAGs, reportes INE, BCCE, o contexto manual):
\${customData}

PRESTA ESPECIAL ATENCIÓN A LOS DATOS PERSONALIZADOS. Utilízalos como la principal fuente de tu narrativa y acompáñalos con los datos internos si son relevantes.
\`;
  }

  prompt += \`
Asegúrate de que la narrativa fluya con coherencia: el hook del cover conecte con el tema principal, los slides intermedios desarrollen la historia mostrando datos concretos y revelaciones, y el CTA invite a la acción o a discutir los resultados en comentarios.\`;

  return prompt;
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
      throw new Error(\`Anthropic error \${response.status}: \${err}\`);
    }

    const anthropicData = await response.json();
    const rawText = anthropicData.content?.[0]?.text ?? '';
    const jsonStr = extractJSON(rawText);
    const parsed = JSON.parse(jsonStr);

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
