import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { SiiEmpresaSchema, RutSchema } from '../shared-schemas/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SII API Gateway key (from sync-economic-data precedent)
const SII_API_KEY = Deno.env.get('SII_API_KEY') ?? '6beb0b4a869028e8031f7862a039dede5f759bc8';

const RequestSchema = z.object({
  rut: RutSchema,
});

/**
 * Fetches empresa info from SII API Gateway.
 * Returns a normalized SiiEmpresa object with fallback on API failure.
 */
async function fetchSiiEmpresa(rut: string) {
  const rutClean = rut.replace(/\./g, '').replace('-', '');

  try {
    const url = `https://app.apigateway.cl/api/v2/sii/contribuyentes/${rutClean}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Token ${SII_API_KEY}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`SII API returned ${res.status} for RUT ${rut}`);
      return buildFallback(rut, 'unknown');
    }

    const raw = await res.json();

    // Normalize the API response to our schema
    const normalized = {
      rut,
      razon_social: raw.razon_social ?? raw.nombre ?? 'Desconocido',
      inicio_actividades: raw.inicio_actividades ?? raw.fecha_inicio_actividades ?? null,
      actividades_economicas: (raw.actividades_economicas ?? raw.giros ?? []).map((a: any) => ({
        codigo: String(a.codigo ?? a.code ?? ''),
        descripcion: a.descripcion ?? a.description ?? '',
      })),
      estado_tributario: mapEstadoTributario(raw.estado ?? raw.estado_tributario ?? ''),
      anotaciones_vigentes: Boolean(raw.anotaciones_vigentes ?? raw.anotaciones ?? false),
    };

    return SiiEmpresaSchema.parse(normalized);

  } catch (err) {
    console.error('sii-proxy fetch error:', err);
    return buildFallback(rut, 'unknown');
  }
}

function mapEstadoTributario(raw: string): 'Vigente' | 'Sin Inicio de Actividades' | 'Bloqueado' | 'No Existe' | 'unknown' {
  const s = raw.toLowerCase();
  if (s.includes('vigente')) return 'Vigente';
  if (s.includes('inicio') || s.includes('sin inicio')) return 'Sin Inicio de Actividades';
  if (s.includes('bloqueado') || s.includes('bloqueo')) return 'Bloqueado';
  if (s.includes('no existe') || s.includes('inexistente')) return 'No Existe';
  return 'unknown';
}

function buildFallback(rut: string, estado: 'unknown') {
  return SiiEmpresaSchema.parse({
    rut,
    razon_social: 'No disponible (API no respondió)',
    inicio_actividades: null,
    actividades_economicas: [],
    estado_tributario: estado,
    anotaciones_vigentes: false,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(JSON.stringify({
        error: 'Validación fallida',
        details: parsed.error.flatten().fieldErrors,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const empresa = await fetchSiiEmpresa(parsed.data.rut);

    // Derive risk classification per US-01 acceptance criteria
    const riesgoRegulatorio = empresa.estado_tributario === 'Sin Inicio de Actividades'
      ? 'Alto'
      : empresa.estado_tributario === 'Bloqueado'
      ? 'Alto'
      : empresa.estado_tributario === 'No Existe'
      ? 'Alto'
      : empresa.estado_tributario === 'unknown'
      ? 'Indeterminado'
      : 'Bajo';

    return new Response(JSON.stringify({
      success: true,
      data: empresa,
      risk_classification: {
        nivel: riesgoRegulatorio,
        razon: riesgoRegulatorio === 'Alto'
          ? `Estado tributario "${empresa.estado_tributario}" implica riesgo regulatorio alto.`
          : 'Empresa con actividades vigentes en SII.',
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('sii-proxy error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
