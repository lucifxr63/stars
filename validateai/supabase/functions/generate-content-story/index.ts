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

function buildSystemPrompt(platform: 'linkedin' | 'instagram', frame: 'pas' | 'aida'): string {
  const formatDesc = platform === 'linkedin'
    ? 'carrusel de LinkedIn (PDF, cuadrado 1:1, tono B2B profesional, autoridad de pensamiento)'
    : 'carrusel de Instagram (PNG ZIP, vertical 4:5, tono B2C directo y visual)';

  const frameDesc = frame === 'pas'
    ? 'Problema → Agitación → Solución (PAS): el hook expone el problema, los slides intermedios lo agitan y revelan la solución, el CTA invita a actuar.'
    : 'Atención → Interés → Deseo → Acción (AIDA): el hook capta atención, slides generan interés y deseo, el CTA concreta la acción.';

  return `Eres un experto en data storytelling y marketing de contenidos para startups y fundadores en LatAm.
Tu misión: convertir datos reales de una plataforma de validación de startups en un ${formatDesc} de 7 diapositivas con narrativa estructurada.

MARCO NARRATIVO: ${frameDesc}

REGLAS ESTRICTAS:
1. Slide 1 (cover): Hook que detiene el scroll. Headline ≤ 10 palabras. Punto de dolor o dato impactante.
2. Slides 2–6 (body): UNA sola idea por slide. Headline ≤ 8 palabras. Body ≤ 40 palabras. Datos concretos del contexto.
3. Slide 7 (cta): Llamado a la acción específico. Headline ≤ 10 palabras. Body ≤ 30 palabras.
4. Todos los textos en español latinoamericano.
5. Usa los datos reales proporcionados — no inventes cifras que no estén en el contexto.
6. Responde ÚNICAMENTE con JSON válido. Sin texto adicional. Sin markdown.

SCHEMA JSON REQUERIDO (no cambies los nombres de campo):
{
  "campaign_title": "string (título interno, máx 60 chars)",
  "slides": [
    { "id": "slide-1", "type": "cover", "headline": "string", "body": "string", "icon": "string (emoji)" },
    { "id": "slide-2", "type": "body",  "headline": "string", "body": "string", "icon": "string (emoji)" },
    { "id": "slide-3", "type": "body",  "headline": "string", "body": "string", "icon": "string (emoji)" },
    { "id": "slide-4", "type": "body",  "headline": "string", "body": "string", "icon": "string (emoji)" },
    { "id": "slide-5", "type": "body",  "headline": "string", "body": "string", "icon": "string (emoji)" },
    { "id": "slide-6", "type": "body",  "headline": "string", "body": "string", "icon": "string (emoji)" },
    { "id": "slide-7", "type": "cta",   "headline": "string", "body": "string", "icon": "string (emoji)" }
  ]
}`;
}

function buildUserPrompt(center: string, customData: string, adminData: Record<string, unknown>): string {
  const data = JSON.stringify(adminData, null, 2);

  const centerPrompts: Record<string, string> = {
    metrics: `Genera un carrusel sobre el ESTADO ACTUAL DE LA PLATAFORMA ValidateAI y el ecosistema de validación de startups en LatAm.
Usa estas métricas reales:
${data}
Ángulo: los datos de la plataforma revelan tendencias sorprendentes sobre cómo los fundadores validan sus ideas hoy.`,

    market_trends: `Genera un carrusel sobre las TENDENCIAS DE MERCADO detectadas en las validaciones de startups de LatAm.
Usa estos datos reales de industrias, países y etapas:
${data}
Ángulo: qué sectores e ideas están dominando el ecosistema emprendedor latinoamericano según datos reales.`,

    validation_patterns: `Genera un carrusel sobre los PATRONES DE VALIDACIÓN: qué diferencia las ideas de alto score de las que fallan.
Usa estos datos reales de scores, tasas de completación y embudos:
${data}
Ángulo: insights accionables que los founders pueden aplicar para mejorar sus probabilidades de éxito.`,

    ai_usage: `Genera un carrusel sobre cómo la INTELIGENCIA ARTIFICIAL está transformando la validación de startups.
Usa estos datos reales de uso de modelos, prompts y análisis:
${data}
Ángulo: cómo la IA está democratizando el acceso a análisis de nivel inversión para cualquier founder.`,

    custom: `Genera un carrusel sobre el siguiente tema:
"${customData || 'Ecosistema emprendedor en LatAm 2026'}"

Datos de contexto de la plataforma (úsalos como evidencia de respaldo):
${data}`,
  };

  return centerPrompts[center] ?? centerPrompts.custom;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      platform = 'linkedin',
      context: { center = 'metrics', frame = 'pas', customData = '', adminData = {} } = {},
    } = body as {
      platform: 'linkedin' | 'instagram';
      context: { center: string; frame: 'pas' | 'aida'; customData: string; adminData: Record<string, unknown> };
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
        system: buildSystemPrompt(platform, frame),
        messages: [{ role: 'user', content: buildUserPrompt(center, customData, adminData) }],
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

    if (!Array.isArray(parsed.slides) || parsed.slides.length < 7) {
      throw new Error('Estructura de respuesta inválida');
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
