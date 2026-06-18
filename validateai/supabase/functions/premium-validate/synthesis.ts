// Sintetizador AI (Claude Sonnet) del flujo premium, extraído de premium-validate
// (#T3.5 W4). Body byte-identical; ANTHROPIC_API_KEY relocada verbatim.
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

export interface ValidationContext {
  idea_name?:          string | null;
  idea_description?:   string | null;
  idea_problem?:       string | null;
  current_solution?:   string | null;
  customer_segment?:   string | null;
  target_country?:     string | null;
  business_model?:     string | null;
  traction_status?:    string | null;
  team_composition?:   string | null;
}

const SYNTHESIS_SYSTEM_PROMPT = `Eres un analista senior de Venture Capital con acceso a señales de mercado en tiempo real. Tu misión es redactar el “Executive Summary Investor-Ready” más preciso y accionable posible sobre la viabilidad de este negocio.

DIRECTRICES:
- Integra activamente las señales de Reddit y Google Trends con el contexto del negocio.
- Conecta el sentimiento de la comunidad con el dolor del cliente declarado.
- Cruza la tracción actual del equipo con la complejidad del mercado objetivo.
- Si los datos de mercado no están disponibles, indícalo con precisión y ajusta tu nivel de confianza.
- Sé directo, sin adulaciones. Señala fortalezas reales Y debilidades concretas.
- Máximo 1200 caracteres. Responde SOLO con el texto del resumen, sin títulos ni markdown.`;

export async function synthesize(
  ctx: ValidationContext,
  redditData: unknown | null,
  trendsData: unknown | null,
): Promise<string> {
  const userPrompt = `# CONTEXTO DEL NEGOCIO

IDEA: ${ctx.idea_name ?? 'Sin nombre'} — ${ctx.idea_description ?? 'Sin descripción'}
PROBLEMA DECLARADO: ${ctx.idea_problem ?? 'No especificado'}
SOLUCIÓN ACTUAL INCUMBENTES: ${ctx.current_solution ?? 'No especificado'}
SEGMENTO OBJETIVO (ICP): ${ctx.customer_segment ?? 'No especificado'}
PAÍS OBJETIVO: ${ctx.target_country ?? 'No especificado'}
MODELO DE NEGOCIO: ${ctx.business_model?.toUpperCase() ?? 'No especificado'}
TRACCIÓN ACTUAL: ${ctx.traction_status ?? 'No especificada'}
COMPOSICIÓN DEL EQUIPO: ${ctx.team_composition ?? 'No especificada'}

# SEÑALES DE MERCADO EN TIEMPO REAL

## Reddit Signal (sentimiento de comunidad emprendedora)
${redditData ? JSON.stringify(redditData, null, 2) : '(No disponible — credenciales de API no configuradas)'}

## Google Trends Signal (demanda de búsqueda, últimos 12 meses)
${trendsData ? JSON.stringify(trendsData, null, 2) : '(No disponible — SERPAPI_KEY no configurada)'}

Basándote en TODO el contexto anterior, redacta el Executive Summary investor-ready.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYNTHESIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`);
  }

  const result = await response.json();
  const text: string = result.content?.[0]?.text ?? '';
  return text.slice(0, 1200);
}
