import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Config ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_KEY   = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_API_KEY  = Deno.env.get('OPENAI_API_KEY');     // para embeddings
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

// Umbrales de caché: 0.92 para due diligence (mayor rigor = menos falsos positivos).
// Un score 0.92 implica que dos ideas son ~92% semánticamente idénticas — seguro
// para reutilizar un análisis legal/financiero sin riesgo de resultado incorrecto.
const CACHE_TYPE      = 'due_diligence';
const CACHE_THRESHOLD = 0.92;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// ── Embeddings ────────────────────────────────────────────────────────────────
// Usa text-embedding-3-small de OpenAI (1536d) — mismo modelo que el resto del proyecto.
// Si OPENAI_API_KEY no está configurada, las funciones de caché y RAG se saltean
// sin crashear (degraded gracefully).
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ── S5-A: filterRelevantContext ───────────────────────────────────────────────
// Determina qué fuentes de datos son necesarias para ESTE usuario en ESTE momento.
// Objetivo: no gastar tokens ni latencia en fuentes que no aportarán señal analítica.

type DataSource = 'sii' | 'inapi' | 'fintoc' | 'pjud' | 'cmf_best';

interface ContextFilter {
  sources: Set<DataSource>;
  skipped: { source: DataSource; reason: string }[];
}

function filterRelevantContext(params: {
  currentStep: string;
  tier: string;
  hasRevenue: boolean;
  rutEmpresa: string | null;
  brandName: string | null;
  targetCountry: string | null;
}): ContextFilter {
  const { currentStep, tier, hasRevenue, rutEmpresa, brandName, targetCountry } = params;
  const sources = new Set<DataSource>();
  const skipped: { source: DataSource; reason: string }[] = [];

  // ── SII: siempre incluir si hay RUT disponible ────────────────────────────
  // El estado tributario es señal de riesgo base — independiente de etapa y tier.
  if (rutEmpresa) {
    sources.add('sii');
  } else {
    skipped.push({ source: 'sii', reason: 'RUT de empresa no proporcionado' });
  }

  // ── INAPI: solo si hay nombre de marca definido ───────────────────────────
  if (brandName) {
    sources.add('inapi');
  } else {
    skipped.push({ source: 'inapi', reason: 'Nombre de marca no proporcionado' });
  }

  // ── Fintoc: solo para startups con ventas declaradas y tier Pro/Premium ───
  // Una startup pre-revenue sin cuenta bancaria activa no tiene movimientos útiles.
  // El análisis de flujo de caja solo es accionable cuando ya hay ingresos.
  const fintocTiers = ['pro', 'premium', 'admin'];
  if (hasRevenue && fintocTiers.includes(tier)) {
    sources.add('fintoc');
  } else if (!hasRevenue) {
    skipped.push({ source: 'fintoc', reason: 'Startup pre-revenue: Open Banking no aplica' });
  } else {
    skipped.push({ source: 'fintoc', reason: `Tier ${tier}: Open Banking requiere Pro/Premium` });
  }

  // ── PJUD: solo en etapas avanzadas del wizard y tier Premium ─────────────
  // El historial judicial es relevante en due diligence final (stepFounder en adelante),
  // no en las primeras etapas de ideación donde la empresa puede no estar constituida.
  const advancedSteps = new Set(['stepFounder', 'stepGrowth', 'stepFunding', 'complete']);
  const pjudTiers = ['premium', 'admin'];
  if (advancedSteps.has(currentStep) && pjudTiers.includes(tier)) {
    sources.add('pjud');
  } else if (!advancedSteps.has(currentStep)) {
    skipped.push({ source: 'pjud', reason: `Etapa "${currentStep}": PJUD se activa desde stepFounder` });
  } else {
    skipped.push({ source: 'pjud', reason: `Tier ${tier}: historial judicial requiere Premium` });
  }

  // ── CMF BEST: indicadores del mercado financiero chileno ─────────────────
  // Solo aplica a startups chilenas. Siempre activo cuando el país es Chile,
  // independiente del tier: el contexto de TMC y solvencia bancaria es señal base.
  if (targetCountry?.toUpperCase() === 'CL' || targetCountry?.toLowerCase() === 'chile') {
    sources.add('cmf_best');
  } else {
    skipped.push({ source: 'cmf_best', reason: `País "${targetCountry ?? 'N/D'}": BEST CMF aplica solo a Chile` });
  }

  return { sources, skipped };
}

// ── S5-B: Due Diligence Cache ─────────────────────────────────────────────────
// Antes de llamar a Claude, verifica si ya existe un análisis semánticamente similar
// en cached_analyses (TTL 30 días, umbral 0.92). Ahorra ~$0.015 por validación
// reutilizada y baja latencia de ~25s a <100ms para ideas procesadas previamente.

async function checkDueDiligenceCache(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ideaText: string,
): Promise<Record<string, unknown> | null> {
  const embedding = await generateEmbedding(ideaText);
  if (!embedding) return null;

  const { data } = await supabase.rpc('search_cached_analyses', {
    query_embedding: embedding,
    match_threshold: CACHE_THRESHOLD,
    match_count: 1,
    filter_type: CACHE_TYPE,
  });

  return (data?.[0]?.analysis_data as Record<string, unknown>) ?? null;
}

async function saveDueDiligenceCache(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ideaText: string,
  result: Record<string, unknown>,
  industry?: string,
  geography?: string,
): Promise<void> {
  const embedding = await generateEmbedding(ideaText);
  if (!embedding) return;

  await supabase.from('cached_analyses').insert({
    idea_embedding: embedding,
    prompt_type: CACHE_TYPE,
    analysis_data: result,
    industry,
    geography,
  }).select().single();
}

// ── S5-C: Knowledge Base RAG (HNSW semantic search) ──────────────────────────
// Recupera los 3 chunks más relevantes de knowledge_base usando pgvector HNSW.
// Reemplaza la inyección de contexto fijo por recuperación dinámica y semántica:
// el prompt recibe solo la inteligencia legal/de mercado pertinente a ESTA idea,
// reduciendo tokens de contexto fijo ~800 → ~300 tokens de RAG dirigido.

interface KnowledgeChunk {
  title: string;
  source: string;
  category: string;
  content: string;
  similarity: number;
}

async function searchKnowledgeBase(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ideaName: string,
  industry: string,
): Promise<string> {
  const queryText = `${ideaName} ${industry}`.trim();
  const embedding = await generateEmbedding(queryText);
  if (!embedding) return '';

  // Mapeo de industria a categoría para pre-filtrar antes del vector search.
  // El índice GIN de tags hace este filtro en O(1) antes del scan HNSW.
  const regulatedIndustries = new Set(['fintech', 'salud', 'healthtech', 'educación', 'agtech']);
  const filterCategory = regulatedIndustries.has(industry.toLowerCase()) ? 'regulatory' : null;

  const { data, error } = await supabase.rpc('search_knowledge_base', {
    query_embedding: embedding,
    filter_category: filterCategory,
    filter_tags: null,
    match_threshold: 0.50,
    match_count: 3,
  });

  if (error || !data || data.length === 0) return '';

  return (data as KnowledgeChunk[])
    .map(chunk =>
      `[${chunk.title} — Fuente: ${chunk.source} | Similitud: ${(chunk.similarity * 100).toFixed(0)}%]\n${chunk.content}`
    )
    .join('\n\n');
}

// ── Circuit Breaker ───────────────────────────────────────────────────────────
// Patrón explícito de tolerancia a fallos para llamadas a fuentes externas.
// Si la fuente falla o supera el timeout, retorna { ok: false } sin crashear el flujo.
// Promise.allSettled() en el handler garantiza que TODOS los breakers se ejecuten
// en paralelo y sus fallos se conviertan en dataWarnings, no en excepciones.
async function withCircuitBreaker<T>(
  sourceName: string,
  fn: () => Promise<T>,
  timeoutMs = 10_000,
): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
    );
    const data = await Promise.race([fn(), timeoutPromise]);
    return { ok: true, data };
  } catch (err) {
    const reason = (err as Error).message ?? 'fuente no disponible';
    console.warn(`[CircuitBreaker:${sourceName}] abierto — ${reason}`);
    return { ok: false, reason };
  }
}

// ── Internal edge-function caller ─────────────────────────────────────────────
async function callEdgeFunction(name: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} HTTP ${res.status}`);
  const data = await res.json();
  if (data.available === false) throw new Error(`${name}: ${data.reason ?? 'integration_pending'}`);
  return data;
}

// ── temp_context reader ───────────────────────────────────────────────────────
async function readTempContext(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  validationId: string,
  source: string,
): Promise<unknown> {
  const { data, error } = await supabase
    .from('temp_context')
    .select('payload, status')
    .eq('validation_id', validationId)
    .eq('source', source)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`temp_context(${source}): ${error.message}`);
  if (!data)  throw new Error(`${source}: webhook no recibido`);
  return data.payload;
}

// ── Context compressors ───────────────────────────────────────────────────────
// Cada compresor extrae la señal analítica relevante y descarta el ruido.
// Presupuesto: ≤ 250 tokens por fuente → ≤ 1.000 tokens de datos externos totales.

function compressSii(raw: Record<string, unknown>): string {
  const d = (raw.data ?? raw) as Record<string, unknown>;
  const giros = (d.actividades_economicas as Array<{ codigo: string; descripcion: string }> ?? [])
    .slice(0, 3)
    .map(a => `(${a.codigo}) ${a.descripcion}`)
    .join('; ') || 'N/D';
  const riesgo = (raw.risk_classification as Record<string, string>)?.nivel ?? 'Indeterminado';
  return [
    '[SII — Empresa Verificada]',
    `RUT: ${d.rut} | Razón social: ${d.razon_social}`,
    `Estado tributario: ${d.estado_tributario} | Inicio actividades: ${d.inicio_actividades ?? 'N/D'}`,
    `Giros: ${giros}`,
    `Anotaciones vigentes: ${d.anotaciones_vigentes ? 'SÍ ⚠️' : 'No'} | Riesgo tributario: ${riesgo}`,
  ].join('\n');
}

function compressInapi(raw: Record<string, unknown>): string {
  const colisiones = (raw.colisiones as Array<Record<string, unknown>> ?? []);
  if (colisiones.length === 0) {
    return `[INAPI — Marcas] "${raw.brand_name}": 0 colisiones activas — denominación aparentemente disponible.`;
  }
  const top = colisiones.slice(0, 4)
    .map(c => `  • "${c.denominacion}" | Estado: ${c.estado} | Titular: ${c.titular} | Clases: ${c.clases}`)
    .join('\n');
  return [
    `[INAPI — Marcas] "${raw.brand_name}" | Riesgo: ${raw.risk_level} | ${colisiones.length} colisión(es):`,
    top,
    colisiones.length > 4 ? `  ... +${colisiones.length - 4} más.` : '',
  ].filter(Boolean).join('\n');
}

function compressFintoc(payload: Record<string, unknown>): string {
  const movements = (payload.movements as Array<Record<string, unknown>> ?? []);
  if (movements.length === 0) return '[Fintoc] Sin movimientos disponibles.';
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recent  = movements.filter(m => new Date(m.post_date as string).getTime() > cutoff);
  const inflow  = recent.filter(m => (m.amount as number) > 0).reduce((s, m) => s + (m.amount as number), 0);
  const outflow = recent.filter(m => (m.amount as number) < 0).reduce((s, m) => s + (m.amount as number), 0);
  const senders = [...new Set(
    recent
      .filter(m => (m.amount as number) > 0 && m.sender_account)
      .map(m => (m.sender_account as Record<string, unknown>)?.holder_name as string)
      .filter(Boolean),
  )].slice(0, 5);
  return [
    `[Fintoc — Open Banking | 90 días]`,
    `Ingresos: CLP ${inflow.toLocaleString('es-CL')} | Egresos: CLP ${Math.abs(outflow).toLocaleString('es-CL')}`,
    `Movimientos: ${recent.length} | KYC RUT: ${payload.holder_rut ?? 'N/D'} | Banco: ${payload.institution ?? 'N/D'}`,
    senders.length ? `Emisores: ${senders.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

function compressPjud(payload: Record<string, unknown>): string {
  const causas  = (payload.causas as Array<Record<string, unknown>> ?? []);
  const activas = causas.filter(c => c.estado === 'activa' || c.estado === 'en tramitación');
  if (activas.length === 0) return '[PJUD] Sin causas activas registradas.';
  const top = activas.slice(0, 3)
    .map(c => `  • ${c.tipo} | ${c.materia} | Rol: ${c.rol} (${c.tribunal})`)
    .join('\n');
  return [
    `[PJUD — Historial Judicial] ⚠️ ${activas.length} causa(s) activa(s) de ${causas.length} totales:`,
    top,
    activas.length > 3 ? `  ... +${activas.length - 3} más.` : '',
  ].filter(Boolean).join('\n');
}

function compressCmfBest(payload: Record<string, unknown>): string {
  if (!payload.available) {
    return `[CMF BEST] ${(payload.reason as string) ?? 'Sin datos disponibles.'}`;
  }
  // Si el payload tiene summary pre-formateado (de cmf-best-fetch), usarlo directamente
  if (typeof payload.summary === 'string' && payload.summary.startsWith('[CMF BEST')) {
    return payload.summary;
  }
  // Fallback: construir desde indicators
  const ind = (payload.indicators as Record<string, { value: number | null; period: string; unit: string }>) ?? {};
  const lines = Object.entries(ind)
    .filter(([, v]) => v.value !== null)
    .map(([k, v]) => `  • ${k}: ${v.value?.toFixed(2)}${v.unit} (${v.period})`);
  if (lines.length === 0) return '[CMF BEST] Indicadores no disponibles.';
  return ['[CMF BEST — Mercado Financiero Chile]', ...lines].join('\n');
}

// ── Schema validator ──────────────────────────────────────────────────────────
// Valida que la respuesta de Claude tenga la estructura exacta de DueDiligenceScore
// (src/types/validation.ts). Lanza excepción descriptiva si el schema es inválido,
// lo que activa el bloque catch del handler y devuelve HTTP 500 con detalle del error.
// Evita que el frontend reciba un objeto malformado que causaría un crash silencioso.
function validateDueDiligenceSchema(raw: Record<string, unknown>): void {
  const requiredTop = ['total', 'dimensions', 'investorReadiness', 'topGaps', 'verdict_summary'];
  for (const key of requiredTop) {
    if (!(key in raw)) throw new Error(`DueDiligenceScore: campo requerido ausente: "${key}"`);
  }

  const total = raw.total as unknown;
  if (typeof total !== 'number' || (total as number) < 0 || (total as number) > 100) {
    throw new Error(`DueDiligenceScore: "total" debe ser número 0-100, recibido: ${JSON.stringify(total)}`);
  }

  const dims = raw.dimensions;
  if (!dims || typeof dims !== 'object') {
    throw new Error('DueDiligenceScore: "dimensions" debe ser un objeto');
  }
  const requiredDims = ['financiero', 'legal', 'mercado', 'equipo', 'traccion'];
  for (const k of requiredDims) {
    const dim = (dims as Record<string, unknown>)[k] as Record<string, unknown> | undefined;
    if (!dim) throw new Error(`DueDiligenceScore: dimensión requerida ausente: "${k}"`);
    if (typeof dim.score !== 'number') throw new Error(`DueDiligenceScore: "${k}.score" debe ser número, recibido: ${JSON.stringify(dim.score)}`);
    if (!Array.isArray(dim.gaps))      throw new Error(`DueDiligenceScore: "${k}.gaps" debe ser array`);
  }

  const validReadiness = ['not_ready', 'early', 'developing', 'ready'];
  if (!validReadiness.includes(raw.investorReadiness as string)) {
    throw new Error(`DueDiligenceScore: "investorReadiness" inválido: "${raw.investorReadiness}". Válidos: ${validReadiness.join(', ')}`);
  }

  if (!Array.isArray(raw.topGaps)) {
    throw new Error('DueDiligenceScore: "topGaps" debe ser array');
  }
  if (typeof raw.verdict_summary !== 'string' || (raw.verdict_summary as string).length < 20) {
    throw new Error('DueDiligenceScore: "verdict_summary" debe ser string de al menos 20 caracteres');
  }
}

// ── Mega-prompt builder ───────────────────────────────────────────────────────
function buildMegaPrompt(
  validation: Record<string, unknown>,
  contextSections: string[],
  knowledgeChunks: string,
  dataWarnings: string[],
  skipped: { source: string; reason: string }[],
): { system: string; user: string } {
  const system = `Eres un analista de due diligence de venture capital de grado institucional, especializado en startups de Chile y Latinoamérica (2025-2026).
Tu análisis se basa EXCLUSIVAMENTE en los datos verificados provistos — nunca inventas métricas ni rellenas vacíos con optimismo.
Cuando los datos son parciales, ajustas score y data_completeness a la baja y lo señalas en verdict_summary.

REGLAS CRÍTICAS PARA FUENTES NO DISPONIBLES:
1. Si una sección del contexto dice "[fuente] Sin datos — fuente no disponible", esa AUSENCIA no implica score 0.
   Asigna la dimensión afectada en rango 30-55 con nota "información no verificada" en gaps.
   Un score 0 se reserva ÚNICAMENTE para riesgos confirmados y verificados (ej: deuda tributaria activa, causa judicial ejecutiva).
2. Los datos de CMF BEST son indicadores de referencia sistémica (TMC, tasas, solvencia bancaria).
   Si no están presentes en el contexto, NO descuentes puntos de "financiero" por su ausencia.
   Mencionarlos en verdict_summary solo si están disponibles.
3. Fuentes "excluidas por filtro adaptativo" (no requeridas por etapa/tier) no generan penalización.
4. NUNCA uses datos de CMF BEST para hacer afirmaciones sobre la startup específica — son benchmarks del sistema financiero chileno, no métricas de la empresa.

Responde SOLO con JSON válido, sin texto adicional, sin markdown.`;

  const warningBlock = dataWarnings.length > 0
    ? `\n[⚠️ ANÁLISIS CON DATOS PARCIALES]\n${dataWarnings.map(w => `• ${w}`).join('\n')}\n`
    : '\n[✓ Todas las fuentes disponibles]\n';

  const skippedBlock = skipped.length > 0
    ? `[Fuentes excluidas por filtro adaptativo]\n${skipped.map(s => `• ${s.source}: ${s.reason}`).join('\n')}\n`
    : '';

  const ragBlock = knowledgeChunks
    ? `\n[CONTEXTO REGULATORIO Y METODOLÓGICO — base de conocimiento ValidateAI]\n${knowledgeChunks}\n`
    : '';

  // El schema JSON debe coincidir EXACTAMENTE con la interfaz DueDiligenceScore
  // del frontend (src/types/validation.ts) para que DueDiligenceScoreCard renderice sin adaptación.
  const user = `IDEA: ${validation.idea_name ?? 'N/A'}
INDUSTRIA: ${validation.idea_industry ?? 'N/A'}
MODELO DE NEGOCIO: ${validation.business_model ?? 'N/A'}
ETAPA: ${validation.business_stage ?? 'N/A'}
PUNTOS DE DOLOR: ${((validation.customer_pain_points as string[]) ?? []).join(', ') || 'N/A'}
${warningBlock}
${skippedBlock}
${contextSections.filter(Boolean).join('\n\n')}
${ragBlock}
Responde SOLO con este JSON — cada campo es obligatorio:
{
  "total": 0-100,
  "dimensions": {
    "financiero": {
      "score": 0-100,
      "label": "Financiero",
      "gaps": ["Gap financiero concreto — citar dato de SII, Fintoc o CMF BEST si disponible"]
    },
    "legal": {
      "score": 0-100,
      "label": "Legal & Regulatorio",
      "gaps": ["Gap legal — citar ley aplicable (ej: Ley 21.719, Ley 21.521)"]
    },
    "mercado": {
      "score": 0-100,
      "label": "Mercado",
      "gaps": ["Gap de mercado o competencia detectado"]
    },
    "equipo": {
      "score": 0-100,
      "label": "Equipo",
      "gaps": ["Gap de equipo — track record, roles faltantes"]
    },
    "traccion": {
      "score": 0-100,
      "label": "Tracción",
      "gaps": ["Gap de tracción — MRR, clientes, LOIs, pilotos"]
    }
  },
  "investorReadiness": "not_ready",
  "topGaps": ["Gap 1 citando fuente de dato", "Gap 2 citando fuente de dato"],
  "verdict_summary": "80-120 palabras — citar fuentes disponibles y señalar las que faltaron",
  "red_flags": ["bandera roja con fuente citada"],
  "strengths": ["fortaleza con fuente citada"],
  "recommended_next_steps": ["paso accionable con dueño y plazo"]
}
Valores válidos para investorReadiness: not_ready, early, developing, ready
topGaps: máximo 5 elementos, ordenados de mayor a menor impacto en el fundraising`.trim();

  return { system, user };
}

// ── Claude caller ─────────────────────────────────────────────────────────────
async function callClaude(system: string, user: string): Promise<Record<string, unknown>> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const rawText = (data.content[0].text as string) ?? '';
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Claude no devolvió JSON válido. Respuesta: ${rawText.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]) as Record<string, unknown>;
  validateDueDiligenceSchema(parsed);
  return parsed;
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const {
      validation_id,
      rut_empresa,
      brand_name,
      current_step = 'stepIdea',
    } = await req.json();

    if (!validation_id) {
      return new Response(JSON.stringify({ error: 'validation_id requerido' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Cargar validación + tier del usuario en paralelo
    const [{ data: validation, error: validationError }, { data: profile }] = await Promise.all([
      supabase.from('validations').select('*').eq('id', validation_id).eq('user_id', user.id).single(),
      supabase.from('profiles').select('tier').eq('id', user.id).single(),
    ]);

    if (validationError || !validation) throw new Error('Validación no encontrada o sin acceso.');

    const tier = (profile?.tier as string) ?? 'free';
    const hasRevenue = Boolean(validation.has_revenue) ||
      (typeof validation.monthly_revenue === 'number' && (validation.monthly_revenue as number) > 0);

    // ── Rate Limiting (Sprint 8) ───────────────────────────────────────────────
    // Due diligence consume ~$0.015 USD/request (Claude Sonnet + embeddings).
    // Límites mensuales por tier para la Beta (ajustar con datos reales post-Fase 1).
    const DD_MONTHLY_LIMITS: Record<string, number> = {
      free:    2,
      basic:   5,
      pro:     10,
      premium: 999,
      admin:   999,
    };
    const ddLimit = DD_MONTHLY_LIMITS[tier] ?? 2;

    if (ddLimit < 999) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const { count: ddThisMonth } = await supabase
        .from('ai_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('prompt_type', 'due_diligence')
        .gte('created_at', monthStart.toISOString());

      if ((ddThisMonth ?? 0) >= ddLimit) {
        return new Response(JSON.stringify({
          error: 'rate_limit_monthly',
          message: `Límite mensual de ${ddLimit} Due Diligences para el plan ${tier} alcanzado.`,
          tier,
          limit: ddLimit,
          used: ddThisMonth,
        }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── S5-A: filtrado adaptativo de fuentes ──────────────────────────────────
    const { sources, skipped } = filterRelevantContext({
      currentStep: current_step,
      tier,
      hasRevenue,
      rutEmpresa: rut_empresa ?? null,
      brandName: brand_name ?? null,
      targetCountry: (validation.target_country as string) ?? null,
    });

    // ── S5-B: verificar caché antes de gastar tokens de Claude ────────────────
    const cacheQueryText = [
      validation.idea_name,
      validation.idea_industry,
      validation.business_model,
      validation.target_country,
    ].filter(Boolean).join(' | ');

    const cached = await checkDueDiligenceCache(supabase, cacheQueryText);
    if (cached) {
      console.log(`assemble-mega-prompt: cache HIT para validation_id=${validation_id}`);
      return new Response(JSON.stringify({
        success: true,
        due_diligence_score: cached,
        from_cache: true,
        data_warnings: [],
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── S5-C + S6: Fuentes en paralelo con circuit breaker por cada una ───────
    // RAG y fuentes B2G/B2B se lanzan simultáneamente.
    // withCircuitBreaker garantiza que ninguna fuente cuelgue el pipeline completo.
    const [
      ragBreaker,
      siiBreaker,
      inapiBreaker,
      fintocBreaker,
      pjudBreaker,
      cmfBestBreaker,
    ] = await Promise.all([
      withCircuitBreaker('knowledge_base', () =>
        searchKnowledgeBase(supabase, (validation.idea_name as string) ?? '', (validation.idea_industry as string) ?? '')
      ),
      sources.has('sii')
        ? withCircuitBreaker('sii-proxy', () => callEdgeFunction('sii-proxy', { rut: rut_empresa }))
        : { ok: false as const, reason: 'SII no requerido por filtro adaptativo' },
      sources.has('inapi')
        ? withCircuitBreaker('inapi-fetch', () => callEdgeFunction('inapi-fetch', { brand_name, validation_id }))
        : { ok: false as const, reason: 'INAPI no requerido por filtro adaptativo' },
      sources.has('fintoc')
        ? withCircuitBreaker('fintoc', () => readTempContext(supabase, validation_id, 'fintoc'))
        : { ok: false as const, reason: 'Fintoc no requerido por filtro adaptativo' },
      sources.has('pjud')
        ? withCircuitBreaker('pjud', () => readTempContext(supabase, validation_id, 'pjud'))
        : { ok: false as const, reason: 'PJUD no requerido por filtro adaptativo' },
      sources.has('cmf_best')
        ? withCircuitBreaker('cmf-best-fetch', () => callEdgeFunction('cmf-best-fetch', { validation_id }), 15_000)
        : { ok: false as const, reason: 'CMF BEST no requerido (país no es Chile)' },
    ]);

    // ── Construir secciones de contexto + dataWarnings ────────────────────────
    // Solo emitir dataWarning para fuentes ACTIVAS que fallaron.
    // Fuentes omitidas por filtro van en skipped[], no en dataWarnings[].
    const dataWarnings: string[] = [];
    const contextSections: string[] = [];

    function applyBreaker(
      breaker: { ok: true; data: unknown } | { ok: false; reason: string },
      label: string,
      compress: (d: Record<string, unknown>) => string,
      active: boolean,
    ): void {
      if (!active) return;
      if (breaker.ok) {
        try {
          contextSections.push(compress(breaker.data as Record<string, unknown>));
        } catch (e) {
          dataWarnings.push(`${label}: error procesando — ${(e as Error).message}`);
          contextSections.push(`[${label}] Datos recibidos pero no procesables.`);
        }
      } else {
        dataWarnings.push(`${label}: ${breaker.reason}`);
        contextSections.push(`[${label}] Sin datos — fuente no disponible.`);
      }
    }

    applyBreaker(siiBreaker,      'SII (tributario)',                compressSii,      sources.has('sii'));
    applyBreaker(inapiBreaker,    'INAPI (marcas)',                  compressInapi,    sources.has('inapi'));
    applyBreaker(fintocBreaker,   'Open Banking (Fintoc)',           compressFintoc,   sources.has('fintoc'));
    applyBreaker(pjudBreaker,     'Historial Judicial (PJUD)',       compressPjud,     sources.has('pjud'));
    applyBreaker(cmfBestBreaker,  'CMF BEST (mercado financiero)',   compressCmfBest,  sources.has('cmf_best'));

    const ragChunks = ragBreaker.ok ? (ragBreaker.data as string) : '';

    // ── Llamar Claude ─────────────────────────────────────────────────────────
    const { system, user: userPrompt } = buildMegaPrompt(
      validation, contextSections, ragChunks, dataWarnings, skipped,
    );
    const dueDiligenceScore = await callClaude(system, userPrompt);

    // ── Log de interacción para rate limiting + auditoría (fire-and-forget) ────
    supabase.from('ai_interactions').insert({
      user_id:       user.id,
      validation_id,
      prompt_type:   'due_diligence',
      input_data:    { sources: [...sources], skipped },
      output_data:   { total: dueDiligenceScore.total, investorReadiness: dueDiligenceScore.investorReadiness },
      tokens_used:   0,  // Claude Sonnet no devuelve token count en esta integración
      model:         ANTHROPIC_MODEL,
    }).then(({ error: logErr }) => {
      if (logErr) console.warn('[dd-log] ai_interactions insert error:', logErr.message);
    });

    // ── Guardar en caché para reutilización futura ────────────────────────────
    // Fire-and-forget: el usuario recibe la respuesta antes de que termine el save.
    saveDueDiligenceCache(
      supabase, cacheQueryText, dueDiligenceScore,
      validation.idea_industry as string,
      validation.target_country as string,
    ).catch(e => console.warn('cache save warning:', e));

    // ── Persistir resultado en validations ────────────────────────────────────
    await supabase
      .from('validations')
      .update({ due_diligence_score: { ...dueDiligenceScore, data_warnings: dataWarnings } })
      .eq('id', validation_id);

    await supabase
      .from('temp_context')
      .update({ status: 'processed' })
      .eq('validation_id', validation_id)
      .eq('status', 'pending');

    return new Response(JSON.stringify({
      success: true,
      due_diligence_score: dueDiligenceScore,
      data_warnings: dataWarnings,
      sources_used: [...sources],
      sources_skipped: skipped,
      from_cache: false,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('assemble-mega-prompt error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
