import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Edge Function: consulta datos de Mercado Público / ChileCompra por RUT de empresa.
// Cachea resultados en economic_knowledge por 24h para no martillar la API.
//
// Requiere env: MERCADOPUBLICO_TICKET
//   Cómo obtener: registrarse en https://www.mercadopublico.cl y solicitar ticket de API
//   desde Mi Cuenta → Datos de la cuenta → Ticket de integración
//
// Endpoints que usa:
//   Proveedor por RUT:   GET /servicios/v1/publico/proveedores/{rut}.json?ticket=...
//   Licitaciones hoy:   GET /servicios/v1/publico/licitaciones.json?estado=publicada&fecha={dd/mm/yyyy}&ticket=...
//   Órdenes de compra:  GET /servicios/v1/publico/ordenesdecompra.json?fecha={dd/mm/yyyy}&ticket=...
//
// NOTA: Para "Compra Ágil" (lanzamiento mayo 2026) confirmar URL base con ChileCompra
// una vez que esté documentada en https://www.chilecompra.cl/compra-agil-api
// La estructura de respuesta podría diferir de la API legacy de Mercado Público.

const MP_BASE = 'https://api.mercadopublico.cl/servicios/v1/publico';
const CACHE_TTL_HOURS = 24;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const ticket = Deno.env.get('MERCADOPUBLICO_TICKET');
  if (!ticket) {
    console.error('[chilecompra-fetch] MERCADOPUBLICO_TICKET no configurado');
    return json(
      { error: 'MERCADOPUBLICO_TICKET no configurado', hint: 'Ver comentario en index.ts' },
      503,
    );
  }

  const url = new URL(req.url);
  const rut = url.searchParams.get('rut');
  const forceRefresh = url.searchParams.get('refresh') === 'true';

  // ── Por RUT: busca proveedor específico ──────────────────────────────────────
  if (rut) {
    // Normaliza RUT: solo dígitos + K (sin puntos ni guión)
    const rutNorm = rut.replace(/[^0-9Kk]/g, '').toUpperCase();
    if (rutNorm.length < 7) return json({ error: 'RUT inválido' }, 400);

    const cacheIndicator = `proveedor_${rutNorm}`;

    // Verifica cache
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('economic_knowledge')
        .select('data_json, updated_at')
        .eq('provider', 'CHILECOMPRA')
        .eq('indicator', cacheIndicator)
        .maybeSingle();

      if (cached) {
        const ageHours = (Date.now() - new Date(cached.updated_at as string).getTime()) / 3_600_000;
        if (ageHours < CACHE_TTL_HOURS) {
          return json({ ...(cached.data_json as object), _cached: true, _age_hours: Math.round(ageHours) });
        }
      }
    }

    // Consulta API
    const mpUrl = `${MP_BASE}/proveedores/${rutNorm}.json?ticket=${ticket}`;
    let mpData: Record<string, unknown>;
    try {
      const res = await fetch(mpUrl, { signal: AbortSignal.timeout(12_000) });
      if (res.status === 404) return json({ error: `RUT ${rut} no encontrado en ChileCompra` }, 404);
      if (!res.ok) throw new Error(`Mercado Público API error ${res.status}`);
      mpData = await res.json() as Record<string, unknown>;
    } catch (err) {
      console.error('[chilecompra-fetch] Error consultando proveedor:', err);
      return json({ error: 'Error al consultar Mercado Público', detail: String(err) }, 502);
    }

    // Persiste en cache
    const contextText =
      `ChileCompra proveedor RUT ${rut}: ` +
      JSON.stringify(mpData).slice(0, 300) +
      ` — Fuente: Mercado Público Chile`;

    await supabase.from('economic_knowledge').upsert(
      {
        provider: 'CHILECOMPRA',
        indicator: cacheIndicator,
        data_json: mpData,
        context_text: contextText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,indicator' },
    );

    console.log(`[chilecompra-fetch] Proveedor ${rut} consultado y cacheado`);
    return json({ ...mpData, _cached: false });
  }

  // ── Sin RUT: retorna licitaciones publicadas hoy ─────────────────────────────
  const today = new Date();
  const dateStr = [
    String(today.getDate()).padStart(2, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    today.getFullYear(),
  ].join('%2F');

  try {
    const licitUrl = `${MP_BASE}/licitaciones.json?estado=publicada&fecha=${dateStr}&ticket=${ticket}`;
    const res = await fetch(licitUrl, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Licitaciones API error ${res.status}`);
    const data = await res.json();
    return json(data);
  } catch (err) {
    console.error('[chilecompra-fetch] Error consultando licitaciones:', err);
    return json({ error: 'Error al consultar licitaciones', detail: String(err) }, 502);
  }
});
