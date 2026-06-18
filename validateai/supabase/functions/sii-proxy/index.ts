import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { SiiEmpresaSchema, RutSchema } from '../shared-schemas/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SII_API_KEY = Deno.env.get('SII_APIGATEWAY_KEY')!

const CACHE_TTL_DAYS = 7;

const RequestSchema = z.object({
  rut: RutSchema,
});

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

async function getCachedEmpresa(rut: string) {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('sii_empresa_cache')
    .select('data, cached_at')
    .eq('rut', rut)
    .gt('cached_at', cutoff)
    .maybeSingle();

  return data ? SiiEmpresaSchema.parse(data.data) : null;
}

async function setCachedEmpresa(rut: string, empresa: ReturnType<typeof SiiEmpresaSchema.parse>) {
  const supabase = getSupabase();
  await supabase
    .from('sii_empresa_cache')
    .upsert({ rut, data: empresa, cached_at: new Date().toISOString() }, { onConflict: 'rut' });
}

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
      const body = await res.text().catch(() => '');
      console.warn(`SII API ${res.status} for RUT ${rut}: ${body.slice(0, 200)}`);
      if (res.status === 401) throw new Error(`SII_APIGATEWAY_KEY inválida o expirada (401)`);
      if (res.status === 404) throw new Error(`RUT ${rut} no encontrado en SII (404)`);
      return buildFallback(rut);
    }

    const raw = await res.json();

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
    return buildFallback(rut);
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

function buildFallback(rut: string) {
  return SiiEmpresaSchema.parse({
    rut,
    razon_social: 'No disponible (API no respondió)',
    inicio_actividades: null,
    actividades_economicas: [],
    estado_tributario: 'unknown',
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

    const rut = parsed.data.rut;

    // Intentar servir desde caché (TTL 7 días)
    const cached = await getCachedEmpresa(rut);
    const empresa = cached ?? await fetchSiiEmpresa(rut);

    // Guardar en caché si vino de la API (fire and forget)
    if (!cached) setCachedEmpresa(rut, empresa);

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
      cached: Boolean(cached),
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
