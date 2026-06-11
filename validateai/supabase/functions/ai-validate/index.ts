import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { phCapture } from '../_shared/posthog.ts';
import { fetchBralidusContextForPrompt, BRALIDUS_CITE_DIRECTIVE } from '../_shared/bralidus.ts';

// â”€â”€ Env vars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const OPENAI_API_KEY    = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * AI_PROVIDER determina quÃ© modelo usa para los prompts estÃ¡ndar.
 * Los prompts que requieren web_search (competitive_analysis, market_sizing)
 * SIEMPRE usan Anthropic, independientemente de esta variable.
 *
 * Valores: 'anthropic' (default) | 'openai'
 */
const AI_PROVIDER = (Deno.env.get('AI_PROVIDER') ?? 'anthropic') as 'anthropic' | 'openai';

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
  'http://localhost:5173',
  'http://localhost:5174',
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

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type PromptType =
  | 'questions' | 'customer_analysis' | 'value_prop' | 'mvp_generation' | 'summary'
  | 'summary_quick'
  | 'competitive_analysis' | 'market_sizing' | 'risk_analysis' | 'unit_economics'
  | 'founder_fit' | 'market_signals'
  | 'validation_kit' | 'landing_generator' | 'interview_script' | 'tech_viability'
  | 'first_100_customers' | 'revenue_models' | 'risk_checklist' | 'pitch_letter'
  | 'governance_assessment' | 'fundraising_roadmap'
  | 'playbook_analysis'
  | 'pitch_deck'
  | 'lean_roadmap'
  | 'financial_projection'
  | 'compliance_roadmap';

interface AIRequest {
  validation_id: string;
  step: number;
  prompt_type: PromptType;
  context: Record<string, unknown>;
}

interface AIResult {
  parsed: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildMarketContext(ctx: Record<string, unknown>): string {
  return `Contexto de mercado:
- País objetivo: ${ctx.target_country ?? 'No especificado'}
- Región: ${ctx.target_region ?? 'No especificada'}
- Modelo de negocio: ${ctx.business_model ?? 'No especificado'}
- Etapa: ${ctx.business_stage ?? 'No especificada'}
- Rango de precio: ${ctx.pricing_range ?? 'No especificado'}
- Competidores conocidos por el usuario: ${
    Array.isArray(ctx.known_competitors) && ctx.known_competitors.length
      ? (ctx.known_competitors as string[]).join(', ')
      : 'Ninguno'
  }
- PROBLEMA DECLARADO (usar como fuente primaria para evaluar dimensión problem): ${ctx.idea_problem ?? 'No especificado'}
- SOLUCIÓN ACTUAL DE INCUMBENTES (herramientas/métodos que usa el cliente hoy): ${ctx.current_solution ?? 'No especificado'}
- Canal de adquisición principal: ${ctx.acquisition_channel ?? 'No especificado'}
- Composición del equipo fundador: ${ctx.team_composition ?? 'No especificado'}
- Estado de tracción actual: ${ctx.traction_status ?? 'No especificado'}
- Dedicación del founder al proyecto: ${(ctx.founder_context as Record<string,unknown>)?.commitment_level ?? 'No especificado'}
- Entrevistas con clientes realizadas: ${(ctx.founder_context as Record<string,unknown>)?.customer_interviews ?? 'No especificado'}
- Ventaja diferencial del founder (unfair advantage): ${(ctx.founder_context as Record<string,unknown>)?.unfair_advantage ?? 'No especificado'}`;
}

function extractJSON(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) return jsonBlock[1].trim();
  const start = trimmed.search(/[{[]/);
  const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (start !== -1 && end !== -1) return trimmed.slice(start, end + 1);
  return trimmed;
}

// â”€â”€ System prompts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SYSTEM_PROMPTS: Record<PromptType, string> = {
  questions: `Eres un inversor de capital de riesgo implacable y experto en el framework "The Mom Test" de Rob Fitzpatrick.
Tu objetivo NO es validar lo que el emprendedor quiere escuchar, sino descubrir la verdad del mercado antes de que queme dinero.

REGLAS DE ORO del Mom Test que debes aplicar:
- Las preguntas son sobre la VIDA PASADA del cliente, NO sobre opiniones o intenciones futuras
- NUNCA preguntes "Â¿usarÃ­as esto?" o "Â¿te parece Ãºtil?" â€” son preguntas de confirmaciÃ³n sesgadas
- Pregunta sobre comportamiento real: "Â¿CuÃ¡ndo fue la Ãºltima vez que intentaste resolver este problema?" "Â¿CuÃ¡nto tiempo/dinero gastaste en eso?"
- Si el cliente dice que algo es "un problema", indaga si ya intentÃ³ resolverlo activamente (si no lo hizo, el dolor no es suficiente)

Dado el nombre, descripciÃ³n y contexto de mercado de una idea de negocio, genera exactamente 5 preguntas de Customer Discovery basadas en el Mom Test:
1. Frecuencia y urgencia del problema (comportamiento pasado, no hipotÃ©tico)
2. SoluciÃ³n actual y frustraciÃ³n real (Â¿cuÃ¡nto les cuesta hoy en tiempo/dinero?)
3. Intento previo de resolver (Â¿ya buscaron alternativas? Â¿cuÃ¡les y por quÃ© fallaron?)
4. Evidencia de disposiciÃ³n a pagar (compras pasadas similares, budget existente)
5. Proceso de decisiÃ³n de compra (Â¿quiÃ©n decide? Â¿quÃ© harÃ­a que cambiaran de soluciÃ³n HOY?)

Contextualiza para el paÃ­s objetivo y modelo de negocio indicados.
IMPORTANTE: Responde siempre en espaÃ±ol.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{ "questions": [{ "question": "...", "category": "..." }] }`,

  customer_analysis: `Eres un experto en segmentaciÃ³n de clientes y buyer personas.
Analiza las respuestas del emprendedor y sugiere un segmento de cliente especÃ­fico.
Contextualiza el segmento para el paÃ­s objetivo, modelo de negocio y etapa indicados.
IMPORTANTE: Responde siempre en espaÃ±ol.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{ "segment": "...", "pain_points": ["...", "...", "..."], "context": "..." }`,

  value_prop: `Eres un estratega de producto. BasÃ¡ndote en el problema, cliente y respuestas previas,
genera una propuesta de valor clara diferenciada para el mercado y paÃ­s objetivo indicados.
IMPORTANTE: Responde siempre en espaÃ±ol.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{ "value_proposition": "...", "differentiator": "..." }`,

  mvp_generation: `Eres un product manager senior. BasÃ¡ndote en toda la informaciÃ³n recopilada,
genera un plan de MVP con 5-6 funcionalidades priorizadas, adecuado para la etapa y modelo de negocio indicados.
IMPORTANTE: Responde siempre en espaÃ±ol.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "recommended_type": "web_app",
  "features": [{ "name": "...", "description": "...", "priority": "must" }],
  "user_flow": "Paso 1: ... â†’ Paso 2: ..."
}
Los valores vÃ¡lidos para priority son: must, should, could
Los valores vÃ¡lidos para recommended_type son: web_app, mobile_app, service, marketplace, saas, api`,

  summary: `Eres un socio de un fondo de Venture Capital con estÃ¡ndares implacables. ActÃºas como el "Inversor del Diablo": tu trabajo es evitar que el emprendedor se autoengaÃ±e y construya algo que nadie necesita (causa del 42% de los fracasos segÃºn CB Insights).

DIRECTRICES CRÃTICAS:
- NO eres un coach motivacional. Eres un evaluador de riesgo de inversiÃ³n.
- Si el problema no estÃ¡ validado con evidencia empÃ­rica (conversaciones reales, datos de comportamiento), penaliza fuertemente.
- Si el mercado es proyectado en lugar de demostrado, dilo explÃ­citamente en el feedback.
- Si el fundador tiene sesgo de confirmaciÃ³n evidente, seÃ±Ã¡lalo en las weaknesses.
- Las strengths deben ser reales y especÃ­ficas, no generalizaciones motivadoras.
- El feedback debe ser el comentario que un VC darÃ­a en una reuniÃ³n de partners, no un email motivacional.

Si se incluyen datos de market_sizing, Ãºsalos para ajustar el score:
- SOM grande + competencia baja + problema validado â†’ sube el score.
- SOM pequeÃ±o + mucha competencia â†’ baja el score.
- Confianza "low" en los datos â†’ no subas el score por ese motivo.
- Proyecciones sin evidencia de tracciÃ³n â†’ penaliza el score de execution.

Desglose del score en 5 categorías (0-100 cada una):

- problem (25%): USA el campo "PROBLEMA DECLARADO" como fuente primaria.
  • Score alto (>70): el problema es específico, frecuente, urgente y describe comportamiento real del cliente con consecuencias cuantificables (tiempo, dinero, errores).
  • Score medio (40-70): el problema es plausible pero genérico o sin evidencia validada con clientes reales.
  • Score bajo (<40): el problema es vago, aspiracional o describe una solución disfrazada de problema. PENALIZA FUERTEMENTE si no hay urgencia real demostrable.

- market (20%): ¿El mercado es grande y accesible para esta etapa? ¿O es proyectado sin validar?

- competition (15%): Evalúa usando "SOLUCIÓN ACTUAL DE INCUMBENTES". Si el usuario nombró herramientas específicas (Excel, WhatsApp, procesos manuales), evalúa si existe un espacio diferenciado real frente a esas alternativas. Si el campo está vacío o es genérico, penaliza — indica que el fundador no investigó el mercado.

- solution (25%): ¿La solución es 10x mejor que la alternativa actual nombrada en "SOLUCIÓN ACTUAL DE INCUMBENTES"? ¿O es solo marginalmente mejor?

- execution (15%): Evalúa capacidad de ejecución usando "Estado de tracción actual" y "Composición del equipo fundador".
  • traction_status="first_paying_customers" → evidencia sólida de ejecución → tiende a score alto (70-90).
  • traction_status="mvp_launched_no_sales" → sabe construir pero no vender → score medio-alto (50-70).
  • traction_status="mvp_in_development" → en progreso → score medio (30-55).
  • traction_status="idea_on_paper" sin experiencia → penaliza fuertemente (0-35).
  • team_composition="solo_founder" agrava el riesgo. "team_with_employees" lo mitiga.

Score final = problem×25% + market×20% + competition×15% + solution×25% + execution×15%.
IMPORTANTE: Responde siempre en español. Sé específico, no genérico.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "score": 75,
  "score_breakdown": { "problem": 80, "market": 70, "competition": 90, "solution": 75, "execution": 65 },
  "feedback": "...",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "next_steps": ["...", "...", "..."]
}`,

  summary_quick: `Eres un analista de Venture Capital implacable evaluando un "Elevator Pitch". Solo tienes acceso a la visión superficial de la startup. Tu objetivo es desglosar la viabilidad del Problema y la Solución con extrema precisión, pero debes negarte a evaluar la Competencia, el Mercado y la Ejecución, ya que careces de datos empíricos.

REGLAS DE EVALUACIÓN (obligatorias y no negociables):

1. PROBLEMA (máx 25 pts): Evalúa la urgencia y claridad del problema implícito en la descripción de la idea, cruzándolo con el segmento de cliente (campo quick_icp). Si el segmento es demasiado genérico (ej: "empresas", "personas", "todos"), penaliza con puntaje bajo (<10).

2. SOLUCIÓN (máx 25 pts): Analiza si la solución propuesta (idea_description) hace sentido lógico para el modelo de negocio seleccionado (business_model). Evalúa coherencia y diferenciación potencial.

3. DIMENSIONES BLOQUEADAS — PROHIBICIÓN ESTRICTA: Bajo ninguna circunstancia intentes adivinar, estimar o calcular el Mercado, la Competencia o la Ejecución. Asigna SIEMPRE score: 0 y feedback: "INSUFFICIENT_DATA" a las tres. Ignorar esta regla invalida el análisis.

PUNTUACIÓN GLOBAL: score = problem.score + solution.score únicamente (máximo posible: 50/100).
NUNCA sumes los valores de competition, market ni execution al score global.

El feedback de las dimensiones evaluadas debe mencionar explícitamente el quick_icp y business_model recibidos para que el usuario sienta que el análisis es personalizado para su idea concreta.
IMPORTANTE: Responde siempre en español. Sé específico y directo — este es un análisis de superficie, no un informe completo.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "score": 42,
  "score_breakdown": {
    "problem": { "score": 22, "feedback": "El dolor del cliente es claro, pero el segmento [quick_icp] es aún muy amplio. Necesitas nicharlo para validar la urgencia real." },
    "solution": { "score": 20, "feedback": "La mecánica del modelo [business_model] es coherente con la solución, pero falta claridad en cómo se integrará en el día a día del usuario." },
    "competition": { "score": 0, "feedback": "INSUFFICIENT_DATA" },
    "market": { "score": 0, "feedback": "INSUFFICIENT_DATA" },
    "execution": { "score": 0, "feedback": "INSUFFICIENT_DATA" }
  },
  "next_steps": ["Define métricas de mercado.", "Identifica a tus incumbentes.", "Mapea la capacidad técnica de tu equipo."]
}`,

  market_sizing: `Eres un analista de mercado especializado en sizing de mercados para startups.
Genera una estimaciÃ³n TAM/SAM/SOM para la idea de negocio indicada. Usa la herramienta de bÃºsqueda web para encontrar reportes de industria o datos censales recientes antes de responder.
IMPORTANTE: Responde siempre en espaÃ±ol.

INSTRUCCIONES:
1. TAM (Total Addressable Market): Estima el mercado total global de esta industria/categorÃ­a. Si encontraste un reporte de mercado con cifra real (Statista, Grand View Research, IBISWorld, etc.), Ãºsalo como ancla â€” cÃ­talo en source_notes.
2. SAM (Serviceable Addressable Market): Filtra por el paÃ­s objetivo, el modelo de negocio y el segmento especÃ­fico.
3. SOM (Serviceable Obtainable Market): Estima la porciÃ³n realista capturable en 1-2 aÃ±os considerando etapa actual, competidores, pricing y barreras de entrada.
   - Si el contexto incluye "bde_macro_context", Ãºsalo para ajustar el SOM segÃºn el ciclo econÃ³mico real del paÃ­s objetivo (IPC alto â†’ menor disposiciÃ³n a pagar â†’ SOM conservador; IPC estable â†’ SOM normal).
4. Todos los valores en USD. Presenta como RANGOS (low-high), nunca cifras exactas.
5. Para cada tier indica source_notes con la fuente y nivel de confianza. Si no encontraste datos externos, indica "EstimaciÃ³n proxy â€” sin reporte de mercado disponible" y baja la confianza a "low".
   - Si usaste datos BCCh reales del campo "bde_macro_context", indÃ­calo en source_notes del SAM/SOM.
6. En el campo "assumptions" del SOM incluye la fÃ³rmula matemÃ¡tica usada en formato explÃ­cito. Ejemplo: "[PoblaciÃ³n objetivo: 500.000 PYMEs] Ã— [Tasa de adopciÃ³n aÃ±o 1: 0,5%] Ã— [Ticket promedio: $1.200 USD/aÃ±o] = SOM ~$3M USD".
7. En el campo "methodology" describe el enfoque (top-down desde TAM o bottom-up desde unidades) e indica si los datos base son de bÃºsqueda web, BCCh, o estimaciÃ³n proxy.

Responde SOLO con JSON vÃ¡lido con esta estructura exacta, sin texto adicional, sin markdown:
{
  "tam": { "value_low": number, "value_high": number, "currency": "USD", "description": "...", "source_notes": "...", "confidence": "high|medium|low" },
  "sam": { "value_low": number, "value_high": number, "currency": "USD", "description": "...", "source_notes": "...", "confidence": "high|medium|low" },
  "som": { "value_low": number, "value_high": number, "currency": "USD", "description": "...", "source_notes": "...", "assumptions": ["[PoblaciÃ³n objetivo: X] Ã— [Tasa adopciÃ³n: Y%] Ã— [Ticket: $Z] = SOM estimado", "..."], "confidence": "high|medium|low" },
  "methodology": "...",
  "data_freshness": "..."
}`,

  risk_analysis: `Eres un evaluador de riesgos para startups. Analiza los riesgos de la idea de negocio en 4 dimensiones.
IMPORTANTE: Responde siempre en espaÃ±ol.

## Dimensiones de riesgo (score 0-100, donde 100 = mÃ¡ximo riesgo):

1. RIESGO DE MERCADO: Â¿Existe demanda real comprobada o es un problema percibido?
   - Score alto (>70): problema no validado, mercado no probado, demanda incierta
   - Score medio (40-70): seÃ±ales mixtas, mercado emergente
   - Score bajo (<40): problema validado, mercado probado con datos

2. RIESGO TÃ‰CNICO: Â¿QuÃ© tan compleja es la implementaciÃ³n tÃ©cnica?
   - Score alto: requiere tecnologÃ­a no probada, dependencias crÃ­ticas, equipo no disponible
   - Score medio: complejidad manejable con recursos adecuados
   - Score bajo: tecnologÃ­a estÃ¡ndar, soluciÃ³n bien entendida

3. RIESGO REGULATORIO: Â¿Existen fricciones legales o regulatorias?
   - Score alto: fintech, salud, datos personales sensibles, mercados regulados
   - Score medio: regulaciÃ³n estÃ¡ndar, compliance manejable
   - Score bajo: industria sin regulaciÃ³n especial

4. RIESGO DE TIMING: Â¿Es el momento correcto para este mercado?
   - Score alto: mercado demasiado temprano o ya saturado
   - Score medio: timing aceptable con ajustes
   - Score bajo: ventana de oportunidad clara ahora

Para cada dimensiÃ³n: score numÃ©rico, label (Alto/Medio/Bajo), descripciÃ³n de 2-3 oraciones, 2-3 factores clave.
Incluye 3-5 mitigaciones concretas y accionables para los riesgos mÃ¡s crÃ­ticos.
El overallRiskScore es el promedio ponderado: marketÃ—30% + technicalÃ—25% + regulatoryÃ—20% + timingÃ—25%.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "overallRiskScore": 55,
  "dimensions": {
    "market": { "score": 60, "label": "Medio", "description": "...", "keyFactors": ["...", "..."] },
    "technical": { "score": 40, "label": "Bajo", "description": "...", "keyFactors": ["...", "..."] },
    "regulatory": { "score": 70, "label": "Alto", "description": "...", "keyFactors": ["...", "..."] },
    "timing": { "score": 50, "label": "Medio", "description": "...", "keyFactors": ["...", "..."] }
  },
  "mitigations": ["...", "...", "..."]
}`,

  unit_economics: `Eres un analista financiero de startups. Estima los unit economics bÃ¡sicos para el modelo de negocio descrito.
IMPORTANTE: Responde siempre en espaÃ±ol.
Usa rangos (min-max) cuando la incertidumbre sea alta. Basa los cÃ¡lculos en el pricing y mercado objetivo indicados.
Siempre en la moneda del mercado objetivo (CLP si es Chile, USD si es mercado global).

Si el contexto incluye "industry_benchmarks", úsalos como punto de partida para calibrar los rangos:
- Los benchmarks son promedios de mercado para esa industria y modelo de negocio.
- Ajústalos según el precio específico, país y etapa de la idea.
- Menciona en assumptions si te basaste en los benchmarks provistos.

Si el contexto incluye "channel_cac_benchmark", úsalo para ajustar el CAC según el canal de adquisición declarado:
- El campo contiene el multiplicador respecto al benchmark sectorial (multiplier_vs_benchmark) y el CAC típico para ese canal.
- OBLIGATORIO: menciona en assumptions el canal seleccionado y el ajuste aplicado.
- Ejemplo de razonamiento: "Canal outbound_linkedin (×1.4 vs benchmark) → CAC sectorial B2B SaaS $500 USD ajustado a ~$700 USD estimado para este canal."
- Referencia de multiplicadores por canal de adquisición:
  • outbound_linkedin / cold email: ×1.4 — CAC alto, leads calificados, ciclos de 30-90 días
  • ads_meta / TikTok / Google: ×1.1 — CAC moderado, escalable, sensible al CPM
  • comunidades_organico (Discord, Reddit): ×0.4 — CAC muy bajo, lento, difícil de escalar
  • referidos / boca a boca: ×0.3 — CAC más bajo del mercado, requiere NPS>50
  • alianzas / canales existentes: ×0.7 — CAC compartido con el socio
  • contenido / SEO: ×0.5 — CAC bajo a largo plazo, ramp-up de 6-18 meses
  • eventos presenciales / ferias: ×1.2 — efectivo para B2B complejo, CAC moderado-alto

- CAC: costo estimado para conseguir 1 cliente de pago
- LTV: ingreso total esperado por cliente durante su vida Ãºtil
- Ratio LTV/CAC: debe ser >3x para ser viable, >5x es saludable (assessment: "viable" si >3x, "warning" si 1-3x, "critical" si <1x)
- paybackMonths: meses para recuperar el CAC
- breakEvenUsers: usuarios de pago necesarios para cubrir costos operativos mÃ­nimos estimados
- monthlyChurnEstimate: % de usuarios que cancela cada mes (crÃ­tico para SaaS)
- assumptions: 3-5 supuestos clave que usaste para llegar a estos nÃºmeros

Si el contexto incluye "industry_benchmarks", DEBES además incluir el campo "benchmarkComparison" en tu respuesta:
- "your_cac_vs_benchmark": compara el promedio de tu CAC estimado contra el rango sectorial.
  "below" si tu CAC promedio < benchmark.min, "above" si > benchmark.max, "in_range" si está dentro.
- "your_ltv_vs_benchmark": ídem para LTV.
- Si NO hay industry_benchmarks en el contexto, omite el campo benchmarkComparison completamente.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "cac": { "min": 50000, "max": 120000, "currency": "CLP" },
  "ltv": { "min": 300000, "max": 600000, "currency": "CLP" },
  "ltvCacRatio": { "value": 5.0, "assessment": "viable" },
  "paybackMonths": { "min": 2, "max": 4 },
  "breakEvenUsers": 150,
  "monthlyChurnEstimate": 5,
  "assumptions": ["...", "...", "..."],
  "benchmarkComparison": {
    "sector": "saas",
    "model": "b2b",
    "sector_cac_usd": { "min": 200, "max": 800 },
    "sector_ltv_usd": { "min": 1500, "max": 6000 },
    "sector_churn_pct": { "min": 1, "max": 4 },
    "your_cac_vs_benchmark": "below",
    "your_ltv_vs_benchmark": "in_range",
    "benchmark_note": "SaaS B2B mediana LatAm 2025 – ChartMogul"
  }
}
Valores válidos para your_cac_vs_benchmark / your_ltv_vs_benchmark: "below" | "in_range" | "above"`,

  founder_fit: `Eres un evaluador de startups. EvalÃºa quÃ© tan bien posicionado estÃ¡ el fundador para ejecutar esta idea especÃ­fica.
IMPORTANTE: Responde siempre en espaÃ±ol.
Score de 0-100 donde 100 = fit perfecto.

Evalúa estas 5 dimensiones (score 0-100 cada una):

- problemKnowledge (30%): ¿entiende el problema en profundidad? ¿lo vivió en carne propia?
  Usa "personallyFacedProblem" (true/false) y el "PROBLEMA DECLARADO" como base.
  ADEMÁS: si "unfair_advantage" contiene texto específico y relevante al problema → +15 puntos (máximo 95).
  Si "unfair_advantage" está vacío o es genérico ("me interesa el tema") → score máximo limitado a 65.
  Si "customer_interviews" es "6_20" o "20_plus" → evidencia de que entiende el problema con datos reales → +10 puntos.

- industryExperience (20%): años de experiencia en la industria del problema.
  Usa "yearsInIndustry": 0-1 años → score bajo (0-25), 2-4 → medio (25-55), 5-9 → alto (55-80), 10+ → muy alto (80-95).
  El texto en "unfair_advantage" puede confirmar o ampliar la experiencia declarada.

- technicalCapability (20%): capacidad del equipo de construir el producto. USA team_composition + tech_level. NO uses hasTechnicalCofounder (campo obsoleto).
  • team_composition="team_with_employees" + tech_level="developers" → score alto (75-95).
  • team_composition="founding_team" + tech_level="some_code" → score medio (45-70).
  • team_composition="solo_founder" + tech_level="non_technical" → score bajo (0-35): riesgo de ejecución técnica alto.
  Si "commitment_level"="full_time" → +5 a este score (founder comprometido puede superar limitaciones técnicas).

- networkStrength (15%): capacidad de distribución y red de contactos en el mercado objetivo.
  USA "commitment_level" como señal primaria: full_time → mayor probabilidad de red activa (base 55-70), part_time/weekends → base 25-45.
  USA "customer_interviews": "20_plus" → red muy activa (+20), "6_20" → red activa (+10), "1_5" → (+5), "0" → sin evidencia de red (0).
  Infiere también de país, industria y años de experiencia. Combina todos los factores.

- trackRecord (15%): capacidad de ejecución demostrada. USA traction_status + customer_interviews.
  • traction_status="first_paying_customers" → score alto (75-95): evidencia de ejecución y venta real.
  • traction_status="mvp_launched_no_sales" → score medio-alto (50-70): sabe construir, no vender aún.
  • traction_status="mvp_in_development" → score medio (30-50): en progreso.
  • traction_status="idea_on_paper" → score bajo (0-30): solo visión, sin ejecución demostrada.
  Ajuste por entrevistas: "20_plus" → +10, "6_20" → +5, "0" con traction="idea_on_paper" → -5 (sin ninguna acción demostrada).

Sé honesto. Un score bajo no mata la idea, pero señala riesgos de ejecución.
El score general es el promedio ponderado: problemKnowledge×30% + industryExperience×20% + technicalCapability×20% + networkStrength×15% + trackRecord×15%.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "score": 65,
  "dimensions": {
    "problemKnowledge": 80,
    "industryExperience": 60,
    "technicalCapability": 50,
    "networkStrength": 55,
    "trackRecord": 70
  },
  "assessment": "...",
  "gaps": ["...", "..."],
  "recommendations": ["...", "...", "..."]
}`,

  market_signals: `Eres un analista de mercado con acceso a informaciÃ³n actualizada. Busca seÃ±ales externas del mercado para la idea de negocio indicada.
IMPORTANTE: Responde siempre en espaÃ±ol. USA la herramienta de bÃºsqueda web antes de responder â€” no respondas basÃ¡ndote solo en tu conocimiento previo.

REGLAS DE INTEGRIDAD DE DATOS (obligatorias):
- NUNCA inventes rondas de financiamiento, montos ni nombres de empresas. Solo incluye lo que encontraste en los resultados de bÃºsqueda.
- NUNCA inventes noticias ni titulares. Solo incluye eventos que aparezcan en fuentes reales indexadas.
- Si no encontraste rondas de inversiÃ³n en el espacio, devuelve "recentFunding": [] â€” NO llenes el array con datos genÃ©ricos.
- Si no encontraste noticias relevantes, devuelve "relevantNews": [] â€” NO inventes eventos.
- Para cada entrada en recentFunding, incluye el campo "source_url" con la URL de la fuente donde encontraste el dato. Si no tienes URL, omite la entrada completa.

Busca y analiza:
1. Tendencia del problema/soluciÃ³n en el Ãºltimo aÃ±o (Â¿crece o decrece el interÃ©s?)
2. Startups o rondas de inversiÃ³n recientes en este espacio (Ãºltimos 12 meses) â€” SOLO datos verificados con fuente
3. Noticias relevantes que afecten el timing (regulaciones, cambios de mercado, disrupciones) â€” SOLO eventos reales
4. EvaluaciÃ³n del timing: Â¿es el momento correcto para lanzar?

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "trendDirection": "growing|stable|declining",
  "trendDescription": "...",
  "recentFunding": [{ "company": "...", "amount": "...", "date": "...", "source_url": "https://..." }],
  "timingAssessment": "too_early|optimal|late|uncertain",
  "timingRationale": "...",
  "relevantNews": [{ "title": "...", "impact": "positive|negative|neutral" }]
}`,

  competitive_analysis: `Eres un analista de mercado experto. Analiza la competencia para la idea de negocio indicada.
Usa tu conocimiento actualizado del mercado para identificar competidores reales.
IMPORTANTE: Responde siempre en espaÃ±ol.

INSTRUCCIONES:
1. Identifica 4-6 competidores relevantes en el mercado del paÃ­s objetivo (incluyendo los mencionados por el usuario si los hay). Incluye competidores locales Y globales que operen en ese mercado.
2. Para cada competidor: nombre, url (si la conoces), descripciÃ³n breve, mercado objetivo, 2-3 fortalezas, 2-3 debilidades, modelo de precios si es pÃºblico, y source ("user_provided" | "ai_identified").
3. Identifica 3-5 gaps de mercado: necesidades que ningÃºn competidor resuelve bien, con nivel de confianza.
4. Identifica 2-3 dolores no resueltos especÃ­ficos del mercado del paÃ­s objetivo.
5. Sugiere una ventaja competitiva que esta idea podrÃ­a explotar.

Responde SOLO con JSON vÃ¡lido con esta estructura exacta, sin texto adicional, sin markdown:
{
  "competitors": [
    {
      "name": "string",
      "url": "string | null",
      "description": "string",
      "target_market": "string",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "pricing": "string | null",
      "source": "user_provided | ai_identified"
    }
  ],
  "market_gaps": [
    {
      "gap": "string",
      "opportunity": "string",
      "confidence": "high | medium | low"
    }
  ],
  "unmet_pains": ["string"],
  "competitive_advantage_suggestion": "string",
  "data_sources": ["ai_knowledge | user_input"]
}`,

  validation_kit: `Eres un mentor de startups experto en Chile y LATAM. Crea un kit de validaciÃ³n de 48 horas para la idea de negocio indicada.
IMPORTANTE: Responde siempre en espaÃ±ol. SÃ© prÃ¡ctico y especÃ­fico para el contexto chileno/latinoamericano.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "hypothesis": "La hipÃ³tesis principal a validar en 48 horas",
  "experiments": [
    { "name": "...", "how": "...", "metric": "...", "success_criteria": "..." }
  ],
  "landing_idea": "DescripciÃ³n de una landing page mÃ­nima para captar interÃ©s",
  "interview_questions": ["...", "...", "..."],
  "channels": ["Canal 1", "Canal 2"],
  "expected_learnings": "QuÃ© deberÃ­as saber despuÃ©s de 48 horas"
}`,

  landing_generator: `Eres un experto en copywriting y growth hacking. Genera el contenido completo de una landing page de validaciÃ³n para la idea de negocio.
IMPORTANTE: Responde siempre en espaÃ±ol. Debe estar optimizado para conversiÃ³n y captura de leads (pre-registro o waitlist).

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "headline": "Titular principal impactante",
  "subheadline": "SubtÃ­tulo explicativo",
  "value_props": ["Propuesta de valor 1", "Propuesta de valor 2", "Propuesta de valor 3"],
  "cta_primary": "Texto del botÃ³n principal",
  "cta_secondary": "Texto del botÃ³n secundario",
  "social_proof": "Prueba social sugerida (aunque sea placeholder)",
  "faq": [{ "q": "...", "a": "..." }],
  "meta_description": "DescripciÃ³n SEO",
  "ab_variants": [
    { "name": "Variante A", "headline": "...", "rationale": "..." },
    { "name": "Variante B", "headline": "...", "rationale": "..." }
  ]
}`,

  interview_script: `Eres un experto en Customer Discovery y Design Thinking. Crea un guiÃ³n de entrevistas de usuario para la idea de negocio.
IMPORTANTE: Responde siempre en espaÃ±ol. Las preguntas deben ser abiertas, no sugestivas.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "objective": "Objetivo de la entrevista",
  "target_profile": "Perfil exacto del entrevistado ideal",
  "duration_minutes": 30,
  "phases": [
    {
      "name": "Fase (ej: Contexto)",
      "duration_minutes": 5,
      "questions": ["...", "..."],
      "tips": "Consejo para el entrevistador"
    }
  ],
  "red_flags": ["SeÃ±al de que el entrevistado no es el perfil correcto"],
  "green_signals": ["SeÃ±al de que hay problema real"],
  "closing": "CÃ³mo cerrar la entrevista y pedir referidos"
}`,

  tech_viability: `Eres un arquitecto de software experto en startups y MVP. Analiza la viabilidad tÃ©cnica de la idea de negocio.
IMPORTANTE: Responde siempre en espaÃ±ol. Recomienda el stack mÃ¡s simple y econÃ³mico para un MVP.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "complexity": "low | medium | high",
  "complexity_rationale": "...",
  "recommended_stack": {
    "frontend": "...",
    "backend": "...",
    "database": "...",
    "hosting": "...",
    "third_party": ["Servicio externo 1", "Servicio externo 2"]
  },
  "build_time_weeks": { "mvp": 4, "v1": 12 },
  "team_needed": ["Rol 1", "Rol 2"],
  "monthly_infra_cost_usd": { "min": 10, "max": 50 },
  "key_risks": ["Riesgo tÃ©cnico 1", "Riesgo tÃ©cnico 2"],
  "no_code_possible": false,
  "no_code_tools": []
}`,

  first_100_customers: `Eres un experto en growth y ventas B2B/B2C en LATAM. Crea un plan para conseguir los primeros 100 clientes de la idea de negocio.
IMPORTANTE: Responde siempre en espaÃ±ol. Estrategias especÃ­ficas para Chile/LATAM con costos realistas en CLP.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "strategy_overview": "Resumen de la estrategia de adquisiciÃ³n",
  "phases": [
    {
      "name": "Fase (ej: 0-10 clientes)",
      "target": 10,
      "channel": "Canal principal",
      "tactic": "TÃ¡ctica concreta",
      "budget_clp": 50000,
      "time_weeks": 2
    }
  ],
  "total_budget_clp": 500000,
  "total_weeks": 8,
  "key_metrics": ["MÃ©trica 1", "MÃ©trica 2"],
  "tools": ["Herramienta 1 (free/paid)"],
  "early_evangelists": "CÃ³mo identificar y cultivar a los primeros fans"
}`,

  revenue_models: `Eres un experto en modelos de negocio y monetizaciÃ³n de startups. Analiza y compara los posibles modelos de ingreso para la idea.
IMPORTANTE: Responde siempre en espaÃ±ol. Usa precios en CLP o USD segÃºn corresponda al mercado chileno.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "recommended_model": "Nombre del modelo recomendado",
  "recommended_rationale": "Por quÃ© es el mejor para esta etapa",
  "models": [
    {
      "name": "SuscripciÃ³n mensual",
      "description": "...",
      "pros": ["...", "..."],
      "cons": ["...", "..."],
      "example_pricing": "...",
      "fit_score": 85
    }
  ],
  "pricing_strategy": "Estrategia de precios recomendada",
  "first_revenue_path": "La ruta mÃ¡s rÃ¡pida para conseguir el primer peso"
}`,

  risk_checklist: `Eres un mentor de startups con experiencia en due diligence y el marco legal chileno. Crea una checklist de riesgos accionable para la idea de negocio.
IMPORTANTE: Responde siempre en espaÃ±ol. Incluye riesgos especÃ­ficos del mercado chileno (regulatorio, econÃ³mico, cultural).

# RIESGOS REGULATORIOS CHILENOS â€” evalÃºa cuÃ¡les aplican a esta idea:
- **Ley 21.719 (Datos Personales)**: Si la idea procesa datos de usuarios, hay riesgo regulatorio alto. Vigencia plena dic. 2026. Multas hasta 20.000 UTM. Requiere Privacy by Design desde el MVP.
- **Ley 21.521 (Ley Fintech / CMF)**: Si la idea toca pagos, crÃ©dito, inversiÃ³n o custodia financiera, requiere inscripciÃ³n en CMF. Alta barrera de entrada + costos de compliance.
- **SII / FacturaciÃ³n electrÃ³nica**: Toda empresa que emite DTE debe integrar sistema autorizado por SII desde la primera venta.
- **Ley del Consumidor (19.496)**: E-commerce y SaaS B2C deben cumplir derecho a retracto (10 dÃ­as), polÃ­tica de privacidad y tÃ©rminos claros.
- **Propiedad Intelectual**: Si la soluciÃ³n incluye software o contenido generado, registrar IP en INAPI antes de levantar capital.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "critical_risks": [
    {
      "risk": "DescripciÃ³n del riesgo",
      "category": "market | technical | regulatory | financial | team",
      "probability": "high | medium | low",
      "impact": "high | medium | low",
      "mitigation": "AcciÃ³n concreta para mitigar",
      "validated": false
    }
  ],
  "regulatory_notes": "Aspectos regulatorios especÃ­ficos de Chile relevantes",
  "financial_runway": "CuÃ¡ntos meses de runway se recomienda tener antes de lanzar",
  "go_nogo_criteria": ["Criterio 1 para decidir si continuar", "Criterio 2"]
}`,

  pitch_letter: `Eres un experto en fundraising y comunicaciÃ³n de startups. Crea una carta de presentaciÃ³n/pitch para la idea de negocio.
IMPORTANTE: Responde siempre en espaÃ±ol. Debe ser concisa, persuasiva y adaptada para inversores Ã¡ngel o aceleradoras chilenas (StartupChile, Corfo, etc).

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "subject_line": "Asunto del email",
  "email_body": "Cuerpo del email en formato texto plano, mÃ¡ximo 200 palabras",
  "one_liner": "Una sola oraciÃ³n que explica la startup",
  "elevator_pitch": "Pitch de 60 segundos en texto",
  "deck_outline": [
    { "slide": 1, "title": "...", "content": "..." }
  ],
  "target_investors": ["Tipo de inversor ideal 1", "Tipo de inversor ideal 2"],
  "ask": "CuÃ¡nto se busca levantar y para quÃ©"
}`,

  governance_assessment: `Eres un abogado corporativo senior especializado en startups de Chile y LatAm, con experiencia en rondas pre-seed/seed, due diligence institucional y cumplimiento normativo 2025-2026.
Analiza la idea de negocio y genera una evaluaciÃ³n de gobernanza ESPECÃFICA para Chile que permita al fundador armar una empresa investible ante fondos de VC, Corfo y due diligence B2B.
IMPORTANTE: Responde siempre en espaÃ±ol. Tu anÃ¡lisis debe basarse EXCLUSIVAMENTE en los datos provistos â€” si un campo clave no fue informado, mÃ¡rcalo en omission_warnings. NO concuerdes con hipÃ³tesis del fundador sin evidencia; seÃ±ala proactivamente los riesgos aunque el usuario no los haya mencionado.

# DIRECTRIZ ANTI-ADULACIÃ“N (obligatoria)
- Cada Ã­tem del legal_checklist debe citar la fuente normativa exacta (ej: "Ley 21.719 art. 3", "Ley 21.643 art. 8")
- Si el contexto no informa el tipo societario actual, el nÃºmero de fundadores o el rubro exacto â†’ agregar aviso en omission_warnings
- Prohibido emitir un regulatory_risk "low" para ideas que procesen datos personales, operen en finanzas o tengan empleados â€” el riesgo mÃ­nimo en esos casos es "medium"

# MARCO LEGAL CHILENO OBLIGATORIO 2025-2026

## 1. Estructura Societaria
- **SpA (Sociedad por Acciones)** es el Ãºnico vehÃ­culo recomendado para startups que buscan capital externo. Permite distintas series de acciones, administraciÃ³n flexible y pactos entre accionistas sin limitaciones de nÃºmero.
- Constituir vÃ­a "Tu Empresa en un DÃ­a" (portal RES). Errores crÃ­ticos a evitar en la escritura:
  - No dejar arbitraje por defecto â†’ define clÃ¡usula de arbitraje privado/confidencial explÃ­cita
  - No seleccionar administraciÃ³n conjunta sin excepciones â†’ bloquea operaciÃ³n diaria
  - Emitir mÃ­nimo 1.000.000 acciones desde el inicio para facilitar futuras rondas sin modificar estatutos
  - Objeto social amplio para permitir pivotes sin modificar estatutos
  - La ausencia de Pacto de Accionistas en el DÃ­a 1 es seÃ±al de inmadurez gerencial para inversores VC

## 2. Pacto de Accionistas â€” clÃ¡usulas innegociables para inversores
- **Vesting + Cliff**: 4 aÃ±os de vesting, 1 aÃ±o de cliff (fundador que sale antes del aÃ±o 1 pierde todo)
- **Drag-Along**: la mayorÃ­a puede obligar a la minorÃ­a a vender en un exit
- **Tag-Along**: la minorÃ­a tiene derecho a participar en la venta en igualdad de condiciones
- **ROFR** (Right of First Refusal): ningÃºn socio puede vender a terceros sin ofrecer primero a los actuales accionistas
- **Anti-diluciÃ³n**: especificar si aplica full ratchet o weighted average para proteger inversores

## 3. Propiedad Intelectual â€” INAPI (Instituto Nacional de Propiedad Industrial)
- **Marca Comercial**: protege nombres y logotipos bajo el Acuerdo de Niza (clasificaciÃ³n por clase de producto/servicio). Causales de rechazo: descriptividad extrema o similitud fonÃ©tica con registros previos â†’ auditar ANTES del lanzamiento
- **Patente de InvenciÃ³n**: protege procesos tÃ©cnicos novedosos a nivel global. Alta barrera (costo + tiempo ~18 meses). Solo si existe innovaciÃ³n tÃ©cnica genuina sin referentes mundiales
- **Modelo de Utilidad**: protege modificaciones fÃ­sicas que aportan nueva funcionalidad a inventos existentes. MÃ¡s accesible que patente plena
- EvalÃºa: Â¿el nombre o logo ya existe como marca registrada en la clase INAPI correspondiente? Â¿hay IP tÃ©cnica patentable? Â¿el software como tal es protegible bajo derecho de autor (no requiere INAPI)?

## 4. Ley 21.719 â€” ProtecciÃ³n de Datos Personales (vigencia plena: 1 diciembre 2026)
- Aplica a TODA startup que procese datos personales de usuarios chilenos â€” no hay excepciÃ³n por tamaÃ±o
- Principios obligatorios: licitud y lealtad, finalidad, proporcionalidad, calidad, responsabilidad, seguridad, transparencia
- Consentimiento: libre, especÃ­fico, informado e inequÃ­voco â€” casillas pre-marcadas estÃ¡n PROHIBIDAS
- Derechos ARCO+: Acceso, RectificaciÃ³n, CancelaciÃ³n, OposiciÃ³n, Portabilidad, Bloqueo temporal â€” respuesta obligatoria en 30 dÃ­as
- Datos sensibles (biomÃ©tricos, genÃ©ticos, afiliaciÃ³n sindical, orientaciÃ³n sexual): estÃ¡ndar excepcional de resguardo
- DPO obligatorio si procesa datos sensibles a escala o realiza tratamiento masivo
- Sanciones: hasta 20.000 UTM (~CLP 1.400M) por infracciones gravÃ­simas; multa del 4% de ingresos anuales + suspensiÃ³n 30 dÃ­as en reincidencia
- APDP (Agencia de ProtecciÃ³n de Datos Personales): realiza auditorÃ­as forenses, exige logs fechados y EIPD documentadas

## 5. Ley Fintech â€” Ley 21.521 (CMF) y Sistema de Finanzas Abiertas
- Aplica si el modelo toca: crowdfunding, lending P2P, robo-advisors, custodia de instrumentos financieros, medios de pago, enrutamiento de Ã³rdenes
- **PSBI** (Prestadores de Servicios Basados en InformaciÃ³n): aplica a agregadores de datos financieros e iniciadores de pagos â†’ inscripciÃ³n en Registro CMF obligatoria
- SFA (Sistema de Finanzas Abiertas): obligaciÃ³n de certificar protocolo **FAPI 2.0** (Financial-grade API, OpenID Foundation)
- Obligaciones adicionales: patrimonio mÃ­nimo de capital, KYC, AML (anti-lavado), auditorÃ­as de ciberseguridad
- Alta barrera regulatoria â€” evaluar si la idea cae en perÃ­metro CMF antes de invertir en desarrollo

## 6. Ley Karin â€” Ley 21.643 (vigente desde agosto 2024)
- Aplica a toda empresa con al menos UN empleado en Chile
- Obliga a: modificar Reglamento Interno de Orden, Higiene y Seguridad; establecer canal de denuncia blindado; garantizar asistencia psicolÃ³gica expedita a vÃ­ctimas
- Sanciones: multas + inspecciones de oficio por la DirecciÃ³n del Trabajo
- Es seÃ±al de riesgo operacional en due diligence si la startup tiene equipo y no tiene protocolo documentado

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "recommended_structure": "SpA (Sociedad por Acciones) â€” Ãºnica estructura recomendada para startups que buscan capital externo en Chile",
  "founding_team_split": "RecomendaciÃ³n especÃ­fica sobre distribuciÃ³n de equity y pool de empleados (ej: 45%-45% fundadores + 10% ESOP)",
  "cap_table_entries": [
    { "name": "Fundador A", "role": "CEO", "percentage": 45, "vesting": true },
    { "name": "Fundador B", "role": "CTO", "percentage": 45, "vesting": true },
    { "name": "ESOP Pool", "role": "Empleados futuros", "percentage": 10, "vesting": true }
  ],
  "vesting_recommendation": "Esquema de vesting: duraciÃ³n, cliff, aceleraciÃ³n simple o doble ante exit",
  "legal_checklist": [
    { "item": "Nombre exacto del Ã­tem legal", "priority": "critical", "description": "Por quÃ© es crÃ­tico â€” citar ley o artÃ­culo especÃ­fico", "source": "Ley 21.719 art. 3 / INAPI / etc." }
  ],
  "inapi_checklist": [
    { "type": "marca", "recommendation": "Registrar marca en clase INAPI X â€” riesgo de colisiÃ³n con Y si no se actÃºa antes del lanzamiento", "risk": "critical" }
  ],
  "ley_karin_required": true,
  "ley_karin_notes": "ExplicaciÃ³n de si aplica Ley Karin y quÃ© acciones concretas debe tomar el equipo",
  "regulatory_risk": "medium",
  "regulatory_notes": "AnÃ¡lisis del riesgo regulatorio especÃ­fico para esta industria: citar Ley 21.719 si procesa datos, Ley 21.521 si es fintech/PSBI, Ley Karin si tiene empleados",
  "cap_table_warnings": ["Advertencia concreta sobre estructura cap table que dificultarÃ­a un due diligence VC"],
  "omission_warnings": ["Dato no informado que impide un anÃ¡lisis completo â€” ej: 'No se informÃ³ tipo societario actual; se asume constituciÃ³n pendiente'"]
}
Valores vÃ¡lidos para priority/risk en checklist: critical, important, nice_to_have
Valores vÃ¡lidos para regulatory_risk: low, medium, high
Valores vÃ¡lidos para inapi_checklist[].type: marca, patente, modelo_utilidad`,

  playbook_analysis: `__PLAYBOOK_DYNAMIC__`,

  fundraising_roadmap: `Eres un asesor de fundraising senior para startups en etapa temprana en Chile y LatinoamÃ©rica, con conocimiento profundo del ecosistema Corfo 2026, benchmarks LAVCA 2025 y estructuras de capital no dilutivo.
Genera una hoja de ruta de levantamiento de capital personalizada cruzando el estado actual de la startup (meses de operaciÃ³n, ventas, equipo fundador) contra los instrumentos disponibles en el ecosistema.
IMPORTANTE: Responde siempre en espaÃ±ol. Cita fuentes especÃ­ficas (ej: "Corfo Semilla Inicia â€” bases tÃ©cnicas 2026", "LAVCA 2025 Early-Stage Report"). NO alucines fondos ni programas â€” solo menciona fondos reales cuya existencia puedas confirmar con el contexto disponible.

# DIRECTRIZ ANTI-ADULACIÃ“N (obligatoria)
- El readiness_score debe justificarse explÃ­citamente en readiness_rationale con los datos concretos que lo respaldan
- Si el contexto no informa ventas, meses de operaciÃ³n o sexo del/la fundador/a â†’ agregar aviso en omission_warnings
- Prohibido recomendar una ronda priced (Serie A/B) si la startup no tiene LTV:CAC >3:1 demostrado y MRR consistente
- Si los datos son insuficientes para calcular LTV:CAC, indicar "no calculable con datos disponibles" â€” no inventar un ratio positivo

# BENCHMARKS DE REFERENCIA â€” LAVCA 2025 / ECOSISTEMA LATAM

## Contexto del mercado VC LatAm 2025
- Early-Stage (Pre-seed + Seed): USD 2.200M invertidos en 2025 (52% del capital total en LatAm) â€” mayor volumen histÃ³rico desde 2022
- ~500 nuevas startups levantaron su primera ronda institucional en los Ãºltimos 18 meses
- 50% de las inversiones early-stage fueron follow-ons (compromiso de fondos existentes con su cartera)
- MÃ©xico superÃ³ a Brasil por primera vez en 15 aÃ±os o cerrÃ³ la brecha a solo 14% de diferencia
- ConcentraciÃ³n: 25% del capital VC fue a las top 5 compaÃ±Ã­as (Plata, ADDI, Klar, Omie, Kavak)
- Fondos VC inyectaron >USD 2.000M en deuda no dilutiva (FIDCs, lÃ­neas de crÃ©dito, deuda estructurada) en 2025

## Criterios de aprobaciÃ³n para inversores LatAm (filtros de due diligence)
- **LTV:CAC ratio**: >3:1 es el mÃ­nimo para ser considerado en Serie A. Por debajo de 3:1 â†’ bootstrapping o Corfo primero
- **Payback Period**: <12 meses es el estÃ¡ndar saludable para SaaS B2B en LatAm
- **CAC B2B benchmark**: USD 536 promedio en SaaS B2B (fuente: anÃ¡lisis sectorial LatAm 2025)
- **CPM Chile vs EE.UU.**: USD 5.20 CPM en Chile vs USD 23.00 en EE.UU. â€” proyectar CAC con datos locales, no literatura norteamericana
- **Runway mÃ­nimo para levantar**: 6 meses de runway visible en el momento de iniciar conversaciones con fondos

## Instrumentos disponibles por etapa

### A. Corfo â€” Programas No Dilutivos (bases tÃ©cnicas 2026)
**Semilla Inicia**
- Elegibilidad: <18 meses de inicio de actividades, sin historial de ventas formales
- Cofinanciamiento: 75% del proyecto (fundador aporta 25%)
- Tope estÃ¡ndar: CLP 15.000.000
- Tope con bonus gÃ©nero (fundadora mujer): CLP 17.000.000 (cofinanciamiento 85%)
- EvaluaciÃ³n: escalabilidad, innovaciÃ³n tecnolÃ³gica, cohesiÃ³n del equipo, video pitch 40 segundos

**Semilla Expande â€” Fase 1**
- Elegibilidad: <36 meses de vida, ventas netas demostradas >CLP 100.000
- Cofinanciamiento: 75%
- Tope estÃ¡ndar: CLP 25.000.000
- Tope con bonus gÃ©nero: CLP 28.333.334 (cofinanciamiento 85%)

**Semilla Expande â€” Fase 2 (Escalamiento)**
- Requiere haber completado Fase 1
- Cofinanciamiento adicional: hasta CLP 20.000.000
- Total acumulable Expande: hasta CLP 45.000.000

### B. Deuda Estructurada No Dilutiva
- FIDCs (Fondos de InversiÃ³n en Derechos Crediticios), lÃ­neas de crÃ©dito, deuda estructurada
- Ideal para startups con LTV:CAC >3:1 que quieren extender runway sin diluir equity
- Permite alcanzar hitos de MRR necesarios para negociar Serie A en posiciÃ³n de fuerza

### C. Instrumentos de Equity (cuando la deuda no dilutiva no aplica)
- **SAFE** (Simple Agreement for Future Equity): estÃ¡ndar para pre-seed en Chile/LatAm. Sin fecha de vencimiento, sin interÃ©s. Recomendado para <USD 250K
- **Convertible Note**: con tasa de interÃ©s y fecha de vencimiento. Para pre-seed si el inversor exige protecciÃ³n adicional
- **Priced Round (Serie A+)**: solo con mÃ©tricas sÃ³lidas (MRR >USD 15K, LTV:CAC >3:1, equipo completo)

# LISTA CANÃ“NICA DE FONDOS â€” REGLA ABSOLUTA
Selecciona ÃšNICAMENTE fondos de la siguiente tabla. Si ningÃºn fondo de la lista aplica al perfil de la startup (por etapa, sector o geografÃ­a), devuelve "recommended_funds": []. ESTÃ PROHIBIDO mencionar cualquier fondo, URL o inversor que no aparezca en esta tabla â€” aunque lo conozcas.

Formato: Nombre | URL canÃ³nica | Etapas elegibles | Tesis/Sector | GeografÃ­a foco
---
StartUp Chile | https://startupchile.org | Pre-seed (aceleradora) | AgnÃ³stico â€” programa gubernamental | Chile
Platanus Ventures | https://platanus.vc | Pre-seed, Seed | B2B SaaS, Dev Tools, Tech | Chile
Magma Partners | https://magmapartners.com | Pre-seed, Seed | B2B agnÃ³stico | Chile / LatAm
Fen Ventures | https://fenventures.com | Seed, Serie A | CleanTech, DeepTech, Software | Chile
Broota | https://broota.com | Angel, Pre-seed | AgnÃ³stico, crowdfunding equity | Chile / LatAm
Kaszek | https://kaszek.com | Seed, Serie A, Serie B | AgnÃ³stico â€” Consumer, B2B | LatAm
ALLVP | https://allvp.vc | Seed, Serie A | B2B SaaS, FinTech, Vertical SaaS | MÃ©xico / LatAm
Monashees | https://monashees.com | Seed, Serie A | AgnÃ³stico â€” Consumer, B2B | Brasil / LatAm
Nazca | https://nazca.vc | Seed, Serie A | B2B SaaS, Marketplace | EspaÃ±a / LatAm
Valor Capital Group | https://valorcapital.com | Serie A, Serie B | Tech agnÃ³stico | Brasil / LatAm
Softbank LatAm Fund | https://softbank.com/en/global-business/latam | Serie A, Serie B+ | AgnÃ³stico â€” late stage | LatAm
Quona Capital | https://quona.com | Seed, Serie A | FinTech, InclusiÃ³n Financiera | LatAm / Global
BID Lab | https://bidlab.org | Pre-seed, Seed | Impacto, Tech4Good, FinTech inclusivo | LatAm
IGNIA | https://ignia.mx | Seed, Serie A | Impacto Social, Base de PirÃ¡mide | MÃ©xico / LatAm
Newtopia VC | https://newtopia.vc | Pre-seed, Seed | Consumer, B2C, Marketplace | Argentina / LatAm
Y Combinator | https://ycombinator.com | Pre-seed, Seed | AgnÃ³stico | Global
500 Global | https://500.co | Pre-seed, Seed | AgnÃ³stico | Global
Techstars | https://techstars.com | Pre-seed (aceleradora) | AgnÃ³stico | Global

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "recommended_instrument": "SAFE",
  "instrument_rationale": "JustificaciÃ³n basada en meses de operaciÃ³n y ventas actuales de la startup â€” citar datos del contexto",
  "suggested_ticket_size": { "min": 50000, "max": 150000, "currency": "USD" },
  "pre_money_valuation_range": { "min": 500000, "max": 1500000, "currency": "USD" },
  "valuation_disclaimer": "Rangos estimados algorÃ­tmicamente en base a benchmarks LAVCA 2025 y etapa declarada â€” no constituyen valorizaciÃ³n formal ni base de negociaciÃ³n",
  "corfo_eligibility": {
    "program": "semilla_inicia",
    "eligible": true,
    "max_amount_clp": 15000000,
    "cofinancing_rate": 0.75,
    "rationale": "Elegible porque tiene <18 meses y sin ventas formales â€” fuente: Corfo bases tÃ©cnicas 2026",
    "gender_bonus_applied": false
  },
  "non_dilutive_options": [
    { "type": "corfo", "description": "Semilla Inicia â€” CLP 15M no dilutivos para validar MVP", "estimated_amount": "CLP 15.000.000", "requirement": "<18 meses de actividad, sin ventas formales" }
  ],
  "ltv_cac_assessment": {
    "ratio_estimate": 0,
    "payback_months_estimate": 0,
    "meets_latam_benchmark": false,
    "notes": "No calculable con datos disponibles â€” se requiere MRR y CAC histÃ³rico para calcular ratio"
  },
  "recommended_funds": [
    { "name": "Platanus Ventures", "focus": "B2B SaaS, Dev Tools", "stage": "Pre-seed, Seed", "url": "https://platanus.vc" }
  ],
  "pitch_narrative": "PÃ¡rrafo de 100-150 palabras con el narrative del pitch para inversores, usando datos concretos del contexto",
  "readiness_score": 40,
  "readiness_rationale": "JustificaciÃ³n del score: quÃ© datos concretos elevan o bajan el puntaje â€” citar mÃ©tricas del contexto o su ausencia",
  "blockers": ["Bloqueo concreto con acciÃ³n de remediaciÃ³n especÃ­fica"],
  "next_milestones": ["Hito medible y fechable que debe alcanzarse antes de la ronda"],
  "omission_warnings": ["Dato no informado que impide anÃ¡lisis completo â€” ej: 'No se informÃ³ sexo del/la fundador/a; no se pudo evaluar bonus gÃ©nero Corfo'"]
}
Valores vÃ¡lidos para recommended_instrument: SAFE, convertible_note, priced_round, grant, bootstrapping, non_dilutive_debt
Valores vÃ¡lidos para corfo_eligibility.program: semilla_inicia, semilla_expande_fase1, semilla_expande_fase2, no_elegible
readiness_score: 0â€“100 donde 100 = listo para levantar capital institucional hoy`,

  lean_roadmap: `Eres un arquitecto de software y experto en desarrollo lean de startups en LatinoamÃ©rica.
Tu tarea es generar un plan de ejecuciÃ³n tÃ¡ctico dividido en sprints para construir el MVP de la startup descrita.
Prioriza arquitecturas No-Code/Low-Code (FlutterFlow, Bubble, Webflow, Supabase, Make/n8n) para fundadores no tÃ©cnicos.
Para ideas fintech/healthtech con requisitos regulatorios, recomienda stack escalable (Next.js, React, Supabase, Vercel).
IMPORTANTE: Responde siempre en espaÃ±ol.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "architecture_approach": "no_code",
  "rationale": "JustificaciÃ³n de por quÃ© esta arquitectura es la correcta para el perfil del equipo y la idea",
  "sprints": [
    {
      "name": "Sprint 1 â€” Nombre descriptivo",
      "duration_weeks": 2,
      "stack": "Bubble + Supabase",
      "must_haves": ["Feature crÃ­tica 1", "Feature crÃ­tica 2"],
      "nice_to_haves": ["Feature opcional 1"],
      "goal": "QuÃ© se valida o entrega al terminar este sprint"
    }
  ],
  "total_weeks": 6,
  "recommended_tools": ["Herramienta 1", "Herramienta 2"],
  "mvp_cost_usd": { "min": 500, "max": 2000 }
}
Los valores vÃ¡lidos para architecture_approach son: no_code, low_code, full_code. Genera exactamente 3 sprints.`,

  financial_projection: `Eres un analista financiero experto en Unit Economics y modelos de crecimiento de startups B2B y B2C en LatinoamÃ©rica.
Tu tarea es generar una proyecciÃ³n financiera de 12 meses y evaluar la estrategia de crecimiento.
Penaliza ideas B2C de consumo masivo con mÃ¡rgenes bajos (<30%). Premia modelos B2B SaaS con ingresos recurrentes y LTV/CAC >3x.
Usa benchmarks sectoriales realistas para el mercado latinoamericano.
IMPORTANTE: Responde siempre en espaÃ±ol.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "growth_strategy": "plg",
  "strategy_rationale": "Por quÃ© PLG o Sales-Led es el modelo correcto para esta idea y mercado",
  "monthly_projection": [
    { "month": 1, "mrr_usd": 0, "users": 0, "cac_spend_usd": 200 },
    { "month": 2, "mrr_usd": 150, "users": 5, "cac_spend_usd": 200 }
  ],
  "break_even_month": 9,
  "year1_revenue_usd": 12000,
  "key_assumptions": ["Supuesto clave 1", "Supuesto clave 2"],
  "model_verdict": "moderate",
  "model_verdict_reason": "ExplicaciÃ³n del veredicto sobre la viabilidad del modelo financiero"
}
Los valores vÃ¡lidos para growth_strategy son: plg, sales_led, hybrid.
Los valores vÃ¡lidos para model_verdict son: strong, moderate, weak. Genera exactamente 12 meses en monthly_projection.`,

  compliance_roadmap: `Eres un asesor legal y societario experto en el ecosistema emprendedor chileno, con conocimiento profundo de las leyes: Ley 21.521 (Fintech), Ley 21.719 (ProtecciÃ³n de Datos Personales), Ley 20.659 (Empresa en un DÃ­a) y normativas de salud (MINSAL/ISP).
Tu tarea es generar un roadmap de cumplimiento legal y societario personalizado para la startup descrita.
EvalÃºa el nivel de riesgo regulatorio: ideas en salud, finanzas, datos masivos o IA deben marcar riesgo alto.
IMPORTANTE: Responde siempre en espaÃ±ol.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "constitution": {
    "recommended_entity": "SpA (Sociedad por Acciones)",
    "steps": ["Paso 1: Registrar en Tu Empresa en Un DÃ­a", "Paso 2: Abrir cuenta bancaria empresarial"],
    "estimated_cost_clp": 0,
    "notes": "Observaciones importantes sobre la constituciÃ³n"
  },
  "regulatory": {
    "applicable_laws": [
      {
        "law": "Ley 21.719 â€” ProtecciÃ³n de Datos Personales",
        "description": "Regula el tratamiento de datos personales de clientes",
        "risk_level": "high",
        "action_required": "Implementar polÃ­tica de privacidad, consentimiento explÃ­cito y protocolo de brechas"
      }
    ],
    "checklist": [
      { "item": "Registro de marca en INAPI", "priority": "important", "description": "Proteger la marca antes del lanzamiento" }
    ]
  },
  "shareholders": {
    "vesting_recommendation": "4 aÃ±os con cliff de 12 meses para todos los co-fundadores",
    "cliff_months": 12,
    "drag_along": true,
    "tag_along": true,
    "notes": "Recomendaciones adicionales del pacto de accionistas"
  },
  "overall_risk_level": "medium",
  "risk_rationale": "ExplicaciÃ³n del nivel de riesgo regulatorio global de esta startup"
}`,

  pitch_deck: `Eres un asesor de startups experto en la estructura de Pitch Deck estilo Silicon Valley / Antler para rondas Pre-Seed y Seed en LatinoamÃ©rica.
Tu tarea es generar el contenido narrativo de las 8 slides estÃ¡ndar de un Pitch Deck.
SÃ© conciso, directo y orientado a inversores. Sin eufemismos. Sin relleno.
IMPORTANTE: Responde siempre en espaÃ±ol.

Responde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown:
{
  "hook": "Frase de elevator pitch de 1-2 lÃ­neas que capture la esencia del negocio y el por quÃ© ahora",
  "problem_statement": "DescripciÃ³n del dolor validado: quiÃ©n lo sufre, con quÃ© frecuencia, cuÃ¡nto cuesta (en tiempo o dinero) no resolverlo",
  "solution_statement": "CÃ³mo la startup resuelve el problema: mecanismo central de valor y por quÃ© es mejor que las alternativas actuales",
  "market_size_narrative": "Contexto narrativo del mercado: dinÃ¡mica, tendencia y por quÃ© el timing es correcto ahora",
  "business_model_narrative": "CÃ³mo la startup gana dinero: modelo de ingresos, palancas de precio y lÃ³gica de unit economics",
  "unfair_advantage": "Ventaja competitiva real y difÃ­cil de replicar: tecnologÃ­a, dato, red, regulaciÃ³n, equipo o distribuciÃ³n",
  "traction_milestones": ["Hito 1 alcanzado o en curso", "Hito 2 â€” LOIs, beta users, MRR, etc."],
  "the_ask": "Monto que se busca levantar, para quÃ© se usarÃ¡ y quÃ© hitos desbloquearÃ¡ (en 2-3 frases)"
}`,
};

// â”€â”€ Embeddings (OpenAI text-embedding-3-small) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

// â”€â”€ RAG: competitor retrieval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function retrieveRelevantCompetitors(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  idea: StructuredIdea,
): Promise<Record<string, unknown>[]> {
  const queryText = `${idea.problem} ${idea.solution} ${idea.market} ${idea.targetAudience}`;
  const embedding = await generateEmbedding(queryText);
  if (!embedding) return [];
  const { data } = await supabase.rpc('search_competitors', {
    query_embedding: embedding,
    match_threshold: 0.75,
    match_count: 6,
  });
  return data ?? [];
}

// â”€â”€ RAG: playbook retrieval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const RAG_TAGS_BY_PROMPT: Partial<Record<PromptType, string[]>> = {
  playbook_analysis:    ['VALIDATION', 'MOM_TEST', 'JTBD', 'UNIT_ECONOMICS', 'FINANCE', 'LEGAL', 'CHILE', 'TECH', 'NO_CODE', 'MVP', 'GROWTH', 'GTM', 'B2B_SALES', 'PLG', 'FUNDING', 'VC', 'PITCH_DECK', 'LATAM', 'PRODUCT_STRATEGY', 'AI', 'BLUE_OCEAN', 'UX', 'PSYCHOLOGY', 'BIASES', 'FOUNDER_RISK', 'POST_MORTEM'],
  validation_kit:       ['VALIDATION', 'MOM_TEST', 'JTBD'],
  unit_economics:       ['UNIT_ECONOMICS', 'FINANCE', 'BENCHMARKS', 'LATAM'],
  risk_checklist:       ['LEGAL', 'CHILE', 'COMPLIANCE'],
  tech_viability:       ['TECH', 'NO_CODE', 'MVP', 'ARCHITECTURE'],
  governance_assessment: ['LEGAL', 'CHILE', 'FINTECH', 'COMPLIANCE', 'LATAM'],
  fundraising_roadmap:   ['FUNDING', 'VC', 'LATAM', 'CHILE', 'UNIT_ECONOMICS', 'FINANCE', 'BENCHMARKS'],
};

async function retrieveRagPlaybooks(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  queryText: string,
  promptType: PromptType,
  matchCount = 4,
): Promise<string> {
  const tags = RAG_TAGS_BY_PROMPT[promptType];
  if (!tags) return '';
  const embedding = await generateEmbedding(queryText);
  if (!embedding) return '';
  const { data } = await supabase.rpc('search_rag_playbooks', {
    query_embedding: embedding,
    filter_tags: tags,
    match_threshold: 0.75,
    match_count: matchCount,
  });
  if (!data || data.length === 0) return '';
  return (data as Array<{ title: string; content: string }>)
    .map((chunk) => `## ${chunk.title}\n${chunk.content}`)
    .join('\n\n---\n\n');
}

// â”€â”€ GraphRAG: entity extraction + hybrid retrieval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Maps keyword patterns to known document_titles in knowledge_nodes
const ENTITY_MAP: [RegExp, string][] = [
  [/fintech|cme?f|21\.521|ley de datos|21\.719|datos personales|pagos digit|wallet|credito digital|banca/i,
    'Ley Fintech 21.521, Ley de Datos 21.719 y Estructura Societaria'],
  [/corfo|fondef|sii|tributari|regimen tributario|financiamiento estatal|subsidio|incentivo/i,
    'Financiamiento Estatal y ClasificaciÃ³n Tributaria SII'],
  [/playbook|validaci[oÃ³]n|lean|mom test|jtbd|jobs.to.be.done|prototipo|hipot[eÃ©]sis/i,
    'Playbook de Validacion de Ideas'],
  [/unit economics|ltv|cac|churn|mrr|arr|saas metrics|benchmark|margen|payback/i,
    'Unit Economics y Benchmarks B2B SaaS'],
  [/no.?code|low.?code|bubble|webflow|flutterflow|softr|stack tecnol|plataforma sin c[oÃ³]digo/i,
    'Tech Stack No-Code y Low-Code'],
  [/gtm|go.to.market|ventas|growth|crecimiento|plg|product.led|spin selling|design partner/i,
    'Growth GTM y Ventas'],
  [/blue ocean|ia|inteligencia artificial|errc|producto.ia|ai product|diferenciaci[oÃ³]n/i,
    'Producto IA y Blue Ocean Strategy'],
  [/sesgo|psicolog|fundador|confirmation bias|dunning.kruger|ilusiÃ³n de control|autopsia/i,
    'Psicologia y Sesgos del Founder'],
  [/fundraising|inversi[oÃ³]n|vc|venture capital|angel|pre.seed|seed|serie a|pitch deck|valuaci[oÃ³]n|ecosistema chileno/i,
    'Fundraising'],
];

function extractVaultEntities(queryText: string): string[] {
  return ENTITY_MAP
    .filter(([pattern]) => pattern.test(queryText))
    .map(([, title]) => title);
}

async function retrieveHybridGraphRAG(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  queryText: string,
  matchCount = 6,
): Promise<string> {
  const embedding = await generateEmbedding(queryText);
  if (!embedding) return '';

  const entities = extractVaultEntities(queryText);

  const { data, error } = await supabase.rpc('search_hybrid_graphrag', {
    query_embedding: embedding,
    extracted_entities: entities,
    match_threshold: 0.75,
    match_count: matchCount,
  });

  if (error) {
    console.error('[graphrag] RPC error:', error.message);
    return '';
  }
  if (!data || data.length === 0) return '';

  return (data as Array<{ source_type: string; document_title: string; content: string }>)
    .map((chunk) => `## [${chunk.source_type}] ${chunk.document_title}\n${chunk.content}`)
    .join('\n\n---\n\n');
}

const PLAYBOOK_MASTER_PROMPT = (ragChunks: string) => `# SYSTEM ROLE
ActÃºa como un Venture Builder experto, un Inversor de Capital de Riesgo (VC) implacable y un especialista legal/financiero en el ecosistema de Startups de LatAm (enfocado en Chile). Tu objetivo NO es complacer al emprendedor, sino evitar que construya algo que nadie quiere (riesgo del 42% segÃºn CB Insights).

# DIRECTRICES PRINCIPALES (REGLAS DE ORO)
1. MetodologÃ­a Lean & Mom Test: Exige siempre el "Aprendizaje Validado". ProhÃ­be al usuario hacer preguntas sesgadas. OblÃ­galo a aplicar el "Mom Test".
2. Framework JTBD (Jobs-to-be-Done): Analiza el mercado por el "trabajo" que el cliente intenta resolver, no solo demografÃ­a.
3. Unit Economics Realistas: Usa los benchmarks proporcionados en el contexto. Si el usuario proyecta costos irreales en LatAm, corrÃ­gelo con datos de la industria.
4. ValidaciÃ³n TÃ©cnica y No-Code: Recomienda el stack tÃ©cnico exacto (ej. Bubble, FlutterFlow, Softr) segÃºn el tipo de proyecto para validar rÃ¡pido.
5. Cumplimiento y RegulaciÃ³n (Chile/LatAm): EvalÃºa el riesgo regulatorio. Aplica los criterios de la Ley Fintech o Ley de ProtecciÃ³n de Datos (21.719) si corresponde.
6. Estrategia GTM y Ventas: EvalÃºa si la idea necesita Product-Led Growth (PLG) o Growth Hacking/Outbound B2B. Identifica el canal de adquisiciÃ³n con mayor potencial de tracciÃ³n inicial. Para B2B recomienda secuencias de outreach; para B2C recomienda loops virales o comunidades.
7. EvaluaciÃ³n de InversiÃ³n: Dictamina con criterios VC si el proyecto tiene madurez para levantar Pre-Seed (producto, equipo, seÃ±ales de mercado) o si primero debe validar con Bootstrapping o un grant (ej. StartupChile). SÃ© explÃ­cito sobre quÃ© hitos deben cumplirse antes de hablar con inversores.
8. Estrategia de Producto e IA: Si la idea usa IA, evalÃºa crÃ­ticamente si es realmente necesaria segÃºn el framework JTBD/Blue Ocean o si es solo "hype" tecnolÃ³gico que encarece el MVP sin agregar valor diferencial. Si no usa IA, evalÃºa si podrÃ­a crear una ventaja competitiva sostenible.
9. DiagnÃ³stico PsicolÃ³gico del Fundador: Identifica si el fundador estÃ¡ cayendo en "Sesgo de ConfirmaciÃ³n" (busca validar lo que ya cree), "IlusiÃ³n de Control" (sobreestima su capacidad de ejecuciÃ³n), "Efecto Dunning-Kruger" (subestima la complejidad del mercado) u otros sesgos cognitivos comunes en fundadores, basÃ¡ndote en cÃ³mo describe el problema y la soluciÃ³n.

# CONTEXTO RAG â€” PLAYBOOKS DE METODOLOGÃA
${ragChunks || '(Sin contexto adicional disponible)'}

Responde SOLO con JSON vÃ¡lido en espaÃ±ol, sin texto adicional, sin markdown:
{
  "harsh_truth": "Un pÃ¡rrafo directo y honesto sobre el principal riesgo de fracaso",
  "jtbd_analysis": "CuÃ¡l es el verdadero Job-to-be-Done que el cliente contrata",
  "validation_playbook": ["Paso 1 exacto usando Mom Test", "Paso 2", "Paso 3"],
  "unit_economics_check": "EvaluaciÃ³n de viabilidad financiera con benchmarks de la industria",
  "tech_and_legal_stack": "RecomendaciÃ³n No-Code especÃ­fica y advertencias legales en Chile",
  "gtm_and_growth_plan": "El canal de adquisiciÃ³n recomendado (PLG / outbound B2B / community-led) y la tÃ¡ctica inicial concreta para los primeros 30 dÃ­as",
  "funding_verdict": "Dictamen explÃ­cito: Â¿Pre-Seed con VC, grant/acceleradora, o bootstrapping primero? Indica quÃ© hitos faltan antes de levantar capital",
  "product_ai_strategy": "EvaluaciÃ³n tÃ©cnica y de mercado (Blue Ocean): si usa IA, Â¿es necesaria o es hype? Si no usa IA, Â¿deberÃ­a? QuÃ© ventaja competitiva real otorga",
  "founder_bias_warning": "DiagnÃ³stico duro sobre los sesgos psicolÃ³gicos detectados (ConfirmaciÃ³n, IlusiÃ³n de Control, Dunning-Kruger, etc.) y cÃ³mo estÃ¡n distorsionando la visiÃ³n del negocio",
  "viability_score": 65
}`;

// â”€â”€ Analysis cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function checkAnalysisCache(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ideaText: string,
  promptType: string,
): Promise<{ analysis_data: Record<string, unknown>; similarity: number } | null> {
  const embedding = await generateEmbedding(ideaText);
  if (!embedding) return null;
  const { data } = await supabase.rpc('search_cached_analyses', {
    query_embedding: embedding,
    match_threshold: 0.92,
    match_count: 1,
    filter_type: promptType,
  });
  return data?.[0] ?? null;
}

async function saveAnalysisCache(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ideaText: string,
  promptType: string,
  analysisData: Record<string, unknown>,
  industry?: string,
  geography?: string,
): Promise<void> {
  const embedding = await generateEmbedding(ideaText);
  if (!embedding) return;
  await supabase.from('cached_analyses').insert({
    idea_embedding: embedding,
    prompt_type: promptType,
    analysis_data: analysisData,
    industry,
    geography,
  });
}

// â”€â”€ Haiku pre-pass â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface StructuredIdea {
  problem: string;
  solution: string;
  targetAudience: string;
  market: string;
  revenueModel: string;
  stage: string;
  geography: string;
}

async function preprocessIdea(rawDescription: string): Promise<StructuredIdea | null> {
  if (!ANTHROPIC_API_KEY || !rawDescription) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'Eres un extractor de datos. Tu Ãºnica tarea es estructurar una idea de negocio en JSON. Responde SOLO con JSON vÃ¡lido, sin texto adicional.',
        messages: [{
          role: 'user',
          content: `Extrae y estructura esta idea de negocio:\n\n${rawDescription}\n\nResponde en este formato JSON exacto:\n{"problem":"...","solution":"...","targetAudience":"...","market":"...","revenueModel":"...","stage":"idea|validating|mvp|launched","geography":"..."}`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    return JSON.parse(extractJSON(text)) as StructuredIdea;
  } catch {
    return null;
  }
}

// â”€â”€ Providers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function callAnthropic(
  promptType: PromptType,
  context: Record<string, unknown>,
  systemOverride?: string,
  tier?: 'free' | 'basic' | 'pro',
): Promise<AIResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no estÃ¡ configurada en los secrets de Supabase.');
  }

  const useWebSearch = promptType === 'competitive_analysis' || promptType === 'market_sizing' || promptType === 'market_signals';

  // summary_quick siempre usa Haiku — estrategia de coste definida por Mesa Directiva.
  const selectedModel = (tier === 'free' || promptType === 'summary_quick')
    ? 'claude-haiku-4-5-20251001'
    : 'claude-sonnet-4-20250514';

  const body: Record<string, unknown> = {
    model: selectedModel,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: systemOverride ?? SYSTEM_PROMPTS[promptType],
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `${buildMarketContext(context)}\n\n${JSON.stringify(context)}`,
      },
    ],
  };

  if (useWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  if (Deno.env.get('DENO_ENV') !== 'production') {
    console.log(`[cache] ${promptType} â€” read: ${data.usage?.cache_read_input_tokens ?? 0}, created: ${data.usage?.cache_creation_input_tokens ?? 0}`);
  }

  const textContent = (data.content as Array<{ type: string; text?: string }>)
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');

  const parsed = JSON.parse(extractJSON(textContent));

  return {
    parsed,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    model: selectedModel,
  };
}

async function callOpenAI(
  promptType: PromptType,
  context: Record<string, unknown>,
  systemOverride?: string,
): Promise<AIResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no estÃ¡ configurada en los secrets de Supabase.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: (() => {
            const p = systemOverride ?? SYSTEM_PROMPTS[promptType];
            return /json/i.test(p) ? p : `${p}\n\nResponde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown.`;
          })(),
        },
        {
          role: 'user',
          content: `${buildMarketContext(context)}\n\n${JSON.stringify(context)}`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(extractJSON(text));

  return {
    parsed,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    model: 'gpt-4o-mini',
  };
}

/**
 * Routing principal:
 * - competitive_analysis y market_sizing â†’ siempre Anthropic (web_search)
 * - Resto â†’ segÃºn AI_PROVIDER, con fallback automÃ¡tico si falta la key
 */
async function callAI(
  promptType: PromptType,
  context: Record<string, unknown>,
  systemOverride?: string,
  tier?: 'free' | 'basic' | 'pro',
): Promise<AIResult> {
  // Prompts que idealmente usan web_search (solo Anthropic), pero si no hay crÃ©ditos caen a OpenAI
  const requiresAnthropic = promptType === 'competitive_analysis' || promptType === 'market_sizing' || promptType === 'market_signals';

  if (requiresAnthropic && ANTHROPIC_API_KEY) {
    try {
      return await callAnthropic(promptType, context, systemOverride, tier);
    } catch (err) {
      console.warn(`[callAI] Anthropic failed for ${promptType}, falling back to OpenAI:`, err);
    }
  }

  // Para el resto, usar el provider configurado con fallback
  if (AI_PROVIDER === 'openai') {
    if (OPENAI_API_KEY) return callOpenAI(promptType, context, systemOverride);
    console.warn('AI_PROVIDER=openai pero no hay OPENAI_API_KEY. Usando Anthropic como fallback.');
    return callAnthropic(promptType, context, systemOverride, tier);
  }

  // Default: Anthropic
  if (ANTHROPIC_API_KEY) return callAnthropic(promptType, context, systemOverride, tier);
  // Ãšltimo fallback: intentar OpenAI si hay key
  if (OPENAI_API_KEY) {
    console.warn('No hay ANTHROPIC_API_KEY. Usando OpenAI como fallback.');
    return callOpenAI(promptType, context, systemOverride);
  }

  throw new Error('No hay ningÃºn AI provider configurado. Agrega ANTHROPIC_API_KEY o OPENAI_API_KEY a los secrets de Supabase.');
}

// ── CAC multipliers by acquisition channel ────────────────────────────────────
// Source: internal analysis + HubSpot State of Marketing 2024, OpenView PLG 2024.
// multiplier_vs_benchmark: factor applied on top of the sector CAC baseline.
const CAC_MULTIPLIERS_BY_CHANNEL: Record<string, {
  multiplier_vs_benchmark: number;
  note: string;
}> = {
  outbound_linkedin: { multiplier_vs_benchmark: 1.4, note: 'Outbound B2B — CAC alto, leads calificados, ciclos 30-90 días' },
  ads_meta:          { multiplier_vs_benchmark: 1.1, note: 'Publicidad pagada — CAC moderado, escalable, sensible al CPM' },
  comunidades_organico: { multiplier_vs_benchmark: 0.4, note: 'Comunidades orgánicas — CAC muy bajo, lento, difícil de escalar' },
  referidos:         { multiplier_vs_benchmark: 0.3, note: 'Referidos/WOM — CAC más bajo, requiere NPS>50' },
  alianzas:          { multiplier_vs_benchmark: 0.7, note: 'Alianzas — CAC compartido con el socio, margen reducido' },
  contenido_seo:     { multiplier_vs_benchmark: 0.5, note: 'Contenido/SEO — CAC bajo a largo plazo, ramp-up 6-18 meses' },
  eventos_presencial: { multiplier_vs_benchmark: 1.2, note: 'Eventos presenciales — efectivo B2B complejo, CAC moderado-alto' },
};

// ── Sector benchmarks (CAC / LTV / churn medians by industry + model) ────────
// Source: Profitwell 2024, ChartMogul Benchmarks 2024, OpenView SaaS 2024
// All values in USD unless noted. Updated: 2026-05.
const SECTOR_BENCHMARKS: Record<string, Record<string, {
  cac_usd: { min: number; max: number };
  ltv_usd: { min: number; max: number };
  monthly_churn_pct: { min: number; max: number };
  payback_months: { min: number; max: number };
  gross_margin_pct: number;
  note: string;
}>> = {
  saas: {
    b2b: { cac_usd: { min: 200, max: 800 }, ltv_usd: { min: 1500, max: 6000 }, monthly_churn_pct: { min: 1, max: 4 }, payback_months: { min: 6, max: 18 }, gross_margin_pct: 75, note: 'B2B SaaS mediana 2024 â€” ChartMogul' },
    b2c: { cac_usd: { min: 20, max: 80 }, ltv_usd: { min: 80, max: 400 }, monthly_churn_pct: { min: 3, max: 8 }, payback_months: { min: 3, max: 12 }, gross_margin_pct: 70, note: 'B2C SaaS mediana 2024 â€” Profitwell' },
    default: { cac_usd: { min: 100, max: 500 }, ltv_usd: { min: 500, max: 3000 }, monthly_churn_pct: { min: 2, max: 6 }, payback_months: { min: 4, max: 15 }, gross_margin_pct: 72, note: 'SaaS genÃ©rico â€” benchmark promedio 2024' },
  },
  fintech: {
    b2b: { cac_usd: { min: 400, max: 1200 }, ltv_usd: { min: 3000, max: 15000 }, monthly_churn_pct: { min: 0.5, max: 2 }, payback_months: { min: 8, max: 24 }, gross_margin_pct: 55, note: 'Fintech B2B â€” altos costos de compliance y onboarding' },
    b2c: { cac_usd: { min: 30, max: 120 }, ltv_usd: { min: 150, max: 800 }, monthly_churn_pct: { min: 2, max: 7 }, payback_months: { min: 4, max: 14 }, gross_margin_pct: 45, note: 'Fintech B2C LATAM â€” benchmark Kushki/Fintual 2023' },
    default: { cac_usd: { min: 100, max: 600 }, ltv_usd: { min: 500, max: 5000 }, monthly_churn_pct: { min: 1, max: 5 }, payback_months: { min: 6, max: 20 }, gross_margin_pct: 50, note: 'Fintech genÃ©rico LATAM' },
  },
  edtech: {
    b2b: { cac_usd: { min: 300, max: 900 }, ltv_usd: { min: 2000, max: 8000 }, monthly_churn_pct: { min: 1, max: 3 }, payback_months: { min: 6, max: 15 }, gross_margin_pct: 65, note: 'EdTech B2B â€” ventas institucionales (colegios, empresas)' },
    b2c: { cac_usd: { min: 15, max: 60 }, ltv_usd: { min: 60, max: 300 }, monthly_churn_pct: { min: 5, max: 12 }, payback_months: { min: 2, max: 8 }, gross_margin_pct: 68, note: 'EdTech B2C LATAM â€” churn alto en primeros 3 meses' },
    default: { cac_usd: { min: 50, max: 300 }, ltv_usd: { min: 200, max: 1500 }, monthly_churn_pct: { min: 3, max: 9 }, payback_months: { min: 3, max: 12 }, gross_margin_pct: 66, note: 'EdTech genÃ©rico' },
  },
  healthtech: {
    b2b: { cac_usd: { min: 500, max: 2000 }, ltv_usd: { min: 5000, max: 30000 }, monthly_churn_pct: { min: 0.5, max: 1.5 }, payback_months: { min: 12, max: 36 }, gross_margin_pct: 60, note: 'HealthTech B2B â€” ciclos de venta largos (6-18 meses)' },
    b2c: { cac_usd: { min: 40, max: 150 }, ltv_usd: { min: 200, max: 1000 }, monthly_churn_pct: { min: 3, max: 8 }, payback_months: { min: 5, max: 15 }, gross_margin_pct: 55, note: 'HealthTech B2C â€” retenciÃ³n alta si genera resultados' },
    default: { cac_usd: { min: 150, max: 800 }, ltv_usd: { min: 800, max: 8000 }, monthly_churn_pct: { min: 1, max: 6 }, payback_months: { min: 8, max: 24 }, gross_margin_pct: 57, note: 'HealthTech genÃ©rico' },
  },
  ecommerce: {
    b2c: { cac_usd: { min: 10, max: 50 }, ltv_usd: { min: 50, max: 350 }, monthly_churn_pct: { min: 5, max: 15 }, payback_months: { min: 1, max: 6 }, gross_margin_pct: 35, note: 'E-commerce B2C â€” mÃ¡rgenes bajos, volumen necesario' },
    marketplace: { cac_usd: { min: 20, max: 80 }, ltv_usd: { min: 100, max: 600 }, monthly_churn_pct: { min: 4, max: 10 }, payback_months: { min: 2, max: 8 }, gross_margin_pct: 30, note: 'Marketplace â€” take rate 10-20%' },
    default: { cac_usd: { min: 15, max: 60 }, ltv_usd: { min: 60, max: 400 }, monthly_churn_pct: { min: 5, max: 12 }, payback_months: { min: 2, max: 7 }, gross_margin_pct: 32, note: 'E-commerce genÃ©rico LATAM' },
  },
  marketplace: {
    default: { cac_usd: { min: 25, max: 100 }, ltv_usd: { min: 120, max: 700 }, monthly_churn_pct: { min: 3, max: 9 }, payback_months: { min: 3, max: 10 }, gross_margin_pct: 30, note: 'Marketplace â€” 2 lados del mercado (supply + demand)' },
  },
  logistics: {
    b2b: { cac_usd: { min: 300, max: 1000 }, ltv_usd: { min: 2500, max: 12000 }, monthly_churn_pct: { min: 1, max: 3 }, payback_months: { min: 8, max: 20 }, gross_margin_pct: 25, note: 'LogÃ­stica B2B â€” mÃ¡rgenes bajos, alto volumen' },
    default: { cac_usd: { min: 100, max: 500 }, ltv_usd: { min: 500, max: 5000 }, monthly_churn_pct: { min: 1.5, max: 4 }, payback_months: { min: 6, max: 18 }, gross_margin_pct: 25, note: 'LogÃ­stica genÃ©rico LATAM' },
  },
  foodtech: {
    b2c: { cac_usd: { min: 8, max: 30 }, ltv_usd: { min: 40, max: 200 }, monthly_churn_pct: { min: 8, max: 20 }, payback_months: { min: 1, max: 5 }, gross_margin_pct: 28, note: 'FoodTech B2C â€” altÃ­simo churn, retention es el reto' },
    b2b: { cac_usd: { min: 200, max: 700 }, ltv_usd: { min: 1500, max: 7000 }, monthly_churn_pct: { min: 1, max: 4 }, payback_months: { min: 5, max: 14 }, gross_margin_pct: 32, note: 'FoodTech B2B (restaurantes, dark kitchens)' },
    default: { cac_usd: { min: 20, max: 200 }, ltv_usd: { min: 80, max: 2000 }, monthly_churn_pct: { min: 4, max: 15 }, payback_months: { min: 2, max: 10 }, gross_margin_pct: 30, note: 'FoodTech genÃ©rico' },
  },
  proptech: {
    b2b: { cac_usd: { min: 400, max: 1500 }, ltv_usd: { min: 3000, max: 20000 }, monthly_churn_pct: { min: 0.5, max: 2 }, payback_months: { min: 10, max: 30 }, gross_margin_pct: 60, note: 'PropTech B2B â€” ciclos largos, alta retenciÃ³n' },
    default: { cac_usd: { min: 100, max: 800 }, ltv_usd: { min: 500, max: 8000 }, monthly_churn_pct: { min: 1, max: 4 }, payback_months: { min: 8, max: 24 }, gross_margin_pct: 55, note: 'PropTech genÃ©rico' },
  },
  social: {
    b2c: { cac_usd: { min: 1, max: 15 }, ltv_usd: { min: 5, max: 80 }, monthly_churn_pct: { min: 10, max: 25 }, payback_months: { min: 1, max: 6 }, gross_margin_pct: 70, note: 'Social B2C â€” monetizaciÃ³n por ads o freemium' },
    default: { cac_usd: { min: 2, max: 20 }, ltv_usd: { min: 10, max: 100 }, monthly_churn_pct: { min: 8, max: 20 }, payback_months: { min: 1, max: 6 }, gross_margin_pct: 65, note: 'Social genÃ©rico' },
  },
  other: {
    b2b: { cac_usd: { min: 200, max: 700 }, ltv_usd: { min: 1200, max: 6000 }, monthly_churn_pct: { min: 1.5, max: 5 }, payback_months: { min: 6, max: 18 }, gross_margin_pct: 55, note: 'B2B genÃ©rico â€” ajustar por sector especÃ­fico' },
    b2c: { cac_usd: { min: 15, max: 80 }, ltv_usd: { min: 60, max: 400 }, monthly_churn_pct: { min: 4, max: 10 }, payback_months: { min: 3, max: 10 }, gross_margin_pct: 50, note: 'B2C genÃ©rico â€” ajustar por producto y precio' },
    default: { cac_usd: { min: 50, max: 300 }, ltv_usd: { min: 200, max: 2000 }, monthly_churn_pct: { min: 2, max: 8 }, payback_months: { min: 4, max: 14 }, gross_margin_pct: 52, note: 'Benchmarks genÃ©ricos 2024' },
  },
};

// â”€â”€ Handler HTTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ Prompt type whitelist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const VALID_PROMPT_TYPES = new Set<PromptType>(Object.keys(SYSTEM_PROMPTS) as PromptType[]);

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const { validation_id, step, prompt_type, context } = (await req.json()) as AIRequest;

    // Validate prompt_type
    if (!VALID_PROMPT_TYPES.has(prompt_type)) {
      return new Response(JSON.stringify({ error: `Invalid prompt_type: ${prompt_type}` }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // â”€â”€ Middleware Ley 21.719 (Consentimiento) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: consent } = await supabase
      .from('consent_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('flagged', true)
      .limit(1)
      .maybeSingle();

    if (!consent) {
      return new Response(JSON.stringify({ 
        error: 'consent_required', 
        message: 'Debe aceptar los tÃ©rminos de la Ley 21.719 para continuar.' 
      }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


    // --- Tier + Rate limiting ---------------------------------------------------
    // Usa RPC atomica (check_and_increment_usage) en lugar de COUNT(ai_interactions):
    //   - Elimina race condition: SELECT FOR UPDATE serializa requests concurrentes
    //   - O(1) en lugar de O(n): contador dedicado, no tabla de auditoria
    //   - Verifica tier_expires_at: suscripciones vencidas degradan a free automaticamente
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, tier_expires_at')
      .eq('id', user.id)
      .single();

    let userTier: 'free' | 'basic' | 'pro' | 'premium' =
      (['free', 'basic', 'pro', 'premium'].includes(profile?.tier ?? ''))
        ? (profile!.tier as 'free' | 'basic' | 'pro' | 'premium')
        : 'free';

    // Downgrade automatico si la suscripcion vencio (Lemon Squeezy cancel)
    if (profile?.tier_expires_at && new Date(profile.tier_expires_at) < new Date()) {
      userTier = 'free';
    }

    const EXPENSIVE_TYPES = new Set(['competitive_analysis', 'market_sizing', 'market_signals']);
    const isExpensive = EXPENSIVE_TYPES.has(prompt_type);

    const { data: rateCheck, error: rateError } = await supabase.rpc(
      'check_and_increment_usage',
      { p_user_id: user.id, p_prompt_type: prompt_type, p_is_expensive: isExpensive, p_tier: userTier },
    );

    if (rateError) {
      // Fail-open: si el RPC falla (DB issue), loguear y permitir el request.
      // Disponibilidad > enforcement en este escenario de baja probabilidad.
      console.warn('rate-limit RPC error (fail-open):', rateError.message);
    } else if (!rateCheck?.allowed) {
      const reason: string = rateCheck?.reason ?? 'monthly_limit';
      phCapture('paywall_hit', user.id, {
        prompt_type, tier: userTier, reason,
        used: rateCheck?.used, limit: rateCheck?.limit,
      });
      const MSG: Record<string, string> = {
        tier_blocked:    'Este analisis requiere plan Basic o superior.',
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        monthly_limit:   `Limite mensual de ${rateCheck?.limit} analisis para el plan ${userTier} alcanzado.`,
        expensive_limit: `Limite de ${rateCheck?.limit} analisis de mercado para el plan ${userTier} alcanzado.`,
      };
      return new Response(JSON.stringify({
        error:   reason,
        message: MSG[reason] ?? 'Limite alcanzado.',
        used:    rateCheck?.used,
        limit:   rateCheck?.limit,
        tier:    userTier,
      }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    // ---------------------------------------------------------------------------

    // Haiku pre-pass: enriquece el contexto con idea estructurada
    let enrichedContext = context;

    // ── BralidusPY (Fase 2) — Capa 4: disparar AHORA para correr en paralelo con
    // el pre-pass Haiku y el RAG. Gating por prompt_type + tier (Capa 1) y caché por
    // perfil (Capa 2) viven dentro de fetchBralidusContextForPrompt → retorna null
    // (sin red) si el prompt no aplica o el tier no lo habilita. Se resuelve más abajo.
    const bralidusQuery = [
      context.idea_name,
      context.idea_description ?? context.idea_problem,
      context.idea_industry ?? context.industry,
      context.business_model,
    ].filter(Boolean).join('. ').slice(0, 600);
    const bralidusPromise = fetchBralidusContextForPrompt(
      supabase, prompt_type, bralidusQuery, context, userTier,
    );
    const rawDescription = context.idea_description as string | undefined;
    let structuredIdea: StructuredIdea | null = null;
    if (rawDescription && rawDescription.length > 50) {
      structuredIdea = await preprocessIdea(rawDescription);
      if (structuredIdea) {
        enrichedContext = { ...context, structured_idea: structuredIdea };
      }
    }

    // RAG: inyectar competidores relevantes para competitive_analysis
    if (prompt_type === 'competitive_analysis' && structuredIdea) {
      const rag = await retrieveRelevantCompetitors(supabase, structuredIdea);
      if (rag.length > 0) {
        enrichedContext = { ...enrichedContext, rag_competitors: rag };
      }
    }

    // RAG: inyectar playbooks metodolÃ³gicos segÃºn el tipo de prompt
    let ragSystemOverride: string | undefined;
    const ragQueryText = rawDescription
      ? `${rawDescription} ${context.target_country ?? ''} ${context.business_model ?? ''}`.trim()
      : '';

    if (ragQueryText && RAG_TAGS_BY_PROMPT[prompt_type]) {
      // playbook_analysis usa el motor hÃ­brido GraphRAG (grafo + vector)
      // El resto de prompts sigue usando search_rag_playbooks (tenant_vectors)
      const ragChunks = prompt_type === 'playbook_analysis'
        ? await retrieveHybridGraphRAG(supabase, ragQueryText)
        : await retrieveRagPlaybooks(supabase, ragQueryText, prompt_type);

      if (ragChunks) {
        if (prompt_type === 'playbook_analysis') {
          ragSystemOverride = PLAYBOOK_MASTER_PROMPT(ragChunks);
        } else {
          const basePrompt = SYSTEM_PROMPTS[prompt_type];
          ragSystemOverride = `${basePrompt}\n\n# CONTEXTO METODOLÃ“GICO ADICIONAL (RAG)\n${ragChunks}`;
        }
      } else if (prompt_type === 'playbook_analysis') {
        // NingÃºn chunk superÃ³ el umbral 0.75 â€” degradaciÃ³n elegante sin llamar al LLM
        const fallback = { _fallo_elegante: true };
        if (validation_id) {
          await supabase.from('validations').update({ playbook_analysis: fallback }).eq('id', validation_id);
        }
        // Audit log: registrar el fallo para monitoreo del threshold
        supabase.from('ai_interactions').insert({
          user_id: user.id,
          validation_id,
          step,
          prompt_type,
          input_data: { idea_description: context.idea_description, idea_industry: context.idea_industry },
          output_data: { _fallo_elegante: true, _reason: 'no_rag_chunks_above_threshold_0.75' },
          tokens_used: 0,
          model: 'graceful_degradation',
        }).then(({ error: logErr }) => {
          if (logErr) console.warn('[fallback-log] Insert error:', logErr.message);
        });
        return new Response(JSON.stringify(fallback), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    // BCCh macro: inyectar Ãºltimas series IPC para market_sizing
    if (prompt_type === 'market_sizing') {
      const { data: bdeRows } = await supabase
        .from('market_bde_data')
        .select('series_desc, obs_date, value')
        .in('series_id', ['G073.IPC.IND.2023.M', 'G073.IPC.V12.2023.M'])
        .order('obs_date', { ascending: false })
        .limit(6);

      if (bdeRows && bdeRows.length > 0) {
        const summary = bdeRows.map(
          (r: { series_desc: string; obs_date: string; value: number }) =>
            `${r.series_desc} (${r.obs_date}): ${r.value}`,
        ).join(' | ');
        enrichedContext = { ...enrichedContext, bde_macro_context: summary };
      }
    }

    // Benchmarks sectoriales + CAC por canal: inyectar para unit_economics
    if (prompt_type === 'unit_economics') {
      const industry = (context.idea_industry ?? context.industry ?? '') as string;
      const model    = (context.business_model ?? '') as string;
      const benchmark = SECTOR_BENCHMARKS[industry]?.[model]
        ?? SECTOR_BENCHMARKS[industry]?.['default']
        ?? null;
      if (benchmark) {
        enrichedContext = { ...enrichedContext, industry_benchmarks: benchmark };
      }

      const channel = (context.acquisition_channel ?? '') as string;
      const channelBenchmark = CAC_MULTIPLIERS_BY_CHANNEL[channel] ?? null;
      if (channelBenchmark) {
        enrichedContext = { ...enrichedContext, channel_cac_benchmark: channelBenchmark };
      }
    }

    // ── Resolver BralidusPY (disparado al inicio) e inyectar contexto citable ──
    // Inyecta en el contexto (dato) Y en el system prompt (instrucción de uso+cita).
    // Degradación elegante: si el fetch falló o no aplica, bralidusResult es null.
    const bralidusResult = await bralidusPromise;
    if (bralidusResult && bralidusResult.context.contextBlock) {
      enrichedContext = { ...enrichedContext, bralidus_context: bralidusResult.context.contextBlock };
      const baseSystem = ragSystemOverride ?? SYSTEM_PROMPTS[prompt_type];
      ragSystemOverride =
        `${baseSystem}\n\n# INTELIGENCIA BRALIDUS (datos macro fechados + doctrina normativa)\n` +
        `${bralidusResult.context.contextBlock}\n\n${BRALIDUS_CITE_DIRECTIVE}`;
    }

    // CachÃ©: verificar si existe un anÃ¡lisis similar reciente
    const cacheableTypes = ['summary', 'risk_analysis', 'unit_economics', 'market_sizing'];
    const ideaCacheKey = rawDescription
      ? `${rawDescription} ${context.target_country ?? ''} ${context.business_model ?? ''}`.trim()
      : null;

    if (ideaCacheKey && cacheableTypes.includes(prompt_type)) {
      const cached = await checkAnalysisCache(supabase, ideaCacheKey, prompt_type);
      if (cached) {
        console.log(`[cache hit] ${prompt_type} similarity=${cached.similarity.toFixed(3)}`);
        return new Response(
          JSON.stringify({ ...cached.analysis_data, _fromCache: true, _cacheSimilarity: cached.similarity }),
          { headers: { ...cors, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Llamada AI con routing dual
    const tierForAI = (userTier === 'premium' ? 'pro' : userTier) as 'free' | 'basic' | 'pro';
    const { parsed, inputTokens, outputTokens, model } = await callAI(prompt_type, enrichedContext, ragSystemOverride, tierForAI);

    // Adjuntar evidencia Bralidus al resultado: auditable y respaldado (insumo EvidenceWall, Fase 3).
    // Clave `_bralidus` ignorada por los renderers del frontend que no la conocen.
    if (bralidusResult && bralidusResult.context.evidence.length > 0) {
      (parsed as Record<string, unknown>)._bralidus = {
        evidence:       bralidusResult.context.evidence,
        experts:        bralidusResult.context.experts,
        data_freshness: bralidusResult.context.dataFreshness,
        cached:         bralidusResult.cached,
      };
    }

    phCapture('ai_prompt_called', user.id, {
      prompt_type,
      tier: userTier,
      model,
      tokens_in: inputTokens,
      tokens_out: outputTokens,
      tokens_total: inputTokens + outputTokens,
      validation_id: validation_id ?? null,
      bralidus_used: bralidusResult !== null,
      bralidus_cached: bralidusResult?.cached ?? false,
    });

    // Guardar en cachÃ© (no bloqueante)
    if (ideaCacheKey && cacheableTypes.includes(prompt_type)) {
      saveAnalysisCache(
        supabase, ideaCacheKey, prompt_type, parsed,
        context.idea_industry as string | undefined,
        context.target_country as string | undefined,
      ).catch((err) => console.warn('[cache-save] Error:', err));
    }

    // Persistencia bloqueante: el backend es el SSOT para campos derivados
    if (validation_id) {
      const persistUpdates: Record<string, unknown> = {};

      if (prompt_type === 'summary') {
        const scoreVal = typeof parsed.score === 'number' ? parsed.score : null;
        persistUpdates.summary_json     = parsed;
        persistUpdates.validation_score = scoreVal;
        persistUpdates.ai_feedback      = typeof parsed.feedback === 'string' ? parsed.feedback : null;
        persistUpdates.score_breakdown  = parsed.score_breakdown ?? null;
      } else if (prompt_type === 'competitive_analysis') {
        persistUpdates.competitive_analysis = parsed;
      } else if (prompt_type === 'market_sizing') {
        persistUpdates.market_sizing = parsed;
      } else if (prompt_type === 'risk_analysis') {
        persistUpdates.risk_analysis = parsed;
      } else if (prompt_type === 'unit_economics') {
        persistUpdates.unit_economics = parsed;
      } else if (prompt_type === 'founder_fit') {
        persistUpdates.founder_fit = parsed;
      } else if (prompt_type === 'market_signals') {
        persistUpdates.market_signals = parsed;
      } else if (prompt_type === 'governance_assessment') {
        persistUpdates.governance_assessment = parsed;
      } else if (prompt_type === 'fundraising_roadmap') {
        persistUpdates.fundraising_roadmap = parsed;
      } else if (prompt_type === 'playbook_analysis') {
        persistUpdates.playbook_analysis = parsed;
      } else if (prompt_type === 'pitch_deck') {
        persistUpdates.pitch_deck_content = parsed;
      } else if (prompt_type === 'lean_roadmap') {
        persistUpdates.lean_roadmap = parsed;
      } else if (prompt_type === 'financial_projection') {
        persistUpdates.financial_projection = parsed;
      } else if (prompt_type === 'compliance_roadmap') {
        persistUpdates.compliance_roadmap = parsed;
      }

      if (Object.keys(persistUpdates).length > 0) {
        const { error: persistErr } = await supabase
          .from('validations')
          .update(persistUpdates)
          .eq('id', validation_id);
        if (persistErr) console.warn('[persist] Error saving to validations:', persistErr.message);
      }
    }

    // Log de interacciÃ³n (no bloqueante)
    supabase.from('ai_interactions').insert({
      user_id: user.id,
      validation_id,
      step,
      prompt_type,
      input_data: context,
      output_data: parsed,
      tokens_used: inputTokens + outputTokens,
      model,
    }).then(({ error: logErr }) => {
      if (logErr) console.warn('[ai-log] Insert error:', logErr.message);
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ai-validate] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
