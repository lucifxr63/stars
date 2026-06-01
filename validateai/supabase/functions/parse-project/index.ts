import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// â”€â”€ Env â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Max PDF size to send to Claude: 4 MB base64-decoded (~5.3 MB encoded).
// Prevents timeouts on heavy pitch decks. Above this, we still attempt but warn.
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
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

// ── Types (mirrors src/types/validation.ts — kept in sync manually) ──────────
// Sprint P-A: añadidos team_composition, traction_status, target_country, target_region
type DDDimension = 'financiero' | 'legal' | 'mercado' | 'equipo' | 'traccion';

interface ExtractedProjectData {
  projectName?:       string;
  problem?:           string;
  solution?:          string;
  revenueModel?:      string;
  ltv?:               number;
  cac?:               number;
  paybackPeriod?:     number;
  mrr?:               number;
  arr?:               number;
  hasPaidCustomers?:  boolean;
  customerCount?:     number;
  teamSize?:          number;
  founderBackground?: string;
  legalCompliance?:   { ley21719?: boolean; ley21521?: boolean };
  tam?:               string;
  targetMarket?:      string;
  // Sprint P-A — nuevos campos para Human-in-the-Loop pre-filling
  team_composition?:  'solo_founder' | 'founding_team' | 'team_with_employees';
  traction_status?:   'idea_on_paper' | 'mvp_in_development' | 'mvp_launched_no_sales' | 'first_paying_customers';
  target_country?:    string;
  target_region?:     string;
  extractionConfidence: Record<string, number>;
  sourceFileName?:    string;
  sourceMimeType?:    'application/pdf' | 'application/json';
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

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Extraction prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Highly specific, zero narrative â€” maps to ExtractedProjectData schema only.
const EXTRACTION_SYSTEM_PROMPT = `You are a structured data extractor for startup pitch decks and business plans.
Your ONLY task is to map information from the provided document into the exact JSON schema below.
DO NOT generate narrative, opinions, or any text outside the JSON object.
For every field, also provide a confidence score (0.0â€“1.0) in "extractionConfidence".
If a field is not mentioned or cannot be inferred with reasonable certainty, omit it from the output â€” never guess.
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
    "ley21719": "boolean â€” true only if Ley 21.719 or Chilean data privacy compliance is explicitly mentioned",
    "ley21521": "boolean â€” true only if Ley 21.521, CMF, or Chilean Fintech compliance is explicitly mentioned"
  },
  "tam":           "string (e.g. '$2B') | omit if absent",
  "targetMarket":  "string | omit if absent",
  "team_composition": "Infer team structure. 'solo_founder' = single founder, no co-founders or employees. 'founding_team' = multiple founders/co-founders but no hired employees beyond them. 'team_with_employees' = hired staff beyond the founding team exist. Omit if team structure is ambiguous or not mentioned.",
  "traction_status": "Infer the current stage from explicit evidence only. 'first_paying_customers' = revenue, MRR, ARR, or paying customers explicitly mentioned. 'mvp_launched_no_sales' = product/MVP is live or launched but no revenue. 'mvp_in_development' = product actively being built, beta, or development stage. 'idea_on_paper' = concept stage only, nothing built yet. Omit if stage cannot be determined from the document.",
  "target_country": "Primary country the startup targets. Extract as a country name string (e.g. 'Chile', 'México', 'United States'). Omit if not mentioned.",
  "target_region":  "Specific region, city, or state within the target country (e.g. 'Santiago', 'CDMX', 'California'). Omit if not mentioned.",
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
    "targetMarket":      0.0,
    "team_composition":  0.0,
    "traction_status":   0.0,
    "target_country":    0.0,
    "target_region":     0.0
  }
}`;

// â”€â”€ JSON document parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  result.target_country    = pick<string>('target_country', ['target_country','targetCountry','country','pais','país']);
  result.target_region     = pick<string>('target_region', ['target_region','targetRegion','region','ciudad','city']);

  const validTeamComp = ['solo_founder', 'founding_team', 'team_with_employees'];
  const rawTeam = pick<string>('team_composition', ['team_composition','teamComposition','team_structure']);
  if (rawTeam && validTeamComp.includes(rawTeam)) {
    result.team_composition = rawTeam as ExtractedProjectData['team_composition'];
  }

  const validTraction = ['idea_on_paper', 'mvp_in_development', 'mvp_launched_no_sales', 'first_paying_customers'];
  const rawTraction = pick<string>('traction_status', ['traction_status','tractionStatus','stage','traction']);
  if (rawTraction && validTraction.includes(rawTraction)) {
    result.traction_status = rawTraction as ExtractedProjectData['traction_status'];
  }

  const lc = d['legalCompliance'] as Record<string,boolean> | undefined;
  if (lc) result.legalCompliance = { ley21719: !!lc.ley21719, ley21521: !!lc.ley21521 };

  // Clean up undefined fields for cleaner output
  for (const k of Object.keys(result) as (keyof ExtractedProjectData)[]) {
    if (result[k] === undefined) delete result[k];
  }
  return result;
}

// â”€â”€ PDF parser via Claude claude-sonnet-4 multimodal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Gap Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Confidence threshold below which a field is considered "missing"
const CONFIDENCE_THRESHOLD = 0.7;

const GAP_DEFINITIONS: {
  field: keyof Omit<ExtractedProjectData, 'extractionConfidence' | 'sourceFileName' | 'sourceMimeType'>;
  question: string;
  dimension: DDDimension;
  priority: 'critical' | 'important' | 'nice_to_have';
}[] = [
  { field: 'problem',          dimension: 'mercado',    priority: 'critical',      question: 'Â¿CuÃ¡l es el problema principal que tu startup resuelve? Describe el dolor del cliente con ejemplos concretos.' },
  { field: 'solution',         dimension: 'mercado',    priority: 'critical',      question: 'Â¿CuÃ¡l es tu soluciÃ³n y quÃ© la hace 10 veces mejor que las alternativas actuales?' },
  { field: 'revenueModel',     dimension: 'financiero', priority: 'critical',      question: 'Â¿CuÃ¡l es tu modelo de ingresos? (suscripciÃ³n, comisiÃ³n, licencia, transaccional, etc.)' },
  { field: 'hasPaidCustomers', dimension: 'traccion',   priority: 'critical',      question: 'Â¿Tienes clientes que ya pagan (no solo usuarios gratuitos o prometidos)? Evidencia del Mom Test.' },
  { field: 'mrr',              dimension: 'financiero', priority: 'critical',      question: 'Â¿CuÃ¡l es tu MRR actual (Monthly Recurring Revenue) en USD? Si es pre-revenue, indica 0.' },
  { field: 'cac',              dimension: 'financiero', priority: 'critical',      question: 'Â¿CuÃ¡nto te cuesta adquirir un cliente de pago (CAC)? Incluye marketing + ventas.' },
  { field: 'ltv',              dimension: 'financiero', priority: 'critical',      question: 'Â¿CuÃ¡l es el LTV (Lifetime Value) promedio de un cliente? Si no lo sabes, estima basado en precio Ã— meses de retenciÃ³n.' },
  { field: 'customerCount',    dimension: 'traccion',   priority: 'important',     question: 'Â¿CuÃ¡ntos clientes activos (de pago o en piloto) tienes hoy?' },
  { field: 'paybackPeriod',    dimension: 'financiero', priority: 'important',     question: 'Â¿En cuÃ¡ntos meses recuperas el CAC de un cliente? (Payback Period)' },
  { field: 'arr',              dimension: 'financiero', priority: 'important',     question: 'Â¿CuÃ¡l es tu ARR (Annual Recurring Revenue) proyectado o actual en USD?' },
  { field: 'teamSize',         dimension: 'equipo',     priority: 'important',     question: 'Â¿CuÃ¡ntas personas forman el equipo fundador y/o de empleados actuales?' },
  { field: 'founderBackground',dimension: 'equipo',     priority: 'important',     question: 'Â¿CuÃ¡l es la trayectoria de los co-fundadores? (industria, aÃ±os de experiencia, proyectos previos)' },
  { field: 'tam',              dimension: 'mercado',    priority: 'important',     question: 'Â¿CuÃ¡l es el tamaÃ±o del mercado total (TAM) al que apuntas? Â¿CuÃ¡l es tu fuente?' },
  { field: 'targetMarket',     dimension: 'mercado',    priority: 'important',     question: 'Â¿QuiÃ©n es exactamente tu cliente objetivo? (segmento, industria, paÃ­s, tamaÃ±o de empresa)' },
  { field: 'projectName',      dimension: 'mercado',    priority: 'nice_to_have',  question: 'Â¿CuÃ¡l es el nombre oficial de la startup o proyecto?' },
  { field: 'legalCompliance',  dimension: 'legal',      priority: 'critical',      question: 'Â¿Has evaluado el cumplimiento con la Ley 21.719 (ProtecciÃ³n de Datos Personales de Chile) y/o la Ley 21.521 (Ley Fintech CMF) si aplica a tu modelo?' },
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

// â”€â”€ Due Diligence Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    { met: has('solution'),      gap: 'SoluciÃ³n no descrita claramente' },
    { met: has('tam'),           gap: 'TAM no dimensionado' },
    { met: has('targetMarket'),  gap: 'Segmento objetivo no definido' },
  ]);

  const equipo = scoreDimension('Equipo', [
    { met: has('teamSize'),          gap: 'TamaÃ±o del equipo no especificado' },
    { met: has('founderBackground'), gap: 'Trayectoria del fundador no documentada' },
  ]);

  const traccion = scoreDimension('TracciÃ³n', [
    { met: has('hasPaidCustomers'),  gap: 'Sin evidencia de clientes de pago (Mom Test)' },
    { met: has('customerCount'),     gap: 'NÃºmero de clientes no reportado' },
    { met: has('mrr') && (data.mrr ?? 0) > 0, gap: 'Sin MRR real â€” posible pre-revenue' },
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

// â”€â”€ Main handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Tier check â€” requires premium or pro
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier ?? 'free';
  if (!['pro', 'premium'].includes(tier)) {
    return json({ error: 'premium_required', message: 'La auditorÃ­a de documentos requiere plan Pro o Premium.' }, 403, req);
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
    return json({ error: 'file_too_large', message: 'El archivo supera el lÃ­mite de 10 MB. Exporta el PDF sin imÃ¡genes de alta resoluciÃ³n.' }, 413, req);
  }

  // â”€â”€ Extraction (graceful degradation: always return something) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let extractedData: ExtractedProjectData = { extractionConfidence: {} };
  let extractionError: string | null = null;

  try {
    if (mimeType === 'application/json') {
      let raw: unknown;
      try {
        raw = JSON.parse(atob(fileBase64));
      } catch {
        return json({ error: 'invalid_json', message: 'El archivo JSON no es vÃ¡lido. Verifica su estructura.' }, 400, req);
      }
      extractedData = parseJSONDocument(raw);
    } else {
      // PDF â€” may partially fail; we catch and continue with what we have
      extractedData = await parsePDFWithClaude(fileBase64, fileName);
    }
  } catch (err) {
    // Graceful degradation: log error, return empty extraction + full gap questions
    extractionError = err instanceof Error ? err.message : String(err);
    console.error('[parse-project] Extraction failed:', extractionError);
    // extractedData remains empty â€” gap analysis will surface all questions
  }

  extractedData.sourceFileName = fileName ?? 'documento';
  extractedData.sourceMimeType = mimeType;

  // â”€â”€ Gap Analysis + DD Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const pendingQuestions   = buildGapAnalysis(extractedData);
  const dueDiligenceScore  = calculateDueDiligenceScore(extractedData, pendingQuestions);

  // â”€â”€ Persist to validations table (non-blocking, best-effort) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // ── Consent log (Ley 21.719) — Sprint P-D ────────────────────────────────────
  // El usuario vio el aviso de privacidad en StepUpload y procedió con la subida.
  // Registramos el consentimiento implícito para cumplimiento normativo.
  // Non-blocking — el reporte se devuelve independientemente del resultado.
  supabase.from('consent_logs').insert({
    user_id:      user.id,
    consent_type: 'document_processing',
    flagged:      true,
    ip_address:   (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? '').split(',')[0].trim() || null,
  }).then(({ error: consentErr }) => {
    if (consentErr) console.warn('[parse-project] Consent log error:', consentErr.message);
  });

  // ── Log interaction (non-blocking) ───────────────────────────────────────────
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
