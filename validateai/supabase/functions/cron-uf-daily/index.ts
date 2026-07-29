import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cron diario: obtiene el valor actual de la UF desde mindicador.cl (libre, sin auth)
// y lo persiste en economic_knowledge (provider='CMF', indicator='uf_diario').
// (Touch: validación del pipeline CI deno-test + auto-deploy de edge functions.)
// Toda la aplicación lee de esa fila en lugar de llamar APIs externas en el hot path.

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fuente: mindicador.cl — libre y sin auth, republica la UF oficial que fija
    // el Banco Central y publica la CMF.
    //
    // Antes esto llamaba a api.cmfchile.cl/api-sbifv3 con el comentario "no
    // requiere apikey". Sí la requiere: sin ella devuelve HTTP 422, así que la
    // función respondía 500 en cada invocación. Como además nunca estuvo
    // agendada en cron.job, nadie vio los 500 y `economic_knowledge` quedó
    // congelada en su última escritura manual (2026-05-24) durante ~66 días,
    // mientras /data/macro servía ese valor como si fuera vigente.
    const res = await fetch('https://mindicador.cl/api/uf', {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`mindicador.cl error ${res.status}`);

    const raw = await res.json();
    const latest = raw?.serie?.[0];
    if (!latest) throw new Error('mindicador.cl respondió sin serie de UF');

    const valor: number = Number(latest.valor);
    if (!Number.isFinite(valor)) throw new Error(`Valor de UF no numérico: ${latest.valor}`);
    // La serie viene con timestamp ISO ('2026-07-29T04:00:00.000Z'); se guarda
    // sólo la fecha, que es la granularidad real del indicador.
    const fecha: string = String(latest.fecha).slice(0, 10);

    const dataJson = { valor, fecha, fuente: 'mindicador.cl' };
    const contextText = `UF diaria: $${valor.toFixed(2)} CLP al ${fecha} (fuente: mindicador.cl, UF oficial CMF/BCCh)`;

    const { error } = await supabase
      .from('economic_knowledge')
      .upsert(
        {
          provider: 'CMF',
          indicator: 'uf_diario',
          data_json: dataJson,
          context_text: contextText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider,indicator' },
      );

    if (error) throw error;

    console.log(`[cron-uf-daily] UF sincronizada: ${valor} CLP (${fecha})`);

    return new Response(
      JSON.stringify({ success: true, valor, fecha }),
      { headers: { 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[cron-uf-daily] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
