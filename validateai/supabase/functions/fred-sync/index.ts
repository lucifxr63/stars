import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cron diario: sincroniza 5 series macro de FRED (Federal Reserve Bank of St. Louis)
// en economic_knowledge. El hot path de la API lee de la tabla; este cron refresca los datos.
// Requiere env: FRED_API_KEY (gratuita en https://fred.stlouisfed.org/docs/api/api_key.html)
// Cron sugerido: 0 13 * * 1-5  (09:00 CLT, días hábiles)

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

const SERIES = [
  {
    id: 'DEXCLUS',
    indicator: 'usd_clp_daily',
    label: 'Tipo de cambio USD/CLP (diario)',
    unit: 'CLP por USD',
  },
  {
    id: 'PCOPPUSDM',
    indicator: 'copper_usd_monthly',
    label: 'Precio del cobre USD/lb (LME mensual)',
    unit: 'USD por libra',
  },
  {
    id: 'FEDFUNDS',
    indicator: 'fed_funds_rate',
    label: 'Tasa Fed Funds USA (mensual)',
    unit: '% anual',
  },
  {
    id: 'CPIAUCSL',
    indicator: 'us_cpi',
    label: 'IPC USA (base 1982-84=100, mensual)',
    unit: 'índice',
  },
  {
    id: 'DCOILWTICO',
    indicator: 'oil_wti_daily',
    label: 'Precio petróleo WTI (diario)',
    unit: 'USD por barril',
  },
];

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const apiKey = Deno.env.get('FRED_API_KEY');
  if (!apiKey) {
    console.error('[fred-sync] FRED_API_KEY no está configurada');
    return new Response(
      JSON.stringify({ error: 'FRED_API_KEY no configurada' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const results: Array<{ series: string; status: 'ok' | 'error'; value?: number; date?: string; error?: string }> = [];

  for (const s of SERIES) {
    try {
      const url = `${FRED_BASE}?series_id=${s.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} al consultar serie ${s.id}`);

      const json = await res.json() as { observations?: Array<{ date: string; value: string }> };

      // FRED usa '.' para indicar dato no disponible; tomamos el primer valor real
      const observations = (json.observations ?? []).filter((o) => o.value !== '.');
      if (observations.length === 0) throw new Error(`Sin observaciones válidas para ${s.id}`);

      const latest = observations[0];
      const value = parseFloat(latest.value);
      const date = latest.date;

      // Guardamos las últimas 3 observaciones para tendencia
      const recent = observations.slice(0, 3).map((o) => ({
        date: o.date,
        value: parseFloat(o.value),
      }));

      const dataJson = { value, date, series_id: s.id, unit: s.unit, recent };
      const contextText =
        `FRED ${s.label}: ${value} ${s.unit} al ${date}. ` +
        `Tendencia reciente: ${recent.map((r) => `${r.date}=${r.value}`).join(', ')}. ` +
        `Fuente: Federal Reserve Bank of St. Louis (FRED).`;

      const { error: dbErr } = await supabase
        .from('economic_knowledge')
        .upsert(
          {
            provider: 'FRED',
            indicator: s.indicator,
            data_json: dataJson,
            context_text: contextText,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'provider,indicator' },
        );

      if (dbErr) throw dbErr;

      console.log(`[fred-sync] ✓ ${s.id}: ${value} ${s.unit} (${date})`);
      results.push({ series: s.id, status: 'ok', value, date });
    } catch (err) {
      console.error(`[fred-sync] ✗ ${s.id}:`, err);
      results.push({ series: s.id, status: 'error', error: String(err) });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.filter((r) => r.status === 'error').length;
  console.log(`[fred-sync] Completado: ${ok} OK, ${failed} errores`);

  return new Response(
    JSON.stringify({ success: failed === 0, synced: ok, errors: failed, results }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
