import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cron diario: obtiene el valor actual de la UF desde mindicador.cl (libre, sin auth)
// y lo persiste en economic_knowledge (provider='CMF', indicator='uf_diario').
// Toda la aplicación lee de esa fila en lugar de llamar APIs externas en el hot path.

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // CMF endpoint público (no requiere apikey para el valor actual)
    const res = await fetch('https://api.cmfchile.cl/api-sbifv3/recursos_api/uf?formato=json', {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`CMF API error ${res.status}`);

    const raw = await res.json();
    const latest = raw?.UFs?.[0];
    if (!latest) throw new Error('CMF respondió sin datos de UF');

    const valor: number = parseFloat(String(latest.Valor).replace('.', '').replace(',', '.'));
    const fecha: string = latest.Fecha; // '2026-05-23'

    const dataJson = { valor, fecha };
    const contextText = `UF diaria: $${valor.toFixed(2)} CLP al ${fecha} (fuente: CMF Chile)`;

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
