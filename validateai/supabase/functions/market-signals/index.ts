// Edge Function: market-signals  (Fase 17 / D-lite)
// Sirve el feed de Inteligencia de Mercado del dashboard con INDICADORES REALES
// (USD/CLP, UF, IPC, TPM) desde mindicador.cl — API pública chilena gratuita, la
// misma fuente que ya usa cron-uf-daily. Devuelve el shape MarketSignalsData que
// consume useMarketSignals. Las "señales" son editoriales curadas y honestamente
// etiquetadas (el GraphRAG real de Bralidus es un feed aparte, aún no desplegado).
//
// mindicador.cl exige User-Agent y rate-limitea peticiones rápidas → usamos UNA sola
// llamada a /api (trae todos los indicadores), con reintentos y caché en memoria por
// instancia (10 min, solo éxitos). Si falla del todo devolvemos 502 para que el
// frontend degrade a mock. Sin secretos ni PII. Público (verify_jwt=false).

import { getCorsHeaders } from '../_shared/cors.ts';

const CACHE_MS = 10 * 60 * 1000;
let cache: { at: number; body: unknown } | null = null;

const clp = (v: number) => `$${Math.round(v).toLocaleString('es-CL')}`;
const pct = (v: number) => `${v}%`;

// key en la respuesta de mindicador → cómo mostrarlo. IPC/TPM son tasas (%).
const INDICATORS: { key: string; label: string; fmt: (v: number) => string }[] = [
  { key: 'dolar', label: 'USD/CLP', fmt: clp },
  { key: 'uf',    label: 'UF',      fmt: clp },
  { key: 'ipc',   label: 'IPC mes', fmt: pct },
  { key: 'tpm',   label: 'TPM',     fmt: pct },
];

// Señales editoriales — orientativas, NO GraphRAG. Fuente honesta.
const SIGNALS = [
  {
    id: 's1',
    headline: 'Costo de capital: atento a la TPM',
    detail: 'La Tasa de Política Monetaria marca el costo de financiamiento para rondas semilla locales. Revísala antes de estructurar deuda o convertibles.',
    sentiment: 'neutral' as const,
    source: 'Editorial Validus · Banco Central de Chile',
  },
  {
    id: 's2',
    headline: 'Presión cambiaria y márgenes',
    detail: 'La volatilidad USD/CLP afecta a startups con costos en dólares (infra cloud, APIs de IA). Cubre tu runway si tu quema es en USD.',
    sentiment: 'risk' as const,
    source: 'Editorial Validus · Forex Chile',
  },
  {
    id: 's3',
    headline: 'UF e inflación en contratos',
    detail: 'Arriendos y contratos indexados a UF suben con la inflación. Considera el IPC del mes al proyectar costos fijos.',
    sentiment: 'positive' as const,
    source: 'Editorial Validus · CMF Chile',
  },
];

type MindicadorApi = Record<string, { valor?: number } | undefined>;

async function fetchAll(): Promise<MindicadorApi | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('https://mindicador.cl/api', {
        signal: AbortSignal.timeout(7000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Validus market-signals)', 'Accept': 'application/json' },
      });
      const text = await r.text();
      if (r.ok && text) return JSON.parse(text) as MindicadorApi;
    } catch { /* reintenta */ }
    if (attempt < 3) await new Promise((res) => setTimeout(res, 800 * attempt));
  }
  return null;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const headers = { ...cors, 'Content-Type': 'application/json' };

  if (cache && Date.now() - cache.at < CACHE_MS) {
    return new Response(JSON.stringify(cache.body), { headers });
  }

  const api = await fetchAll();
  if (!api) {
    // mindicador caído tras reintentos → 502 para que el frontend caiga a mock.
    return new Response(JSON.stringify({ error: 'upstream_unavailable' }), { status: 502, headers });
  }

  const indicators = INDICATORS.map((cfg) => {
    const v = api[cfg.key]?.valor;
    return { key: cfg.key, label: cfg.label, value: v != null ? cfg.fmt(v) : '—', deltaPct: null, trend: 'flat' as const };
  });

  const body = { indicators, signals: SIGNALS, asOf: new Date().toISOString(), source: 'live' };
  cache = { at: Date.now(), body };
  return new Response(JSON.stringify(body), { headers });
});
