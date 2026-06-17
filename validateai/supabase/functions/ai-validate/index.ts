import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { phCapture } from '../_shared/posthog.ts';
import { fetchBralidusContextForPrompt, BRALIDUS_CITE_DIRECTIVE } from '../_shared/bralidus.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { type PromptType, SYSTEM_PROMPTS, PLAYBOOK_MASTER_PROMPT } from '../_shared/prompts.ts';

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

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// Bloque dedicado para founder_fit (modelo HÍBRIDO). Surface explícito de dos
// fuentes complementarias:
//  1) PERFIL DEL FUNDADOR (nivel usuario, founder_profiles): identidad persistente
//     del fundador — experiencia, red, track record. Vía LinkedIn o carga manual.
//     Es la ÚNICA señal disponible en el flujo premium (sin Paso Fundador).
//  2) DATOS DE ESTA IDEA (wizard, solo flujo detallado): equipo, tracción y
//     problem-fit específicos de la startup que se está validando.
function buildFounderContext(ctx: Record<string, unknown>): string {
  const fc = (ctx.founder_context ?? {}) as Record<string, unknown>;
  const pick = (...vals: unknown[]) =>
    vals.find((v) => v !== undefined && v !== null && v !== '') ?? 'No especificado';

  const hasProfile =
    ctx.founder_linkedin_url || ctx.founder_full_name || ctx.founder_competency_scores ||
    ctx.founder_industry_years;
  const hasWizard =
    fc.personallyFacedProblem !== undefined || fc.yearsInIndustry !== undefined ||
    ctx.team_composition || ctx.traction_status;

  const lines: string[] = [];

  // ── Fuente 1: perfil del fundador a nivel usuario ──────────────────────────
  if (hasProfile) {
    const src = ctx.founder_linkedin_url ? 'LinkedIn verificado' : 'carga manual';
    lines.push(
      `PERFIL DEL FUNDADOR (nivel usuario — fuente: ${src}; identidad estable, válida para CUALQUIER idea):`,
      `- Nombre: ${ctx.founder_full_name ?? 'No disponible'}`,
      `- Headline: ${ctx.founder_headline ?? 'No disponible'}`,
      `- Bio: ${ctx.founder_summary_bio ?? 'No disponible'}`,
      `- Años en la industria: ${ctx.founder_industry_years ?? 'No disponible'}`,
    );
    if (Array.isArray(ctx.founder_skills) && ctx.founder_skills.length) {
      lines.push(`- Skills: ${(ctx.founder_skills as string[]).join(', ')}`);
    }
    if (Array.isArray(ctx.founder_work_experience) && ctx.founder_work_experience.length) {
      lines.push(`- Experiencia laboral: ${JSON.stringify(ctx.founder_work_experience)}`);
    }
    if (ctx.founder_competency_scores) {
      lines.push(
        `- Competency scores pre-calculados (0-100): ${JSON.stringify(ctx.founder_competency_scores)}.`,
        '  Úsalos como ancla: visionComercial≈networkStrength, capacidadTecnica≈technicalCapability,',
        '  liderazgo+resilienciaOperativa≈trackRecord, experienciaIndustria≈industryExperience.',
      );
    }
    lines.push('');
  }

  // ── Fuente 2: datos específicos de esta idea (wizard) ──────────────────────
  lines.push('DATOS DE ESTA IDEA (autoreporte del wizard — específicos de la startup validada):');
  lines.push(
    `- ¿Vivió el problema en carne propia? (personallyFacedProblem): ${pick(fc.personallyFacedProblem, ctx.personallyFacedProblem)}`,
    `- Años de experiencia en la industria (yearsInIndustry): ${pick(fc.yearsInIndustry, ctx.yearsInIndustry)}`,
    `- Composición del equipo (team_composition): ${pick(ctx.team_composition, fc.team_composition)}`,
    `- Nivel técnico del equipo (tech_level): ${pick(ctx.tech_level, fc.tech_level)}`,
    `- Estado de tracción (traction_status): ${pick(ctx.traction_status, fc.traction_status)}`,
    `- Dedicación al proyecto (commitment_level): ${pick(fc.commitment_level, ctx.commitment_level)}`,
    `- Entrevistas con clientes (customer_interviews): ${pick(fc.customer_interviews, ctx.customer_interviews)}`,
    `- Ventaja diferencial (unfair_advantage): ${pick(fc.unfair_advantage, ctx.unfair_advantage)}`,
  );

  // ── Guía de fusión híbrida ─────────────────────────────────────────────────
  lines.push('');
  if (hasProfile && hasWizard) {
    lines.push(
      'FUSIÓN: combina ambas fuentes. El PERFIL define la identidad del fundador (industryExperience,',
      'networkStrength, technicalCapability, trackRecord de carrera); los DATOS DE ESTA IDEA ajustan',
      'problemKnowledge, technicalCapability del equipo y trackRecord de tracción de esta startup.',
    );
  } else if (hasProfile && !hasWizard) {
    lines.push(
      'FUSIÓN: NO hay datos del wizard (flujo premium). Evalúa con el PERFIL del fundador como fuente',
      'principal — usa los competency scores y la experiencia laboral para estimar las 5 dimensiones.',
    );
  } else {
    lines.push(
      'FUSIÓN: NO hay perfil de fundador a nivel usuario. Evalúa solo con los DATOS DE ESTA IDEA del wizard.',
    );
  }

  return lines.join('\n');
}

// Construye el contenido del mensaje de usuario. Para founder_fit antepone el
// bloque explícito de fundador; el resto de prompts mantienen el comportamiento previo.
function buildUserContent(promptType: PromptType, context: Record<string, unknown>): string {
  const base = `${buildMarketContext(context)}\n\n${JSON.stringify(context)}`;
  return promptType === 'founder_fit'
    ? `${buildFounderContext(context)}\n\n${base}`
    : base;
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

// ── Defensa Nivel 1: ruteo de modelo + throttle dinámico de costo ─────────────
// Centraliza la selección de modelo (antes inline en callAnthropic). Permite un
// downgrade dinámico ante picos de burn rate SIN redeploy: Ops setea
// THROTTLE_MODE=on y los prompts estándar no-premium caen a Haiku.
// Default 'off' → comportamiento IDÉNTICO a producción actual (switch inerte).
// Sonnet queda reservado al flujo premium (premium-validate, función aparte) y a
// los prompts con web_search (bajo volumen, calidad de búsqueda crítica).
const MODEL_SONNET = 'claude-sonnet-4-20250514';
const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const THROTTLE_MODE = (Deno.env.get('THROTTLE_MODE') ?? 'off') as 'on' | 'off';

function usesWebSearch(promptType: PromptType): boolean {
  return promptType === 'competitive_analysis'
    || promptType === 'market_sizing'
    || promptType === 'market_signals';
}

function selectModel(promptType: PromptType, tier?: 'free' | 'basic' | 'pro'): string {
  // Regla base (inmutable): free y summary_quick ya usan Haiku por estrategia de coste.
  if (tier === 'free' || promptType === 'summary_quick') return MODEL_HAIKU;
  // Throttle dinámico: bajo presión de caja, basic/pro estándar → Haiku.
  // Los prompts con web_search se mantienen en Sonnet (bajo volumen, calidad crítica).
  if (THROTTLE_MODE === 'on' && !usesWebSearch(promptType)) return MODEL_HAIKU;
  return MODEL_SONNET;
}

async function callAnthropic(
  promptType: PromptType,
  context: Record<string, unknown>,
  systemOverride?: string,
  tier?: 'free' | 'basic' | 'pro',
): Promise<AIResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no estÃ¡ configurada en los secrets de Supabase.');
  }

  const useWebSearch = usesWebSearch(promptType);
  const selectedModel = selectModel(promptType, tier);

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
        content: buildUserContent(promptType, context),
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
          content: buildUserContent(promptType, context),
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
  const requiresAnthropic = usesWebSearch(promptType);

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
