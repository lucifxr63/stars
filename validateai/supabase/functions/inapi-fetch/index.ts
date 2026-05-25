import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Config ────────────────────────────────────────────────────────────────────
// INAPI expone su registro de marcas mediante un endpoint OData público.
// No requiere API key para consultas de solo-lectura (búsqueda de marcas).
// Endpoint: https://tmapi.inapi.cl/odata/v1/Solicitudes
const INAPI_ODATA_BASE = 'https://tmapi.inapi.cl/odata/v1/Solicitudes';

// Clases Niza relevantes para SaaS B2B (tecnología y servicios profesionales)
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

// ── INAPI OData query ─────────────────────────────────────────────────────────
interface INAPIRecord {
  denominacion: string;
  estado: string;
  titular: string;
  clases: string;
  numero_solicitud?: string;
}

// Normaliza la denominación para comparación fuzzy:
// elimina tildes, espacios múltiples y convierte a uppercase.
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

async function searchINAPI(brandName: string): Promise<INAPIRecord[]> {
  const normalized = normalizeText(brandName);

  // OData $filter: busca marcas cuya denominación contenga el término (case-insensitive)
  // $select: solo campos relevantes para el análisis — reduce payload
  // $top: máximo 20 resultados para análisis de colisión
  const params = new URLSearchParams({
    '$filter': `contains(toupper(Denominacion), '${normalized.replace(/'/g, "''")}')`,
    '$select': 'Denominacion,EstadoSolicitud,TitularNombreEmpresa,ClasesNiza,NumeroSolicitud',
    '$top': '20',
    '$format': 'json',
  });

  const url = `${INAPI_ODATA_BASE}?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ValidateAI/1.0 (due-diligence; lucianoalonso2000@gmail.com)',
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    throw new Error(`INAPI OData HTTP ${res.status} — endpoint puede requerir verificación`);
  }

  const data = await res.json();
  // La API OData devuelve { value: [...] }
  const records = (data.value ?? []) as Array<Record<string, string>>;

  return records.map(r => ({
    denominacion: r.Denominacion ?? r.denominacion ?? '',
    estado: r.EstadoSolicitud ?? r.estado ?? 'Desconocido',
    titular: r.TitularNombreEmpresa ?? r.titular ?? 'N/D',
    clases: r.ClasesNiza ?? r.clases ?? '',
    numero_solicitud: r.NumeroSolicitud ?? r.numero_solicitud,
  }));
}

// ── Collision risk classifier ─────────────────────────────────────────────────
// Solo marcas en estado "vigente" o "concedida" representan riesgo real de colisión.
const ACTIVE_STATES = ['vigente', 'concedida', 'registrada', 'activa', 'en tramitación'];

function classifyCollisionRisk(records: INAPIRecord[], brandName: string): {
  colisiones: INAPIRecord[];
  risk_level: 'none' | 'low' | 'medium' | 'high';
  risk_rationale: string;
} {
  const normalized = normalizeText(brandName);

  // Filtrar solo marcas activas
  const activas = records.filter(r =>
    ACTIVE_STATES.some(s => r.estado.toLowerCase().includes(s))
  );

  // Colisión exacta (misma denominación normalizada)
  const exactas = activas.filter(r => normalizeText(r.denominacion) === normalized);

  // Colisión parcial (la denominación contiene o está contenida en la búsqueda)
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

    // 1. Consultar INAPI OData
    let records: INAPIRecord[] = [];
    let apiAvailable = true;
    let apiError: string | undefined;

    try {
      records = await searchINAPI(brand_name);
    } catch (err) {
      // Si INAPI no responde, continuamos con resultado vacío + advertencia
      apiAvailable = false;
      apiError = (err as Error).message;
      console.warn('inapi-fetch: API INAPI no disponible:', err);
    }

    // 2. Clasificar riesgo de colisión
    const { colisiones, risk_level, risk_rationale } = classifyCollisionRisk(records, brand_name);

    const payload = {
      brand_name,
      available: apiAvailable,
      api_error: apiError,
      colisiones,
      risk_level,
      risk_rationale,
      total_records_found: records.length,
      clases_niza_sugeridas: DEFAULT_CLASES_NIZA,
      fetched_at: new Date().toISOString(),
    };

    // 3. Escribir en temp_context para que assemble-mega-prompt lo consuma
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

    // 4. Responder con resultado completo
    // assemble-mega-prompt también llama a esta función inline vía callEdgeFunction(),
    // por eso retornamos el payload directamente además de escribirlo en temp_context.
    return new Response(JSON.stringify({
      success: true,
      available: apiAvailable,
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
