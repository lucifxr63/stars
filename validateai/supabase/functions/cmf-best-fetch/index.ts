import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Config ────────────────────────────────────────────────────────────────────
// BEST = "Banco de Estadísticas y Series de Tiempo", CMF Chile
// API docs: https://apibest.cmfchile.cl — autenticación via x-api-key header
// SLA: 24x7, máx 30 min downtime horario principal, 1000 req/hora por key
const BEST_API_BASE = 'https://apibest.cmfchile.cl';

// Cuadros seleccionados para due diligence de startups chilenas.
// TagRecurso = identificador único en BEST (descubierto del bundle Angular del portal).
// Estos 5 cuadros cubren el contexto financiero que un analista de VC necesita
// para evaluar el entorno crediticio y de mercado en Chile.
const CUADROS = [
  {
    tag:   'SBIF_TMC_CL_TRPL_TRUF_PORC_MONT',
    label: 'TMC (Tasa Máxima Convencional, todas las operaciones)',
    key:   'tmc_vigente',
    unit:  '%/mes',
  },
  {
    tag:   'CMF_COMP_TASAS_MNNR_0D90_CCO_CREDCUO_BANC_PORC_MONT',
    label: 'Tasa crédito comercial CLP <90 días (bancos)',
    key:   'tasa_comercial_banc',
    unit:  '%/mes',
  },
  {
    tag:   'CMF_BCOS_IND_BASILEA3_PATEFE_APR_STO_RAZ_PORC_MONT',
    label: 'Solvencia bancaria (Patrimonio Efectivo / APR, Basilea III)',
    key:   'solvencia_basilea',
    unit:  '%',
  },
  {
    tag:   'CMF_CONT_RENTAB_ROE_ANTES_IMPTOS_AGIFI_STO_RAZ_PORC_MONT',
    label: 'Rentabilidad banca (ROE pre-impuestos)',
    key:   'roe_bancario',
    unit:  '%',
  },
  {
    tag:   'CMF_CONT_ACTIV_CRED_CONT_AGIFI_STO_VANR_PORC_MONT',
    label: 'Morosidad cartera crédito (VANR / cartera total)',
    key:   'morosidad',
    unit:  '%',
  },
] as const;

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// ── BEST API fetch ─────────────────────────────────────────────────────────────
// Obtiene los últimos 3 períodos de un cuadro via BEST API v1.
// Retorna null si la key no está configurada o el cuadro no existe (graceful).
interface BestSerie {
  serieInfo: {
    cod_serie:        string;
    descripcion:      string;
    descripcion_corta: string;
    orden_cuadro:     number;
  };
  valores: Array<{ fecha: number; valor: number | null }>;
}

interface BestResponse {
  cuadroInfo: {
    tag:         string;
    nombre:      string;
    subtitulo:   string;
    frecuencia:  string;
  };
  series: BestSerie[];
}

async function fetchCuadro(
  tag: string,
  apiKey: string,
  n = 3,
): Promise<{ cuadro: BestResponse | null; error?: string }> {
  try {
    const url = `${BEST_API_BASE}/api/v1/cuadros/data/${encodeURIComponent(tag)}/top/${n}`;
    const res = await fetch(url, {
      headers: {
        'x-api-key':     apiKey,
        'Accept':        'application/json',
        'Content-Type':  'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 401) return { cuadro: null, error: 'API key inválida (401)' };
    if (res.status === 404) return { cuadro: null, error: `Cuadro "${tag}" no encontrado` };
    if (res.status === 429) return { cuadro: null, error: 'Rate limit BEST API (429)' };
    if (!res.ok)            return { cuadro: null, error: `HTTP ${res.status}` };

    const data = await res.json() as BestResponse;
    return { cuadro: data };
  } catch (err) {
    return { cuadro: null, error: (err as Error).message };
  }
}

// ── Extractor: toma el último valor no-nulo de las series del cuadro ──────────
function extractLatestValue(
  cuadro: BestResponse,
): { value: number | null; fecha: number | null; period: string } {
  // Tomar la primera serie del cuadro (representativa del indicador)
  const serie = cuadro.series?.[0];
  if (!serie) return { value: null, fecha: null, period: 'N/D' };

  // Ordenar valores descendentemente y tomar el primero no-nulo
  const sorted = [...(serie.valores ?? [])].sort((a, b) => b.fecha - a.fecha);
  const latest = sorted.find(v => v.valor !== null && v.valor !== undefined);
  if (!latest) return { value: null, fecha: null, period: 'N/D' };

  // Convertir fecha YYYYMMDD → "MM/YYYY"
  const f = String(latest.fecha);
  const period = f.length === 8 ? `${f.slice(4, 6)}/${f.slice(0, 4)}` : f;

  return { value: latest.valor, fecha: latest.fecha, period };
}

// ── Compressor: convierte los cuadros en ≤250 tokens de contexto analítico ───
function buildSummary(
  results: Array<{
    key:    string;
    label:  string;
    unit:   string;
    value:  number | null;
    period: string;
    error?: string;
  }>,
  apiKey: string,
): string {
  const available = results.filter(r => r.value !== null && !r.error);
  const failed    = results.filter(r => r.value === null || r.error);

  if (available.length === 0) {
    return `[CMF BEST] Sin datos disponibles${apiKey ? '' : ' — CMF_BEST_KEY no configurada'}.`;
  }

  const lines = available.map(r =>
    `  • ${r.label}: ${r.value?.toFixed(2)}${r.unit} (${r.period})`
  );

  const block = [
    '[CMF BEST — Mercado Financiero Chile]',
    ...lines,
  ];

  if (failed.length > 0) {
    block.push(`  ⚠ Sin datos: ${failed.map(r => r.key).join(', ')}`);
  }

  return block.join('\n');
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { validation_id } = await req.json();

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('CMF_BEST_KEY') ?? '';

    // Graceful degradation cuando no hay key configurada
    if (!apiKey) {
      console.warn('cmf-best-fetch: CMF_BEST_KEY no configurada — omitiendo BEST.');
      const payload = {
        available: false,
        reason: 'CMF_BEST_KEY no configurada en Supabase Secrets',
        indicators: {},
        summary: '[CMF BEST] Sin datos — CMF_BEST_KEY no configurada.',
        fetched_at: new Date().toISOString(),
      };
      await supabase.from('temp_context').upsert(
        { user_id: user.id, validation_id, source: 'cmf_best', payload, status: 'pending', created_at: payload.fetched_at },
        { onConflict: 'validation_id,source' },
      );
      return new Response(JSON.stringify({ success: true, available: false, ...payload }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Lanzar todos los cuadros en paralelo con timeout individual
    const fetched = await Promise.all(
      CUADROS.map(async (c) => {
        const { cuadro, error } = await fetchCuadro(c.tag, apiKey);
        if (!cuadro || error) {
          return { key: c.key, label: c.label, unit: c.unit, value: null, period: 'N/D', error };
        }
        const { value, period } = extractLatestValue(cuadro);
        return { key: c.key, label: c.label, unit: c.unit, value, period };
      })
    );

    const summary = buildSummary(fetched, apiKey);

    // Construir indicators map para serialización estructurada
    const indicators: Record<string, { value: number | null; period: string; unit: string }> = {};
    for (const r of fetched) {
      indicators[r.key] = { value: r.value, period: r.period, unit: r.unit };
    }

    const payload = {
      available: true,
      indicators,
      summary,
      fetched_at: new Date().toISOString(),
    };

    // Persistir en temp_context para assemble-mega-prompt
    const { error: upsertError } = await supabase.from('temp_context').upsert(
      { user_id: user.id, validation_id, source: 'cmf_best', payload, status: 'pending', created_at: payload.fetched_at },
      { onConflict: 'validation_id,source' },
    );
    if (upsertError) console.warn('cmf-best-fetch: temp_context upsert warning:', upsertError.message);

    return new Response(JSON.stringify({ success: true, ...payload }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('cmf-best-fetch error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
