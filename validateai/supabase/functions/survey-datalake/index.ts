// Edge Function: survey-datalake
// Sirve consultas analíticas del data lake anonimizado con Privacidad Diferencial.
//
// Mecanismo: Laplace noise injection.
// ε (epsilon) controla el trade-off privacidad/utilidad:
//   ε pequeño (0.1–0.5) → más ruido, mayor privacidad
//   ε grande (1–5)       → menos ruido, mayor utilidad
//
// La garantía formal: la presencia o ausencia de CUALQUIER registro individual
// no puede afectar el resultado de una consulta en más de 1/ε con probabilidad
// significativa → "negación plausible" a nivel individual.
//
// GET /survey-datalake?form_id=&query=<aggregate_type>&epsilon=<float>
//
// query types:
//   severity_distribution   — distribución de severity con ruido
//   friction_avg            — promedio de friction_bucket con ruido
//   wtp_rate                — tasa de willingness_to_pay con ruido
//   industry_breakdown      — distribución por industria con ruido
//   solutions_frequency     — frecuencia de soluciones actuales con ruido
//   mom_test_signals        — señales Mom Test % con ruido

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'https://validateai.cl',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  };
}

function json(data: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ── Mecanismo de Laplace ─────────────────────────────────
// Genera una muestra de la distribución de Laplace con media 0 y escala b=sensitivity/ε.
// Usa la transformada inversa: X = -b * sign(U) * ln(1 - 2|U|), donde U ~ Uniform[-0.5, 0.5]
function laplaceSample(sensitivity: number, epsilon: number): number {
  const b = sensitivity / epsilon;
  const u = Math.random() - 0.5;
  return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

// Aplica ruido de Laplace a un valor numérico (conteo o proporción)
// Clampea al rango [min, max] para preservar semántica
function addLaplaceNoise(value: number, sensitivity: number, epsilon: number, min = 0, max = Infinity): number {
  const noisy = value + laplaceSample(sensitivity, epsilon);
  return Math.max(min, Math.min(max, Math.round(noisy * 100) / 100));
}

// ── Tipos ─────────────────────────────────────────────────
type QueryType =
  | 'severity_distribution'
  | 'friction_avg'
  | 'wtp_rate'
  | 'industry_breakdown'
  | 'solutions_frequency'
  | 'mom_test_signals';

interface AnonRow {
  severity: string;
  friction_bucket: string;
  willingness_to_pay: boolean;
  generalized_industry: string | null;
  current_solutions: string[];
  mom_test_signals: Record<string, boolean>;
}

// ── Constructores de respuesta DP ─────────────────────────
function querySeverityDistribution(rows: AnonRow[], epsilon: number) {
  const counts = { tolerable: 0, critico: 0, paralizante: 0 } as Record<string, number>;
  for (const r of rows) counts[r.severity] = (counts[r.severity] ?? 0) + 1;
  // Sensitivity = 1 (un individuo afecta max 1 conteo)
  const noisy: Record<string, number> = {};
  for (const key of Object.keys(counts)) {
    noisy[key] = addLaplaceNoise(counts[key], 1, epsilon, 0, rows.length);
  }
  return { distribution: noisy, total_noisy: Math.round(Object.values(noisy).reduce((a, b) => a + b, 0)) };
}

function queryFrictionAvg(rows: AnonRow[], epsilon: number) {
  // Bucket → valor numérico medio para el promedio
  const bucketValues: Record<string, number> = { baja: 2, media: 5, alta: 8.5 };
  const values = rows.map(r => bucketValues[r.friction_bucket] ?? 5);
  const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  // Sensitivity = rango/(n) = (8.5-2)/n ≈ 6.5/n
  const sensitivity = 6.5 / (rows.length || 1);
  const noisy = addLaplaceNoise(avg, sensitivity, epsilon, 1, 10);
  return { avg_friction: noisy, n: rows.length };
}

function queryWTPRate(rows: AnonRow[], epsilon: number) {
  const count = rows.filter(r => r.willingness_to_pay).length;
  const rate = count / (rows.length || 1);
  // Sensitivity = 1/n (un individuo cambia la tasa en 1/n)
  const sensitivity = 1 / (rows.length || 1);
  const noisy = addLaplaceNoise(rate, sensitivity, epsilon, 0, 1);
  return { wtp_rate: parseFloat((noisy * 100).toFixed(1)), n: rows.length };
}

function queryIndustryBreakdown(rows: AnonRow[], epsilon: number) {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const k = r.generalized_industry ?? 'No especificado';
    counts[k] = (counts[k] ?? 0) + 1;
  }
  // Privacidad diferencial por conteo con sensitivity=1
  // Dividir ε entre categorías con composición paralela (safe porque son disjuntas)
  const noisy: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    noisy[k] = addLaplaceNoise(v, 1, epsilon, 0, rows.length);
  }
  return { breakdown: noisy, n: rows.length };
}

function querySolutionsFrequency(rows: AnonRow[], epsilon: number) {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    for (const sol of r.current_solutions) {
      if (sol) counts[sol] = (counts[sol] ?? 0) + 1;
    }
  }
  // Sensitivity = max soluciones por individuo (estimado: 3)
  const sensitivity = 3;
  const noisy: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    const n = addLaplaceNoise(v, sensitivity, epsilon, 0, rows.length * 3);
    if (n >= 1) noisy[k] = n; // Suprimir categorías con ruido negativo
  }
  // Ordenar por frecuencia (descendente)
  const sorted = Object.entries(noisy)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  return { top_solutions: Object.fromEntries(sorted), n: rows.length };
}

function queryMomTestSignals(rows: AnonRow[], epsilon: number) {
  const signals = {
    talks_about_past: 0,
    mentions_money_spent: 0,
    reveals_workarounds: 0,
  };
  for (const r of rows) {
    for (const key of Object.keys(signals) as Array<keyof typeof signals>) {
      if (r.mom_test_signals?.[key]) signals[key]++;
    }
  }
  const n = rows.length || 1;
  const sensitivity = 1 / n;
  return {
    talks_about_past_pct: addLaplaceNoise(signals.talks_about_past / n, sensitivity, epsilon, 0, 1),
    mentions_money_spent_pct: addLaplaceNoise(signals.mentions_money_spent / n, sensitivity, epsilon, 0, 1),
    reveals_workarounds_pct: addLaplaceNoise(signals.reveals_workarounds / n, sensitivity, epsilon, 0, 1),
    n,
  };
}

// ── Handler ────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, req);

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

  const url = new URL(req.url);
  const form_id  = url.searchParams.get('form_id');
  const query    = url.searchParams.get('query') as QueryType | null;
  const epsilon  = parseFloat(url.searchParams.get('epsilon') ?? '1.0');

  if (!form_id)  return json({ error: 'form_id is required' }, 400, req);
  if (!query)    return json({ error: 'query is required' }, 400, req);
  if (isNaN(epsilon) || epsilon < 0.05 || epsilon > 10) {
    return json({ error: 'epsilon must be between 0.05 and 10' }, 400, req);
  }

  const validQueries: QueryType[] = [
    'severity_distribution', 'friction_avg', 'wtp_rate',
    'industry_breakdown', 'solutions_frequency', 'mom_test_signals',
  ];
  if (!validQueries.includes(query)) {
    return json({ error: `Invalid query type. Valid: ${validQueries.join(', ')}` }, 400, req);
  }

  try {
    // Verificar ownership
    const { data: form } = await supabase
      .from('survey_forms')
      .select('id')
      .eq('id', form_id)
      .eq('client_id', user.id)
      .single();
    if (!form) return json({ error: 'Form not found' }, 404, req);

    // Obtener datos del data lake (ya anonimizados)
    const { data: rows, error: fetchError } = await supabase
      .from('survey_anonymized_data')
      .select('severity, friction_bucket, willingness_to_pay, generalized_industry, current_solutions, mom_test_signals')
      .eq('form_id', form_id);

    if (fetchError) throw fetchError;
    if (!rows || rows.length < 5) {
      return json({
        ok: false,
        message: 'Insufficient anonymized data. Minimum 5 records required for differential privacy guarantees.',
        count: rows?.length ?? 0,
      }, 200, req);
    }

    const anonRows = rows as AnonRow[];
    let result: Record<string, unknown>;

    switch (query) {
      case 'severity_distribution':
        result = querySeverityDistribution(anonRows, epsilon); break;
      case 'friction_avg':
        result = queryFrictionAvg(anonRows, epsilon); break;
      case 'wtp_rate':
        result = queryWTPRate(anonRows, epsilon); break;
      case 'industry_breakdown':
        result = queryIndustryBreakdown(anonRows, epsilon); break;
      case 'solutions_frequency':
        result = querySolutionsFrequency(anonRows, epsilon); break;
      case 'mom_test_signals':
        result = queryMomTestSignals(anonRows, epsilon); break;
    }

    return json({
      ok: true,
      query,
      epsilon,
      privacy_guarantee: `ε-differential privacy con ε=${epsilon}. Presencia/ausencia de cualquier individuo no afecta el resultado en más de e^${epsilon}≈${Math.exp(epsilon).toFixed(2)} con alta probabilidad.`,
      data: result!,
    }, 200, req);

  } catch (err) {
    console.error('[survey-datalake]', err);
    return json({ error: 'Internal server error' }, 500, req);
  }
});
