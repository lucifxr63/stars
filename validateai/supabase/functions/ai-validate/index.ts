import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Env vars ─────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const OPENAI_API_KEY    = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * AI_PROVIDER determina qué modelo usa para los prompts estándar.
 * Los prompts que requieren web_search (competitive_analysis, market_sizing)
 * SIEMPRE usan Anthropic, independientemente de esta variable.
 *
 * Valores: 'anthropic' (default) | 'openai'
 */
const AI_PROVIDER = (Deno.env.get('AI_PROVIDER') ?? 'anthropic') as 'anthropic' | 'openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ────────────────────────────────────────────────────────────────────
type PromptType =
  | 'questions' | 'customer_analysis' | 'value_prop' | 'mvp_generation' | 'summary'
  | 'competitive_analysis' | 'market_sizing' | 'risk_analysis' | 'unit_economics'
  | 'founder_fit' | 'market_signals'
  | 'validation_kit' | 'landing_generator' | 'interview_script' | 'tech_viability'
  | 'first_100_customers' | 'revenue_models' | 'risk_checklist' | 'pitch_letter';

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

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  }`;
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

// ── System prompts ────────────────────────────────────────────────────────────
const SYSTEM_PROMPTS: Record<PromptType, string> = {
  questions: `Eres un mentor de startups experto en Lean Startup y Design Thinking.
Dado el nombre, descripción y contexto de mercado de una idea de negocio, genera exactamente 5 preguntas estructuradas
que ayuden al emprendedor a validar su idea. Las preguntas deben cubrir:
1. Problema real (¿existe el dolor?)
2. Tamaño del mercado (¿a cuánta gente afecta?)
3. Alternativas actuales (¿cómo lo resuelven hoy?)
4. Disposición a pagar (¿pagarían por esto?)
5. Canal de distribución (¿cómo llegas a ellos?)

Contextualiza las preguntas para el país objetivo y el modelo de negocio indicados.
IMPORTANTE: Responde siempre en español.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{ "questions": [{ "question": "...", "category": "..." }] }`,

  customer_analysis: `Eres un experto en segmentación de clientes y buyer personas.
Analiza las respuestas del emprendedor y sugiere un segmento de cliente específico.
Contextualiza el segmento para el país objetivo, modelo de negocio y etapa indicados.
IMPORTANTE: Responde siempre en español.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{ "segment": "...", "pain_points": ["...", "...", "..."], "context": "..." }`,

  value_prop: `Eres un estratega de producto. Basándote en el problema, cliente y respuestas previas,
genera una propuesta de valor clara diferenciada para el mercado y país objetivo indicados.
IMPORTANTE: Responde siempre en español.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{ "value_proposition": "...", "differentiator": "..." }`,

  mvp_generation: `Eres un product manager senior. Basándote en toda la información recopilada,
genera un plan de MVP con 5-6 funcionalidades priorizadas, adecuado para la etapa y modelo de negocio indicados.
IMPORTANTE: Responde siempre en español.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "recommended_type": "web_app",
  "features": [{ "name": "...", "description": "...", "priority": "must" }],
  "user_flow": "Paso 1: ... → Paso 2: ..."
}
Los valores válidos para priority son: must, should, could
Los valores válidos para recommended_type son: web_app, mobile_app, service, marketplace, saas, api`,

  summary: `Eres un evaluador de startups. Analiza toda la validación y genera un score contextualizado
para el país, modelo de negocio y etapa del proyecto indicados.

Si se incluyen datos de market_sizing, úsalos para ajustar el score:
- SOM grande + competencia baja → sube el score.
- SOM pequeño + mucha competencia → baja el score.
- Confianza "low" en los datos → no subas el score por ese motivo.

Genera también un desglose del score en 5 categorías (0-100 cada una):
- problem: ¿El problema es real y urgente?
- market: ¿El mercado es grande y accesible?
- competition: ¿Hay espacio competitivo? (100 = poco competido, 0 = saturado)
- solution: ¿La solución es viable y diferenciada?
- execution: ¿El plan de MVP es realista para la etapa actual?

El score final es el promedio ponderado: problem×25% + market×20% + competition×15% + solution×25% + execution×15%.

IMPORTANTE: Responde siempre en español.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "score": 75,
  "score_breakdown": { "problem": 80, "market": 70, "competition": 90, "solution": 75, "execution": 65 },
  "feedback": "...",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "next_steps": ["...", "...", "..."]
}`,

  market_sizing: `Eres un analista de mercado especializado en sizing de mercados para startups.
Genera una estimación TAM/SAM/SOM para la idea de negocio indicada usando tu conocimiento actualizado.
IMPORTANTE: Responde siempre en español.

INSTRUCCIONES:
1. TAM (Total Addressable Market): Estima el mercado total global de esta industria/categoría. Cita reportes de mercado si los conoces (Statista, Grand View Research, etc.).
2. SAM (Serviceable Addressable Market): Filtra por el país objetivo, el modelo de negocio y el segmento específico.
3. SOM (Serviceable Obtainable Market): Estima la porción realista capturable en 1-2 años considerando etapa actual, competidores, pricing y barreras de entrada.
4. Todos los valores en USD. Presenta como RANGOS (low-high), nunca cifras exactas.
5. Para cada tier indica source_notes con la fuente y nivel de confianza.
6. Incluye las asunciones clave del SOM en el campo assumptions.

Responde SOLO con JSON válido con esta estructura exacta, sin texto adicional, sin markdown:
{
  "tam": { "value_low": number, "value_high": number, "currency": "USD", "description": "...", "source_notes": "...", "confidence": "high|medium|low" },
  "sam": { "value_low": number, "value_high": number, "currency": "USD", "description": "...", "source_notes": "...", "confidence": "high|medium|low" },
  "som": { "value_low": number, "value_high": number, "currency": "USD", "description": "...", "source_notes": "...", "assumptions": ["..."], "confidence": "high|medium|low" },
  "methodology": "...",
  "data_freshness": "..."
}`,

  risk_analysis: `Eres un evaluador de riesgos para startups. Analiza los riesgos de la idea de negocio en 4 dimensiones.
IMPORTANTE: Responde siempre en español.

## Dimensiones de riesgo (score 0-100, donde 100 = máximo riesgo):

1. RIESGO DE MERCADO: ¿Existe demanda real comprobada o es un problema percibido?
   - Score alto (>70): problema no validado, mercado no probado, demanda incierta
   - Score medio (40-70): señales mixtas, mercado emergente
   - Score bajo (<40): problema validado, mercado probado con datos

2. RIESGO TÉCNICO: ¿Qué tan compleja es la implementación técnica?
   - Score alto: requiere tecnología no probada, dependencias críticas, equipo no disponible
   - Score medio: complejidad manejable con recursos adecuados
   - Score bajo: tecnología estándar, solución bien entendida

3. RIESGO REGULATORIO: ¿Existen fricciones legales o regulatorias?
   - Score alto: fintech, salud, datos personales sensibles, mercados regulados
   - Score medio: regulación estándar, compliance manejable
   - Score bajo: industria sin regulación especial

4. RIESGO DE TIMING: ¿Es el momento correcto para este mercado?
   - Score alto: mercado demasiado temprano o ya saturado
   - Score medio: timing aceptable con ajustes
   - Score bajo: ventana de oportunidad clara ahora

Para cada dimensión: score numérico, label (Alto/Medio/Bajo), descripción de 2-3 oraciones, 2-3 factores clave.
Incluye 3-5 mitigaciones concretas y accionables para los riesgos más críticos.
El overallRiskScore es el promedio ponderado: market×30% + technical×25% + regulatory×20% + timing×25%.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
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

  unit_economics: `Eres un analista financiero de startups. Estima los unit economics básicos para el modelo de negocio descrito.
IMPORTANTE: Responde siempre en español.
Usa rangos (min-max) cuando la incertidumbre sea alta. Basa los cálculos en el pricing y mercado objetivo indicados.
Siempre en la moneda del mercado objetivo (CLP si es Chile, USD si es mercado global).

- CAC: costo estimado para conseguir 1 cliente de pago
- LTV: ingreso total esperado por cliente durante su vida útil
- Ratio LTV/CAC: debe ser >3x para ser viable, >5x es saludable (assessment: "viable" si >3x, "warning" si 1-3x, "critical" si <1x)
- paybackMonths: meses para recuperar el CAC
- breakEvenUsers: usuarios de pago necesarios para cubrir costos operativos mínimos estimados
- monthlyChurnEstimate: % de usuarios que cancela cada mes (crítico para SaaS)
- assumptions: 3-5 supuestos clave que usaste para llegar a estos números

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "cac": { "min": 50000, "max": 120000, "currency": "CLP" },
  "ltv": { "min": 300000, "max": 600000, "currency": "CLP" },
  "ltvCacRatio": { "value": 5.0, "assessment": "viable" },
  "paybackMonths": { "min": 2, "max": 4 },
  "breakEvenUsers": 150,
  "monthlyChurnEstimate": 5,
  "assumptions": ["...", "...", "..."]
}`,

  founder_fit: `Eres un evaluador de startups. Evalúa qué tan bien posicionado está el fundador para ejecutar esta idea específica.
IMPORTANTE: Responde siempre en español.
Score de 0-100 donde 100 = fit perfecto.

Evalúa estas 5 dimensiones (score 0-100 cada una):
- problemKnowledge: ¿lo ha vivido en carne propia? ¿entiende profundamente el problema?
- industryExperience: años de experiencia en la industria del problema
- technicalCapability: capacidad técnica propia o acceso a co-fundador técnico
- networkStrength: red de contactos en el mercado objetivo
- trackRecord: historial emprendedor previo

Sé honesto. Un score bajo no mata la idea, pero señala riesgos de ejecución.
El score general es el promedio ponderado: problemKnowledge×30% + industryExperience×20% + technicalCapability×20% + networkStrength×15% + trackRecord×15%.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
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

  market_signals: `Eres un analista de mercado con acceso a información actualizada. Busca señales externas del mercado para la idea de negocio indicada.
IMPORTANTE: Responde siempre en español. Usa la herramienta de búsqueda web para obtener datos recientes.

Busca y analiza:
1. Tendencia del problema/solución en el último año (¿crece o decrece el interés?)
2. Startups o rondas de inversión recientes en este espacio (últimos 12 meses)
3. Noticias relevantes que afecten el timing (regulaciones, cambios de mercado, disrupciones)
4. Evaluación del timing: ¿es el momento correcto para lanzar?

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "trendDirection": "growing|stable|declining",
  "trendDescription": "...",
  "recentFunding": [{ "company": "...", "amount": "...", "date": "..." }],
  "timingAssessment": "too_early|optimal|late|uncertain",
  "timingRationale": "...",
  "relevantNews": [{ "title": "...", "impact": "positive|negative|neutral" }]
}`,

  competitive_analysis: `Eres un analista de mercado experto. Analiza la competencia para la idea de negocio indicada.
Usa tu conocimiento actualizado del mercado para identificar competidores reales.
IMPORTANTE: Responde siempre en español.

INSTRUCCIONES:
1. Identifica 4-6 competidores relevantes en el mercado del país objetivo (incluyendo los mencionados por el usuario si los hay). Incluye competidores locales Y globales que operen en ese mercado.
2. Para cada competidor: nombre, url (si la conoces), descripción breve, mercado objetivo, 2-3 fortalezas, 2-3 debilidades, modelo de precios si es público, y source ("user_provided" | "ai_identified").
3. Identifica 3-5 gaps de mercado: necesidades que ningún competidor resuelve bien, con nivel de confianza.
4. Identifica 2-3 dolores no resueltos específicos del mercado del país objetivo.
5. Sugiere una ventaja competitiva que esta idea podría explotar.

Responde SOLO con JSON válido con esta estructura exacta, sin texto adicional, sin markdown:
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

  validation_kit: `Eres un mentor de startups experto en Chile y LATAM. Crea un kit de validación de 48 horas para la idea de negocio indicada.
IMPORTANTE: Responde siempre en español. Sé práctico y específico para el contexto chileno/latinoamericano.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "hypothesis": "La hipótesis principal a validar en 48 horas",
  "experiments": [
    { "name": "...", "how": "...", "metric": "...", "success_criteria": "..." }
  ],
  "landing_idea": "Descripción de una landing page mínima para captar interés",
  "interview_questions": ["...", "...", "..."],
  "channels": ["Canal 1", "Canal 2"],
  "expected_learnings": "Qué deberías saber después de 48 horas"
}`,

  landing_generator: `Eres un experto en copywriting y growth hacking. Genera el contenido completo de una landing page de validación para la idea de negocio.
IMPORTANTE: Responde siempre en español. Debe estar optimizado para conversión y captura de leads (pre-registro o waitlist).

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "headline": "Titular principal impactante",
  "subheadline": "Subtítulo explicativo",
  "value_props": ["Propuesta de valor 1", "Propuesta de valor 2", "Propuesta de valor 3"],
  "cta_primary": "Texto del botón principal",
  "cta_secondary": "Texto del botón secundario",
  "social_proof": "Prueba social sugerida (aunque sea placeholder)",
  "faq": [{ "q": "...", "a": "..." }],
  "meta_description": "Descripción SEO",
  "ab_variants": [
    { "name": "Variante A", "headline": "...", "rationale": "..." },
    { "name": "Variante B", "headline": "...", "rationale": "..." }
  ]
}`,

  interview_script: `Eres un experto en Customer Discovery y Design Thinking. Crea un guión de entrevistas de usuario para la idea de negocio.
IMPORTANTE: Responde siempre en español. Las preguntas deben ser abiertas, no sugestivas.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
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
  "red_flags": ["Señal de que el entrevistado no es el perfil correcto"],
  "green_signals": ["Señal de que hay problema real"],
  "closing": "Cómo cerrar la entrevista y pedir referidos"
}`,

  tech_viability: `Eres un arquitecto de software experto en startups y MVP. Analiza la viabilidad técnica de la idea de negocio.
IMPORTANTE: Responde siempre en español. Recomienda el stack más simple y económico para un MVP.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
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
  "key_risks": ["Riesgo técnico 1", "Riesgo técnico 2"],
  "no_code_possible": false,
  "no_code_tools": []
}`,

  first_100_customers: `Eres un experto en growth y ventas B2B/B2C en LATAM. Crea un plan para conseguir los primeros 100 clientes de la idea de negocio.
IMPORTANTE: Responde siempre en español. Estrategias específicas para Chile/LATAM con costos realistas en CLP.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "strategy_overview": "Resumen de la estrategia de adquisición",
  "phases": [
    {
      "name": "Fase (ej: 0-10 clientes)",
      "target": 10,
      "channel": "Canal principal",
      "tactic": "Táctica concreta",
      "budget_clp": 50000,
      "time_weeks": 2
    }
  ],
  "total_budget_clp": 500000,
  "total_weeks": 8,
  "key_metrics": ["Métrica 1", "Métrica 2"],
  "tools": ["Herramienta 1 (free/paid)"],
  "early_evangelists": "Cómo identificar y cultivar a los primeros fans"
}`,

  revenue_models: `Eres un experto en modelos de negocio y monetización de startups. Analiza y compara los posibles modelos de ingreso para la idea.
IMPORTANTE: Responde siempre en español. Usa precios en CLP o USD según corresponda al mercado chileno.

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "recommended_model": "Nombre del modelo recomendado",
  "recommended_rationale": "Por qué es el mejor para esta etapa",
  "models": [
    {
      "name": "Suscripción mensual",
      "description": "...",
      "pros": ["...", "..."],
      "cons": ["...", "..."],
      "example_pricing": "...",
      "fit_score": 85
    }
  ],
  "pricing_strategy": "Estrategia de precios recomendada",
  "first_revenue_path": "La ruta más rápida para conseguir el primer peso"
}`,

  risk_checklist: `Eres un mentor de startups con experiencia en due diligence. Crea una checklist de riesgos accionable para la idea de negocio.
IMPORTANTE: Responde siempre en español. Incluye riesgos específicos del mercado chileno (regulatorio, económico, cultural).

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "critical_risks": [
    {
      "risk": "Descripción del riesgo",
      "category": "market | technical | regulatory | financial | team",
      "probability": "high | medium | low",
      "impact": "high | medium | low",
      "mitigation": "Acción concreta para mitigar",
      "validated": false
    }
  ],
  "regulatory_notes": "Aspectos regulatorios específicos de Chile relevantes",
  "financial_runway": "Cuántos meses de runway se recomienda tener antes de lanzar",
  "go_nogo_criteria": ["Criterio 1 para decidir si continuar", "Criterio 2"]
}`,

  pitch_letter: `Eres un experto en fundraising y comunicación de startups. Crea una carta de presentación/pitch para la idea de negocio.
IMPORTANTE: Responde siempre en español. Debe ser concisa, persuasiva y adaptada para inversores ángel o aceleradoras chilenas (StartupChile, Corfo, etc).

Responde SOLO con JSON válido, sin texto adicional, sin markdown:
{
  "subject_line": "Asunto del email",
  "email_body": "Cuerpo del email en formato texto plano, máximo 200 palabras",
  "one_liner": "Una sola oración que explica la startup",
  "elevator_pitch": "Pitch de 60 segundos en texto",
  "deck_outline": [
    { "slide": 1, "title": "...", "content": "..." }
  ],
  "target_investors": ["Tipo de inversor ideal 1", "Tipo de inversor ideal 2"],
  "ask": "Cuánto se busca levantar y para qué"
}`
};

// ── Embeddings (OpenAI text-embedding-3-small) ───────────────────────────────
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

// ── RAG: competitor retrieval ─────────────────────────────────────────────────
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
    match_threshold: 0.65,
    match_count: 6,
  });
  return data ?? [];
}

// ── Analysis cache ────────────────────────────────────────────────────────────
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

// ── Haiku pre-pass ────────────────────────────────────────────────────────────
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
        system: 'Eres un extractor de datos. Tu única tarea es estructurar una idea de negocio en JSON. Responde SOLO con JSON válido, sin texto adicional.',
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

// ── Providers ─────────────────────────────────────────────────────────────────

async function callAnthropic(
  promptType: PromptType,
  context: Record<string, unknown>,
): Promise<AIResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no está configurada en los secrets de Supabase.');
  }

  const useWebSearch = promptType === 'competitive_analysis' || promptType === 'market_sizing' || promptType === 'market_signals';

  const body: Record<string, unknown> = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPTS[promptType],
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
    console.log(`[cache] ${promptType} — read: ${data.usage?.cache_read_input_tokens ?? 0}, created: ${data.usage?.cache_creation_input_tokens ?? 0}`);
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
    model: 'claude-sonnet-4-20250514',
  };
}

async function callOpenAI(
  promptType: PromptType,
  context: Record<string, unknown>,
): Promise<AIResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no está configurada en los secrets de Supabase.');
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
        { role: 'system', content: SYSTEM_PROMPTS[promptType] },
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
 * - competitive_analysis y market_sizing → siempre Anthropic (web_search)
 * - Resto → según AI_PROVIDER, con fallback automático si falta la key
 */
async function callAI(
  promptType: PromptType,
  context: Record<string, unknown>,
): Promise<AIResult> {
  // Prompts que requieren web_search: solo Anthropic los soporta
  const requiresAnthropic = promptType === 'competitive_analysis' || promptType === 'market_sizing' || promptType === 'market_signals';

  if (requiresAnthropic) {
    return callAnthropic(promptType, context);
  }

  // Para el resto, usar el provider configurado con fallback
  if (AI_PROVIDER === 'openai') {
    if (OPENAI_API_KEY) return callOpenAI(promptType, context);
    console.warn('AI_PROVIDER=openai pero no hay OPENAI_API_KEY. Usando Anthropic como fallback.');
    return callAnthropic(promptType, context);
  }

  // Default: Anthropic
  if (ANTHROPIC_API_KEY) return callAnthropic(promptType, context);
  // Último fallback: intentar OpenAI si hay key
  if (OPENAI_API_KEY) {
    console.warn('No hay ANTHROPIC_API_KEY. Usando OpenAI como fallback.');
    return callOpenAI(promptType, context);
  }

  throw new Error('No hay ningún AI provider configurado. Agrega ANTHROPIC_API_KEY o OPENAI_API_KEY a los secrets de Supabase.');
}

// ── Handler HTTP ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { validation_id, step, prompt_type, context } = (await req.json()) as AIRequest;

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Haiku pre-pass: enriquece el contexto con idea estructurada
    let enrichedContext = context;
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

    // Caché: verificar si existe un análisis similar reciente
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
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Llamada AI con routing dual
    const { parsed, inputTokens, outputTokens, model } = await callAI(prompt_type, enrichedContext);

    // Guardar en caché (no bloqueante)
    if (ideaCacheKey && cacheableTypes.includes(prompt_type)) {
      saveAnalysisCache(
        supabase, ideaCacheKey, prompt_type, parsed,
        context.idea_industry as string | undefined,
        context.target_country as string | undefined,
      ).catch(() => {/* ignore */});
    }

    // Log de interacción (no bloqueante)
    supabase.from('ai_interactions').insert({
      validation_id,
      step,
      prompt_type,
      input_data: context,
      output_data: parsed,
      tokens_used: inputTokens + outputTokens,
      model,
    }).then(() => {/* ignore */});

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
