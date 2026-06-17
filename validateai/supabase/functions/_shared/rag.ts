// Capa RAG + caché de análisis, extraída de ai-validate (#5 W2).
// Bodies byte-identical; única dep externa relocada: OPENAI_API_KEY.
// El cliente supabase se recibe por parámetro (sin estado de módulo).
import type { PromptType } from './prompts.ts';
import type { StructuredIdea } from './types.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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
export async function retrieveRelevantCompetitors(
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
export const RAG_TAGS_BY_PROMPT: Partial<Record<PromptType, string[]>> = {
  playbook_analysis:    ['VALIDATION', 'MOM_TEST', 'JTBD', 'UNIT_ECONOMICS', 'FINANCE', 'LEGAL', 'CHILE', 'TECH', 'NO_CODE', 'MVP', 'GROWTH', 'GTM', 'B2B_SALES', 'PLG', 'FUNDING', 'VC', 'PITCH_DECK', 'LATAM', 'PRODUCT_STRATEGY', 'AI', 'BLUE_OCEAN', 'UX', 'PSYCHOLOGY', 'BIASES', 'FOUNDER_RISK', 'POST_MORTEM'],
  validation_kit:       ['VALIDATION', 'MOM_TEST', 'JTBD'],
  unit_economics:       ['UNIT_ECONOMICS', 'FINANCE', 'BENCHMARKS', 'LATAM'],
  risk_checklist:       ['LEGAL', 'CHILE', 'COMPLIANCE'],
  tech_viability:       ['TECH', 'NO_CODE', 'MVP', 'ARCHITECTURE'],
  governance_assessment: ['LEGAL', 'CHILE', 'FINTECH', 'COMPLIANCE', 'LATAM'],
  fundraising_roadmap:   ['FUNDING', 'VC', 'LATAM', 'CHILE', 'UNIT_ECONOMICS', 'FINANCE', 'BENCHMARKS'],
};

export async function retrieveRagPlaybooks(
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

export function extractVaultEntities(queryText: string): string[] {
  return ENTITY_MAP
    .filter(([pattern]) => pattern.test(queryText))
    .map(([, title]) => title);
}

export async function retrieveHybridGraphRAG(
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
export async function checkAnalysisCache(
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

export async function saveAnalysisCache(
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

