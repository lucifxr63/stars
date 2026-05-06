import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Env ───────────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Max PDF size to send to Claude: 4 MB base64-decoded (~5.3 MB encoded).
// Prevents timeouts on heavy pitch decks. Above this, we still attempt but warn.
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function corsHeaders(req: Request) {
  const origin  = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ── Types (mirrors src/types/validation.ts — kept in sync manually) ───────────
type DDDimension = 'financiero' | 'legal' | 'mercado' | 'equipo' | 'traccion';

interface ExtractedProjectData {
  projectName?:      string;
  problem?:          string;
  solution?:         string;
  revenueModel?:     string;
  ltv?:              number;
  cac?:              number;
  paybackPeriod?:    number;
  mrr?:              number;
  arr?:              number;
  hasPaidCustomers?: boolean;
  customerCount?:    number;
  teamSize?:         number;
  founderBackground?: string;
  legalCompliance?: { ley21719?: boolean; ley21521?: boolean };
  tam?:              string;
  targetMarket?:     string;
  extractionConfidence: Record<string, number>;
  sourceFileName?:   string;
  sourceMimeType?:   'application/pdf' | 'application/json';
}

interface PendingQuestion {
  field:     string;
  question:  string;
  dimension: DDDimension;
  priority:  'critical' | 'important' | 'nice_to_have';
}

interface DDScoreDimension { score: number; label: string; gaps: string[] }

interface DueDiligenceScore {
  total:      number;
  dimensions: {
    financiero: DDScoreDimension;
    legal:      DDScoreDimension;
    mercado:    DDScoreDimension;
    equipo:     DDScoreDimension;
    traccion:   DDScoreDimension;
  };
  investorReadiness: 'not_ready' | 'early' | 'developing' | 'ready';
  topGaps: string[];
}

interface ParseProjectRequest {
  fileBase64:    string;
  mimeType:      'application/pdf' | 'application/json';
  fileName?:     string;
  validation_id?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractJSON(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) return jsonBlock[1].trim();
  const start = trimmed.search(/[{[]/);
  const end   = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (start !== -1 && end !== -1) return trimmed.slice(start, end + 1);
  return trimmed;
}

// ── Extraction prompt ─────────────────────────────────────────────────────────
// Highly specific, zero narrative — maps to ExtractedProjectData schema only.
const EXTRACTION_SYSTEM_PROMPT = `You are a structured data extractor for startup pitch decks and business plans.
Your ONLY task is to map information from the provided document into the exact JSON schema below.
DO NOT generate narrative, opinions, or any text outside the JSON object.
For every field, also provide a confidence score (0.0–1.0) in "extractionConfidence".
If a field is not mentioned or cannot be inferred with reasonable certainty, omit it from the output — never guess.
For boolean fields (hasPaidCustomers, legalCompliance.*), only set true if there is explicit evidence.
For numeric fields (ltv, cac, mrr, etc.), only include if an explicit figure or clear approximation exists.

Respond ONLY with this JSON structure, no markdown, no explanation:
{
  "projectName":       "string | omit if absent",
  "problem":           "string | omit if absent",
  "solution":          "string | omit if absent",
  "revenueModel":      "string | omit if absent",
  "ltv":               "number | omit if absent",
  "cac":               "number | omit if absent",
  "paybackPeriod":     "number (months) | omit if absent",
  "mrr":               "number (USD) | omit if absent",
  "arr":               "number (USD) | omit if absent",
  "hasPaidCustomers":  "boolean | omit if absent",
  "customerCount":     "number | omit if absent",
  "teamSize":          "number | omit if absent",
  "founderBackground": "string | omit if absent",
  "legalCompliance": {
    "ley21719": "boolean — true only if Ley 21.719 or Chilean data privacy compliance is explicitly mentioned",
    "ley21521": "boolean — true only if Ley 21.521, CMF, or Chilean Fintech compliance is explicitly mentioned"
  },
  "tam":           "string (e.g. '$2B') | omit if absent",
  "targetMarket":  "string | omit if absent",
  "extractionConfidence": {
    "projectName":       0.0,
    "problem":           0.0,
    "solution":          0.0,
    "revenueModel":      0.0,
    "ltv":               0.0,
    "cac":               0.0,
    "paybackPeriod":     0.0,
    "mrr":               0.0,
    "arr":               0.0,
    "hasPaidCustomers":  0.0,
    "customerCount":     0.0,
    "teamSize":          0.0,
    "founderBackground": 0.0,
    "tam":               0.0,
    "targetMarket":      0.0
  }
}`;

// ── JSON document parser ──────────────────────────────────────────────────────
function parseJSONDocument(raw: unknown): ExtractedProjectData {
  if (typeof raw !== 'object' || raw === null) return { extractionConfidence: {} };
  const d = raw as Record<string, unknown>;

  const conf: Record<string, number> = {};
  function pick<T>(key: string, keys: string[]): T | undefined {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== '') {
        conf[key] = 0.95;
        return d[k] as T;
      }
    }
    conf[key] = 0;
    return undefined;
  }

  const result: ExtractedProjectData = { extractionConfidence: conf };
  result.projectName       = pick<string>('projectName', ['projectName','name','startup_name','company']);
  result.problem           = pick<string>('problem', ['problem','pain','challenge']);
  result.solution          = pick<string>('solution', ['solution','product','service']);
  result.revenueModel      = pick<string>('revenueModel', ['revenueModel','revenue_model','business_model','monetization']);
  result.ltv               = pick<number>('ltv', ['ltv','LTV','customer_lifetime_value']);
  result.cac               = pick<number>('cac', ['cac','CAC','customer_acquisition_cost']);
  result.paybackPeriod     = pick<number>('paybackPeriod', ['paybackPeriod','payback_period','payback_months']);
  result.mrr               = pick<number>('mrr', ['mrr','MRR','monthly_recurring_revenue']);
  result.arr               = pick<number>('arr', ['arr','ARR','annual_recurring_revenue']);
  result.hasPaidCustomers  = pick<boolean>('hasPaidCustomers', ['hasPaidCustomers','has_paid_customers','paid_customers']);
  result.customerCount     = pick<number>('customerCount', ['customerCount','customer_count','customers']);
  result.teamSize          = pick<number>('teamSize', ['teamSize','team_size','team']);
  result.founderBackground = pick<string>('founderBackground', ['founderBackground','founder_background','founder']);
  result.tam               = pick<string>('tam', ['tam','TAM','total_addressable_market']);
  result.targetMarket      = pick<string>('targetMarket', ['targetMarket','target_market','market']);

  const lc = d['legalCompliance'] as Record<string,boolean> | undefined;
  if (lc) result.legalCompliance = { ley21719: !!lc.ley21719, ley21521: !!lc.ley21521 };

  // Clean up undefined fields for cleaner output
  for (const k of Object.keys(result) as (keyof ExtractedProjectData)[]) {
    if (result[k] === undefined) delete result[k];
  }
  return result;
}

// ── PDF parser via Claude claude-sonnet-4 multimodal ─────────────────────────────────────
async function parsePDFWithClaude(
  fileBase64: string,
  fileName?: string,
): Promise<ExtractedProjectData> {
  const decodedSize = Math.ceil(fileBase64.length * 0.75);
  if (decodedSize > MAX_PDF_BYTES) {
    console.warn(`[parse-project] PDF size ${decodedSize} bytes exceeds soft limit. Proceeding with caution.`);
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25,prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: [{ type: 'text', text: EXTRACTION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: fileBase64,
            },
            ...(fileName ? { title: fileName } : {}),
            // Only process first 15 pages to prevent timeouts on heavy decks
            citations: { enabled: false },
          },
          {
            type: 'text',
            text: 'Extract all available fields from this document into the JSON schema specified in the system prompt.',
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic PDF extraction error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = (data.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  const parsed = JSON.parse(extractJSON(text)) as ExtractedProjectData;
  parsed.extractionConfidence = parsed.extractionConfidence ?? {};
  return parsed;
}

// ── Gap Analysis ──────────────────────────────────────────────────────────────
// Confidence threshold below which a field is considered "missing"
const CONFIDENCE_THRESHOLD = 0.7;

const GAP_DEFINITIONS: {
  field: keyof Omit<ExtractedProjectData, 'extractionConfidence' | 'sourceFileName' | 'sourceMimeType'>;
  question: string;
  dimension: DDDimension;
  priority: 'critical' | 'important' | 'nice_to_have';
}[] = [
  { field: 'problem',          dimension: 'mercado',    priority: 'critical',      question: '¿Cuál es el problema principal que tu startup resuelve? Describe el dolor del cliente con ejemplos concretos.' },
  { field: 'solution',         dimension: 'mercado',    priority: 'critical',      question: '¿Cuál es tu solución y qué la hace 10 veces mejor que las alternativas actuales?' },
  { field: 'revenueModel',     dimension: 'financiero', priority: 'critical',      question: '¿Cuál es tu modelo de ingresos? (suscripción, comisión, licencia, transaccional, etc.)' },
  { field: 'hasPaidCustomers', dimension: 'traccion',   priority: 'critical',      question: '¿Tienes clientes que ya pagan (no solo usuarios gratuitos o prometidos)? Evidencia del Mom Test.' },
  { field: 'mrr',              dimension: 'financiero', priority: 'critical',      question: '¿Cuál es tu MRR actual (Monthly Recurring Revenue) en USD? Si es pre-revenue, indica 0.' },
  { field: 'cac',              dimension: 'financiero', priority: 'critical',      question: '¿Cuánto te cuesta adquirir un cliente de pago (CAC)? Incluye marketing + ventas.' },
  { field: 'ltv',              dimension: 'financiero', priority: 'critical',      question: '¿Cuál es el LTV (Lifetime Value) promedio de un cliente? Si no lo sabes, estima basado en precio × meses de retención.' },
  { field: 'customerCount',    dimension: 'traccion',   priority: 'important',     question: '¿Cuántos clientes activos (de pago o en piloto) tienes hoy?' },
  { field: 'paybackPeriod',    dimension: 'financiero', priority: 'important',     question: '¿En cuántos meses recuperas el CAC de un cliente? (Payback Period)' },
  { field: 'arr',              dimension: 'financiero', priority: 'important',     question: '¿Cuál es tu ARR (Annual Recurring Revenue) proyectado o actual en USD?' },
  { field: 'teamSize',         dimension: 'equipo',     priority: 'important',     question: '¿Cuántas personas forman el equipo fundador y/o de empleados actuales?' },
  { field: 'founderBackground',dimension: 'equipo',     priority: 'important',     question: '¿Cuál es la trayectoria de los co-fundadores? (industria, años de experiencia, proyectos previos)' },
  { field: 'tam',              dimension: 'mercado',    priority: 'important',     question: '¿Cuál es el tamaño del mercado total (TAM) al que apuntas? ¿Cuál es tu fuente?' },
  { field: 'targetMarket',     dimension: 'mercado',    priority: 'important',     question: '¿Quién es exactamente tu cliente objetivo? (segmento, industria, país, tamaño de empresa)' },
  { field: 'projectName',      dimension: 'mercado',    priority: 'nice_to_have',  question: '¿Cuál es el nombre oficial de la startup o proyecto?' },
  { field: 'legalCompliance',  dimension: 'legal',      priority: 'critical',      question: '¿Has evaluado el cumplimiento con la Ley 21.719 (Protección de Datos Personales de Chile) y/o la Ley 21.521 (Ley Fintech CMF) si aplica a tu modelo?' },
];

function buildGapAnalysis(data: ExtractedProjectData): PendingQuestion[] {
  const questions: PendingQuestion[] = [];
  const conf = data.extractionConfidence ?? {};

  for (const def of GAP_DEFINITIONS) {
    const field = def.field;

    if (field === 'legalCompliance') {
      const lc = data.legalCompliance;
      // Only ask if we have no legal data at all
      if (!lc || (lc.ley21719 === undefined && lc.ley21521 === undefined)) {
        questions.push({ field: 'legalCompliance', question: def.question, dimension: def.dimension, priority: def.priority });
      }
      continue;
    }

    const fieldConf = conf[field as string] ?? 0;
    const fieldValue = data[field as keyof ExtractedProjectData];
    const isMissing  = fieldValue === undefined || fieldValue === null;
    const isLowConf  = fieldConf < CONFIDENCE_THRESHOLD;

    if (isMissing || isLowConf) {
      questions.push({ field: field as string, question: def.question, dimension: def.dimension, priority: def.priority });
    }
  }

  // Sort: critical first, then important, then nice_to_have
  const order = { critical: 0, important: 1, nice_to_have: 2 };
  return questions.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ── Due Diligence Score ───────────────────────────────────────────────────────
function scoreDimension(
  label: string,
  checks: { met: boolean; gap: string }[],
): DDScoreDimension {
  const met  = checks.filter((c) => c.met).length;
  const gaps = checks.filter((c) => !c.met).map((c) => c.gap);
  const score = checks.length > 0 ? Math.round((met / checks.length) * 100) : 0;
  return { score, label, gaps };
}

function calculateDueDiligenceScore(
  data: ExtractedProjectData,
  pending: PendingQuestion[],
): DueDiligenceScore {
  const pendingFields = new Set(pending.map((q) => q.field));
  const has = (field: string) => !pendingFields.has(field);

  const financiero = scoreDimension('Financiero', [
    { met: has('mrr'),           gap: 'MRR no definido' },
    { met: has('cac'),           gap: 'CAC no cuantificado' },
    { met: has('ltv'),           gap: 'LTV no calculado' },
    { met: has('paybackPeriod'), gap: 'Payback period desconocido' },
    { met: has('revenueModel'),  gap: 'Modelo de ingresos no definido' },
  ]);

  const legal = scoreDimension('Legal', [
    { met: !!(data.legalCompliance?.ley21719 !== undefined), gap: 'Cumplimiento Ley 21.719 (Datos) no evaluado' },
    { met: !!(data.legalCompliance?.ley21521 !== undefined), gap: 'Cumplimiento Ley 21.521 (Fintech) no evaluado' },
  ]);

  const mercado = scoreDimension('Mercado', [
    { met: has('problem'),       gap: 'Problema de mercado no articulado' },
    { met: has('solution'),      gap: 'Solución no descrita claramente' },
    { met: has('tam'),           gap: 'TAM no dimensionado' },
    { met: has('targetMarket'),  gap: 'Segmento objetivo no definido' },
  ]);

  const equipo = scoreDimension('Equipo', [
    { met: has('teamSize'),          gap: 'Tamaño del equipo no especificado' },
    { met: has('founderBackground'), gap: 'Trayectoria del fundador no documentada' },
  ]);

  const traccion = scoreDimension('Tracción', [
    { met: has('hasPaidCustomers'),  gap: 'Sin evidencia de clientes de pago (Mom Test)' },
    { met: has('customerCount'),     gap: 'Número de clientes no reportado' },
    { met: has('mrr') && (data.mrr ?? 0) > 0, gap: 'Sin MRR real — posible pre-revenue' },
  ]);

  // Weighted total: financiero 30%, legal 15%, mercado 25%, equipo 15%, traccion 15%
  const total = Math.round(
    financiero.score * 0.30 +
    legal.score      * 0.15 +
    mercado.score    * 0.25 +
    equipo.score     * 0.15 +
    traccion.score   * 0.15,
  );

  const investorReadiness =
    total >= 80 ? 'ready'      :
    total >= 55 ? 'developing' :
    total >= 30 ? 'early'      : 'not_ready';

  // Collect all gaps, sorted by dimension weight, cap at 5
  const allGaps = [
    ...financiero.gaps,
    ...traccion.gaps,
    ...mercado.gaps,
    ...legal.gaps,
    ...equipo.gaps,
  ].slice(0, 5);

  return {
    total,
    dimensions: { financiero, legal, mercado, equipo, traccion },
    investorReadiness,
    topGaps: allGaps,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401, req);

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401, req);

  // Tier check — requires premium or pro
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier ?? 'free';
  if (!['pro', 'premium'].includes(tier)) {
    return json({ error: 'premium_required', message: 'La auditoría de documentos requiere plan Pro o Premium.' }, 403, req);
  }

  // Body validation
  let body: ParseProjectRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req);
  }

  const { fileBase64, mimeType, fileName, validation_id } = body;

  if (!fileBase64 || !mimeType) {
    return json({ error: 'fileBase64 and mimeType are required' }, 400, req);
  }
  if (mimeType !== 'application/pdf' && mimeType !== 'application/json') {
    return json({ error: 'Unsupported mimeType. Only application/pdf and application/json are accepted.' }, 400, req);
  }

  // Size guard (~10 MB base64 limit)
  const MAX_B64_CHARS = 14_000_000;
  if (fileBase64.length > MAX_B64_CHARS) {
    return json({ error: 'file_too_large', message: 'El archivo supera el límite de 10 MB. Exporta el PDF sin imágenes de alta resolución.' }, 413, req);
  }

  // ── Extraction (graceful degradation: always return something) ─────────────
  let extractedData: ExtractedProjectData = { extractionConfidence: {} };
  let extractionError: string | null = null;

  try {
    if (mimeType === 'application/json') {
      let raw: unknown;
      try {
        raw = JSON.parse(atob(fileBase64));
      } catch {
        return json({ error: 'invalid_json', message: 'El archivo JSON no es válido. Verifica su estructura.' }, 400, req);
      }
      extractedData = parseJSONDocument(raw);
    } else {
      // PDF — may partially fail; we catch and continue with what we have
      extractedData = await parsePDFWithClaude(fileBase64, fileName);
    }
  } catch (err) {
    // Graceful degradation: log error, return empty extraction + full gap questions
    extractionError = err instanceof Error ? err.message : String(err);
    console.error('[parse-project] Extraction failed:', extractionError);
    // extractedData remains empty — gap analysis will surface all questions
  }

  extractedData.sourceFileName = fileName ?? 'documento';
  extractedData.sourceMimeType = mimeType;

  // ── Gap Analysis + DD Score ───────────────────────────────────────────────
  const pendingQuestions   = buildGapAnalysis(extractedData);
  const dueDiligenceScore  = calculateDueDiligenceScore(extractedData, pendingQuestions);

  // ── Persist to validations table (non-blocking, best-effort) ──────────────
  if (validation_id) {
    supabase
      .from('validations')
      .update({
        due_diligence_extracted:  extractedData,
        due_diligence_score:      dueDiligenceScore,
        due_diligence_pending_q:  pendingQuestions,
      })
      .eq('id', validation_id)
      .then(({ error: persistErr }) => {
        if (persistErr) console.warn('[parse-project] Persist error:', persistErr.message);
      });
  }

  // ── Log interaction (non-blocking) ────────────────────────────────────────
  supabase.from('ai_interactions').insert({
    user_id:        user.id,
    validation_id:  validation_id ?? null,
    step:           0,
    prompt_type:    'parse_project',
    input_data:     { mimeType, fileName, fileSizeB64: fileBase64.length },
    output_data:    { fieldsExtracted: Object.keys(extractedData).length, pendingCount: pendingQuestions.length, ddScore: dueDiligenceScore.total },
    tokens_used:    0,
    model:          mimeType === 'application/pdf' ? 'claude-sonnet-4-20250514' : 'none',
  }).then(({ error: logErr }) => {
    if (logErr) console.warn('[parse-project] Log error:', logErr.message);
  });

  return json({
    extractedData,
    pendingQuestions,
    dueDiligenceScore,
    ...(extractionError ? { _extractionWarning: extractionError } : {}),
  }, 200, req);
});
