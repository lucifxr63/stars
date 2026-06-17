import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { phCapture } from '../_shared/posthog.ts';
import { fetchBralidusContextForPrompt, BRALIDUS_CITE_DIRECTIVE } from '../_shared/bralidus.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { type PromptType, SYSTEM_PROMPTS, PLAYBOOK_MASTER_PROMPT } from '../_shared/prompts.ts';
import { buildUserContent, extractJSON } from '../_shared/promptContext.ts';
import { CAC_MULTIPLIERS_BY_CHANNEL, SECTOR_BENCHMARKS } from '../_shared/benchmarks.ts';

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
