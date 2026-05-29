import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_CLASES_NIZA = ['35', '38', '42'];

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

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface INAPIRecord {
  denominacion: string;
  estado: string;
  titular: string;
  clases: string;
  numero_solicitud?: string;
}

// Statuses that represent active, enforceable trademarks in inapi_records
const ACTIVE_STATUSES = ['Registrada', 'En Trámite', 'En trámite', 'Esperando renovación'];

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// ── DB search via inapi_records (trigram index on brand_name) ─────────────────
async function searchINAPILocal(supabase: ReturnType<typeof createClient>, brandName: string): Promise<INAPIRecord[]> {
  // Use pg similarity search — the gin_trgm_ops index makes this fast
  const { data, error } = await supabase.rpc('search_inapi_brands', {
    p_brand_name: brandName,
    p_limit: 25,
  });

  if (error) throw new Error(`DB search error: ${error.message}`);

  return (data ?? []).map((r: Record<string, string>) => ({
    denominacion: r.brand_name ?? '',
    estado: r.status ?? 'Desconocido',
    titular: r.applicants ?? 'N/D',
    clases: Array.isArray(r.niza_classes) ? r.niza_classes.join(', ') : (r.niza_classes ?? ''),
    numero_solicitud: r.application_number,
  }));
}

// ── Collision risk classifier ─────────────────────────────────────────────────
function classifyCollisionRisk(records: INAPIRecord[], brandName: string): {
  colisiones: INAPIRecord[];
  risk_level: 'none' | 'low' | 'medium' | 'high';
  risk_rationale: string;
} {
  const normalized = normalizeText(brandName);

  const activas = records.filter(r =>
    ACTIVE_STATUSES.some(s => r.estado === s)
  );

  const exactas = activas.filter(r => normalizeText(r.denominacion) === normalized);
  const parciales = activas.filter(r => {
    const dn = normalizeText(r.denominacion);
    return dn !== normalized && (dn.includes(normalized) || normalized.includes(dn));
  });

  if (exactas.length > 0) {
    return {
      colisiones: [...exactas, ...parciales],
      risk_level: 'high',
      risk_rationale: `${exactas.length} marca(s) con denominación EXACTA activa en INAPI. El registro de "${brandName}" sería rechazado.`,
    };
  }
  if (parciales.length > 0) {
    return {
      colisiones: parciales,
      risk_level: 'medium',
      risk_rationale: `${parciales.length} marca(s) parcialmente similar(es) activa(s). Posible objeción de INAPI por similitud fonética o conceptual.`,
    };
  }
  return {
    colisiones: [],
    risk_level: 'none',
    risk_rationale: 'Sin colisiones detectadas en el registro INAPI para esta denominación.',
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { brand_name, validation_id } = await req.json();

    if (!brand_name || !validation_id) {
      return new Response(JSON.stringify({ error: 'brand_name y validation_id son requeridos' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 1. Consultar tabla local inapi_records
    const records = await searchINAPILocal(supabase, brand_name);

    // 2. Clasificar riesgo de colisión
    const { colisiones, risk_level, risk_rationale } = classifyCollisionRisk(records, brand_name);

    const payload = {
      brand_name,
      available: true,
      source: 'local_db',
      colisiones,
      risk_level,
      risk_rationale,
      total_records_found: records.length,
      clases_niza_sugeridas: DEFAULT_CLASES_NIZA,
      fetched_at: new Date().toISOString(),
    };

    // 3. Escribir en temp_context para assemble-mega-prompt
    const { error: upsertError } = await supabase
      .from('temp_context')
      .upsert(
        {
          user_id: user.id,
          validation_id,
          source: 'inapi',
          payload,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'validation_id,source' }
      );

    if (upsertError) console.warn('inapi-fetch: temp_context upsert warning:', upsertError.message);

    return new Response(JSON.stringify({
      success: true,
      available: true,
      brand_name,
      colisiones,
      risk_level,
      risk_rationale,
      total_records_found: records.length,
      clases_niza_sugeridas: DEFAULT_CLASES_NIZA,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('inapi-fetch error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
