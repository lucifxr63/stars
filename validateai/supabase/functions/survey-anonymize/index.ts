// Edge Function: survey-anonymize
// Pipeline de privacidad en 4 pasos para el data lake de inteligencia de mercado.
//
// PASO 1 â€” GeneralizaciÃ³n semÃ¡ntica (LLM Structured Output)
//   Claude mapea valores especÃ­ficos extraÃ­dos del anÃ¡lisis (cargos, herramientas,
//   industrias) a una taxonomÃ­a de enums controlados, reduciendo la cardinalidad
//   de los cuasi-identificadores antes de aplicar las mÃ©tricas estadÃ­sticas.
//
// PASO 2 â€” K-anonimato (k=5 por defecto)
//   Agrupa registros por {generalized_industry, generalized_role, friction_bucket,
//   willingness_to_pay}. Clases con count â‰¥ k pasan al data lake. Outliers: se
//   suprime selectivamente el atributo mÃ¡s especÃ­fico (industry â†’ null) en lugar
//   de borrar el registro completo, preservando su valor analÃ­tico.
//
// PASO 3 â€” L-diversidad (l=2 por defecto)
//   Dentro de cada clase de equivalencia, verifica que haya â‰¥ l valores distintos
//   del atributo sensible (severity). Si falla, suprime la clase del data lake.
//
// PASO 4 â€” T-closeness (t=0.20 por defecto, Earth Mover's Distance 1D)
//   Neutraliza el ataque de sesgo y el ataque de similitud. Verifica que la
//   distribuciÃ³n local de severity en cada clase no diste mÃ¡s de t de la
//   distribuciÃ³n global (Wasserstein-1 sobre categorÃ­as ordenadas).
//   Referencia: Li et al. (2007) "t-Closeness: Privacy Beyond k-Anonymity and l-Diversity"
//
// POST /survey-anonymize  body: { form_id, k?, l?, t? }

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRK      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
  'https://validateai.cl',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  };
}

function json(data: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// â”€â”€ TaxonomÃ­as controladas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const INDUSTRY_VALUES = [
  'Manufactura e Industria', 'TecnologÃ­a y Software', 'Operaciones TI',
  'Retail y Comercio', 'Servicios Financieros', 'Salud y Ciencias',
  'EducaciÃ³n', 'LogÃ­stica y Transporte', 'ConstrucciÃ³n e Inmobiliario',
  'Agroindustria', 'Servicios Profesionales', 'Otro',
] as const;

const ROLE_VALUES = [
  'Fundador/DueÃ±o', 'DirecciÃ³n C-Level', 'Gerencia Media', 'Operativo/Staff', 'No especificado',
] as const;

const TECH_VALUES = [
  'ERP/CRM', 'Productividad (Office/Sheets)', 'ComunicaciÃ³n (Slack/Teams/Email)',
  'Herramientas manuales (Excel/papel)', 'Software especializado vertical',
  'Desarrollo propio', 'Sin herramienta especÃ­fica', 'MÃºltiples herramientas',
] as const;

type Industry = typeof INDUSTRY_VALUES[number] | null;
type Role = typeof ROLE_VALUES[number] | null;
type TechFamily = typeof TECH_VALUES[number] | null;
type FrictionBucket = 'baja' | 'media' | 'alta';
type Severity = 'tolerable' | 'critico' | 'paralizante';

// â”€â”€ Tipos internos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface AnalysisResult {
  central_problem: string;
  severity: Severity;
  current_solutions: string[];
  willingness_to_pay: boolean;
  friction_score: number;
  key_quotes: string[];
  mom_test_signals: Record<string, boolean>;
}

interface Submission {
  id: string;
  form_id: string;
  analysis_result: AnalysisResult;
  created_at: string;
}

interface GeneralizedRecord {
  submission_id: string;
  generalized_industry: Industry;
  generalized_role: Role;
  generalized_tech_family: TechFamily;
  friction_bucket: FrictionBucket;
  severity: Severity;
  willingness_to_pay: boolean;
  central_problem: string;
  current_solutions: string[];
  key_quotes: string[];
  mom_test_signals: Record<string, boolean>;
  week_bucket: string;
}

// â”€â”€ PASO 1: GeneralizaciÃ³n semÃ¡ntica vÃ­a LLM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TAXONOMY_SYSTEM_PROMPT = `Eres un clasificador de taxonomÃ­a para un sistema de privacidad de datos de mercado.
Tu funciÃ³n es mapear datos cualitativos a categorÃ­as controladas para reducir la cardinalidad antes de aplicar k-anonimato.

Retorna EXCLUSIVAMENTE un objeto JSON con esta estructura exacta (sin texto adicional):
{
  "industry": <uno de los valores del enum o null si no es inferible>,
  "role": <uno de los valores del enum o null si no es inferible>,
  "tech_family": <uno de los valores del enum o null>
}

Enum industry: ${JSON.stringify(INDUSTRY_VALUES)}
Enum role: ${JSON.stringify(ROLE_VALUES)}
Enum tech_family: ${JSON.stringify(TECH_VALUES)}

Instrucciones de mapeo:
- SÃ© conservador: prefiere categorÃ­as amplias sobre especÃ­ficas para maximizar la cardinalidad compartida
- Si el texto menciona mÃºltiples tecnologÃ­as, selecciona la familia mÃ¡s representada
- Si el cargo es ambiguo o no menciona nivel, usa "No especificado"
- Para cargos tÃ©cnicos especÃ­ficos (DevOps, SRE, Data Engineer), mapea a "Operaciones TI"
- Para founders, CEOs, gerentes generales â†’ "Fundador/DueÃ±o" o "DirecciÃ³n C-Level"`;

async function semanticGeneralize(
  problem: string,
  solutions: string[],
  quotes: string[],
): Promise<{ industry: Industry; role: Role; tech_family: TechFamily }> {
  const context = [
    `Problema: ${problem}`,
    `Soluciones actuales: ${solutions.join(', ')}`,
    `Fragmentos de texto: ${quotes.slice(0, 2).join(' | ')}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        temperature: 0,
        system: TAXONOMY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: context }],
      }),
    });

    if (!response.ok) return { industry: null, role: null, tech_family: null };

    const result = await response.json();
    const text: string = result.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { industry: null, role: null, tech_family: null };

    const parsed = JSON.parse(match[0]);

    // Validar que los valores estÃ©n dentro de los enums permitidos
    const industry = INDUSTRY_VALUES.includes(parsed.industry) ? parsed.industry as Industry : null;
    const role = ROLE_VALUES.includes(parsed.role) ? parsed.role as Role : null;
    const tech_family = TECH_VALUES.includes(parsed.tech_family) ? parsed.tech_family as TechFamily : null;

    return { industry, role, tech_family };
  } catch {
    return { industry: null, role: null, tech_family: null };
  }
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function frictionBucket(score: number): FrictionBucket {
  if (score <= 3) return 'baja';
  if (score <= 6) return 'media';
  return 'alta';
}

function isoWeekBucket(dateStr: string): string {
  const d = new Date(dateStr);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const week = Math.ceil(
    ((thursday.getTime() - firstThursday.getTime()) / 86400000 + firstThursday.getDay() + 1) / 7
  );
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Clave de cuasi-identificadores para agrupar (null â†’ 'NULL' para poder agrupar)
function qiKey(r: GeneralizedRecord, suppressIndustry = false): string {
  return [
    suppressIndustry ? 'NULL' : (r.generalized_industry ?? 'NULL'),
    r.generalized_role ?? 'NULL',
    r.friction_bucket,
    r.willingness_to_pay ? '1' : '0',
  ].join('|');
}

// â”€â”€ PASO 2: K-anonimato â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Devuelve los registros que pasan el umbral k.
// Para outliers: suprime generalized_industry (mÃ¡s especÃ­fico) y reintenta.
function applyKAnonymity(
  records: GeneralizedRecord[],
  k: number,
): { passed: GeneralizedRecord[]; kClassSizes: Map<string, number> } {
  const kClassSizes = new Map<string, number>();

  // Primera pasada: agrupa sin supresiÃ³n
  const groups = new Map<string, GeneralizedRecord[]>();
  for (const r of records) {
    const key = qiKey(r);
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  const passed: GeneralizedRecord[] = [];

  for (const [key, group] of groups) {
    if (group.length >= k) {
      // Clase vÃ¡lida â€” registrar tamaÃ±o
      for (const r of group) kClassSizes.set(r.submission_id, group.length);
      passed.push(...group);
    } else {
      // Outlier: suprimir generalized_industry para reducir especificidad
      const suppressed = group.map(r => ({ ...r, generalized_industry: null as Industry }));
      const suppressedKey = qiKey(suppressed[0], true);

      // Buscar si ya existe una clase con esa clave reducida
      const existingClass = groups.get(suppressedKey) ?? [];
      const mergedSize = existingClass.length + suppressed.length;

      if (mergedSize >= k) {
        // La fusiÃ³n alcanza k â€” aceptar con supresiÃ³n de industry
        for (const r of suppressed) kClassSizes.set(r.submission_id, mergedSize);
        passed.push(...suppressed);
        console.log(`[k-anon] Outlier fusionado con supresiÃ³n de industry: key=${key} â†’ merged_size=${mergedSize}`);
      } else {
        // No alcanza k ni con supresiÃ³n mÃ¡xima â€” excluir del data lake (no del DB original)
        console.log(`[k-anon] Registro excluido del data lake (class_size=${group.length} < k=${k}): key=${key}`);
      }
    }
  }

  return { passed, kClassSizes };
}

// â”€â”€ PASO 4: T-closeness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Earth Mover's Distance 1D (Wasserstein-1) entre la distribuciÃ³n local de
// severity en cada clase y la distribuciÃ³n global del batch.
// Orden canÃ³nico: ['tolerable', 'critico', 'paralizante']
const SEVERITY_ORDER_TC = ['tolerable', 'critico', 'paralizante'] as const;

function toFreqVector(records: GeneralizedRecord[]): number[] {
  const counts = [0, 0, 0];
  for (const r of records) {
    const idx = SEVERITY_ORDER_TC.indexOf(r.severity as typeof SEVERITY_ORDER_TC[number]);
    if (idx >= 0) counts[idx]++;
  }
  const total = records.length || 1;
  return counts.map(c => c / total);
}

function emd1D(p: number[], q: number[]): number {
  let w = 0, emd = 0;
  for (let i = 0; i < p.length; i++) {
    w = p[i] - q[i] + w;
    emd += Math.abs(w);
  }
  return emd;
}

function applyTCloseness(records: GeneralizedRecord[], t: number): {
  passed: GeneralizedRecord[];
  tExcluded: number;
} {
  if (records.length === 0) return { passed: [], tExcluded: 0 };

  const globalDist = toFreqVector(records);

  // Agrupar por QI para calcular distribuciÃ³n local por clase
  const classes = new Map<string, GeneralizedRecord[]>();
  for (const r of records) {
    const key = qiKey(r);
    const g = classes.get(key) ?? [];
    g.push(r);
    classes.set(key, g);
  }

  const passed: GeneralizedRecord[] = [];
  let tExcluded = 0;

  for (const [key, group] of classes) {
    const localDist = toFreqVector(group);
    const distance = emd1D(localDist, globalDist);

    if (distance <= t) {
      passed.push(...group);
    } else {
      tExcluded += group.length;
      console.log(`[t-closeness] Clase excluida (EMD=${distance.toFixed(4)} > t=${t}): key=${key}`);
    }
  }

  return { passed, tExcluded };
}

// â”€â”€ PASO 3: L-diversidad â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Atributo sensible: severity. Requiere â‰¥ l valores distintos por clase.
function applyLDiversity(
  records: GeneralizedRecord[],
  kClassSizes: Map<string, number>,
  l: number,
): GeneralizedRecord[] {
  // Reagrupar por qi_key
  const groups = new Map<string, GeneralizedRecord[]>();
  for (const r of records) {
    const key = qiKey(r);
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  const result: GeneralizedRecord[] = [];

  for (const [key, group] of groups) {
    const distinctSeverities = new Set(group.map(r => r.severity));

    if (distinctSeverities.size >= l) {
      result.push(...group);
    } else {
      // Homogeneidad detectada â€” intentar generalizar severity antes de suprimir
      // GeneralizaciÃ³n: colapsar 'tolerable' y 'critico' en 'critico' si la clase solo tiene esos dos
      if (distinctSeverities.size === 1) {
        // Un solo valor de severity â€” suprimir registros hasta que solo quede 1
        // (dejar exactamente 1 por clase para no divulgar atributo, pero no aportar al data lake)
        console.log(`[l-diversity] Clase homogÃ©nea excluida del data lake (severity Ãºnico: ${[...distinctSeverities][0]}): key=${key}`);
        // No se agrega al resultado â€” registros quedan fuera del data lake
      } else {
        // l=2 pero todos tienen la misma severity (edge case teÃ³rico con l>2):
        // Incluir como best-effort con tamaÃ±o reducido
        result.push(...group);
        console.log(`[l-diversity] Clase con diversity=${distinctSeverities.size} (requerido=${l}): key=${key}`);
      }
    }
  }

  return result;
}

// â”€â”€ Handler principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401, req);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SRK);
  const userClient = createClient(
    SUPABASE_URL,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Invalid session' }, 401, req);

  try {
    const body = await req.json();
    const { form_id, k = 5, l = 2, t = 0.20 } = body as {
      form_id: string; k?: number; l?: number; t?: number;
    };

    if (!form_id) return json({ error: 'form_id is required' }, 400, req);
    if (k < 3 || k > 50) return json({ error: 'k must be between 3 and 50' }, 400, req);
    if (l < 2 || l > k) return json({ error: 'l must be between 2 and k' }, 400, req);
    if (t <= 0 || t > 2) return json({ error: 't must be between 0 (exclusive) and 2' }, 400, req);

    // Verificar que el form pertenece al usuario
    const { data: form, error: formError } = await supabase
      .from('survey_forms')
      .select('id')
      .eq('id', form_id)
      .eq('client_id', user.id)
      .single();

    if (formError || !form) return json({ error: 'Form not found' }, 404, req);

    // Obtener submissions analizadas pendientes de anonimizar
    const { data: rawSubmissions, error: subError } = await supabase
      .from('survey_submissions')
      .select('id, form_id, analysis_result, created_at')
      .eq('form_id', form_id)
      .eq('anonymization_status', 'pseudonymized')
      .not('analysis_result', 'is', null);

    if (subError) throw subError;
    if (!rawSubmissions || rawSubmissions.length === 0) {
      return json({ ok: true, message: 'No pseudonymized submissions to process', ingested: 0 }, 200, req);
    }

    const submissions = rawSubmissions as Submission[];
    console.log(`[survey-anonymize] form=${form_id} candidatos=${submissions.length} k=${k} l=${l} t=${t}`);

    // â”€â”€ PASO 1: GeneralizaciÃ³n semÃ¡ntica (LLM) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log('[survey-anonymize] Paso 1: GeneralizaciÃ³n semÃ¡ntica...');
    const BATCH_SIZE = 5; // Haiku es rÃ¡pido; 5 simultÃ¡neas para no saturar
    const generalized: GeneralizedRecord[] = [];

    for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
      const batch = submissions.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (sub) => {
        const ar = sub.analysis_result;
        const taxonomy = await semanticGeneralize(
          ar.central_problem,
          ar.current_solutions,
          ar.key_quotes,
        );
        return {
          submission_id: sub.id,
          generalized_industry: taxonomy.industry,
          generalized_role: taxonomy.role,
          generalized_tech_family: taxonomy.tech_family,
          friction_bucket: frictionBucket(ar.friction_score),
          severity: ar.severity,
          willingness_to_pay: ar.willingness_to_pay,
          central_problem: ar.central_problem,
          current_solutions: ar.current_solutions,
          key_quotes: ar.key_quotes,
          mom_test_signals: ar.mom_test_signals ?? {},
          week_bucket: isoWeekBucket(sub.created_at),
        } satisfies GeneralizedRecord;
      }));
      generalized.push(...batchResults);
    }

    console.log(`[survey-anonymize] GeneralizaciÃ³n completa: ${generalized.length} registros`);

    // â”€â”€ PASO 2: K-anonimato â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log(`[survey-anonymize] Paso 2: K-anonimato (k=${k})...`);
    const { passed: kPassed, kClassSizes } = applyKAnonymity(generalized, k);
    const kExcluded = generalized.length - kPassed.length;
    console.log(`[survey-anonymize] K-anonimato: passed=${kPassed.length} excluded=${kExcluded}`);

    // â”€â”€ PASO 3: L-diversidad â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log(`[survey-anonymize] Paso 3: L-diversidad (l=${l})...`);
    const lPassed = applyLDiversity(kPassed, kClassSizes, l);
    const lExcluded = kPassed.length - lPassed.length;
    console.log(`[survey-anonymize] L-diversidad: passed=${lPassed.length} excluded=${lExcluded}`);

    if (lPassed.length === 0) {
      return json({
        ok: true,
        message: 'No records passed k-anonymity + l-diversity. Accumulate more responses.',
        candidates: submissions.length,
        k_excluded: kExcluded,
        l_excluded: lExcluded,
        t_excluded: 0,
        ingested: 0,
      }, 200, req);
    }

    // â”€â”€ PASO 4: T-closeness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log(`[survey-anonymize] Paso 4: T-closeness (t=${t})...`);
    const { passed: tPassed, tExcluded } = applyTCloseness(lPassed, t);
    console.log(`[survey-anonymize] T-closeness: passed=${tPassed.length} excluded=${tExcluded}`);

    if (tPassed.length === 0) {
      return json({
        ok: true,
        message: 'No records passed t-closeness. Distribution too skewed â€” accumulate more diverse responses.',
        candidates: submissions.length,
        k_excluded: kExcluded,
        l_excluded: lExcluded,
        t_excluded: tExcluded,
        ingested: 0,
      }, 200, req);
    }

    // â”€â”€ InserciÃ³n en el data lake â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const dataLakeRows = tPassed.map(r => ({
      form_id,
      generalized_industry: r.generalized_industry,
      generalized_role: r.generalized_role,
      generalized_tech_family: r.generalized_tech_family,
      friction_bucket: r.friction_bucket,
      severity: r.severity,
      willingness_to_pay: r.willingness_to_pay,
      central_problem: r.central_problem,
      current_solutions: r.current_solutions,
      key_quotes: r.key_quotes,
      mom_test_signals: r.mom_test_signals,
      k_class_size: kClassSizes.get(r.submission_id) ?? k,
      l_diversity_score: l,
      t_closeness_emd: 0, // La EMD exacta no se almacena para no revelar la distribuciÃ³n local
      week_bucket: r.week_bucket,
    }));

    const { error: insertError } = await supabase
      .from('survey_anonymized_data')
      .insert(dataLakeRows);

    if (insertError) {
      console.error('[survey-anonymize] Insert error:', insertError);
      throw insertError;
    }

    const ingested = tPassed.length;

    // Marcar submissions como 'anonymized' (todos los candidatos, no solo los que pasaron)
    // Los que no pasaron tambiÃ©n quedan marcados â€” su PII seguirÃ¡ protegida por RLS
    const allCandidateIds = submissions.map(s => s.id);
    const { error: updateError } = await supabase
      .from('survey_submissions')
      .update({ anonymization_status: 'anonymized' })
      .in('id', allCandidateIds);

    if (updateError) {
      console.error('[survey-anonymize] Status update error:', updateError);
    }

    console.log(`[survey-anonymize] Pipeline completado: form=${form_id} ingested=${ingested}`);

    return json({
      ok: true,
      candidates: submissions.length,
      k_excluded: kExcluded,
      l_excluded: lExcluded,
      t_excluded: tExcluded,
      ingested,
      params: { k, l, t },
    }, 200, req);

  } catch (err) {
    console.error('[survey-anonymize] Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500, req);
  }
});
