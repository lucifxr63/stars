import { useEffect, useState } from 'react';

// ── Contrato tipado del feed de inteligencia de mercado (Bralidus) ────────────
// Hoy se sirve con datos mock. El día que BralidusPY esté desplegado en prod,
// solo hay que setear VITE_BRALIDUS_API_URL y mapear su respuesta a este shape —
// el resto de la UI (widget + página) no cambia.

export type Trend = 'up' | 'down' | 'flat';
export type Sentiment = 'positive' | 'neutral' | 'risk';

export interface MarketIndicator {
  key: string;
  label: string;
  value: string;        // ya formateado para mostrar
  deltaPct: number | null;
  trend: Trend;
}

export interface MarketSignal {
  id: string;
  headline: string;
  detail: string;
  sentiment: Sentiment;
  source: string;
}

export interface MarketSignalsData {
  indicators: MarketIndicator[];
  signals: MarketSignal[];
  asOf: string;                 // ISO date
  // 'live'     = indicadores reales (mindicador.cl vía Edge market-signals)
  // 'bralidus' = feed GraphRAG real (cuando BralidusPY esté desplegado)
  // 'mock'     = datos de demostración
  source: 'mock' | 'live' | 'bralidus';
}

interface UseMarketSignals {
  data: MarketSignalsData | null;
  loading: boolean;
  error: string | null;
}

// ── Mock determinista — representa el tipo de señal macro que un fundador PyME
// chileno consume de forma recurrente (la razón para volver al Command Center).
const MOCK: MarketSignalsData = {
  asOf: new Date().toISOString(),
  source: 'mock',
  indicators: [
    { key: 'usdclp', label: 'USD/CLP', value: '$948', deltaPct: -0.8, trend: 'down' },
    { key: 'ipsa', label: 'IPSA', value: '6.842', deltaPct: 1.2, trend: 'up' },
    { key: 'uf', label: 'UF', value: '$38.240', deltaPct: 0.1, trend: 'up' },
    { key: 'ipc', label: 'IPC 12m', value: '3.4%', deltaPct: -0.2, trend: 'down' },
  ],
  signals: [
    {
      id: 's1',
      headline: 'Demanda de SaaS B2B en alza en LatAm',
      detail: 'El interés de búsqueda por herramientas de validación y fintech para PyMEs creció de forma sostenida el último trimestre.',
      sentiment: 'positive',
      source: 'Bralidus · Señales de mercado',
    },
    {
      id: 's2',
      headline: 'Tasa de política monetaria estable',
      detail: 'El Banco Central mantuvo la TPM, reduciendo la incertidumbre de costo de capital para rondas semilla locales.',
      sentiment: 'neutral',
      source: 'Banco Central de Chile',
    },
    {
      id: 's3',
      headline: 'Atención: presión cambiaria',
      detail: 'La volatilidad USD/CLP puede afectar márgenes de startups con costos en dólares (infra cloud, APIs de IA).',
      sentiment: 'risk',
      source: 'Bralidus · Forex Chile',
    },
  ],
};

/**
 * Feed de inteligencia de mercado para el Command Center.
 * Asíncrono por diseño (nunca bloquea el render del Dashboard).
 * Si VITE_BRALIDUS_API_URL está definido intenta el feed real; si falla o no
 * está, degrada a mock sin romper la UI.
 */
export function useMarketSignals(): UseMarketSignals {
  const [data, setData] = useState<MarketSignalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const apiUrl = import.meta.env.VITE_BRALIDUS_API_URL as string | undefined;

    async function load() {
      // 1. Bralidus real (GraphRAG) si está configurado.
      if (apiUrl) {
        try {
          const res = await fetch(`${apiUrl.replace(/\/$/, '')}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope: 'market_signals', country: 'CL' }),
          });
          if (!res.ok) throw new Error(`bralidus ${res.status}`);
          const json = (await res.json()) as MarketSignalsData;
          if (!cancelled) { setData({ ...json, source: 'bralidus' }); setLoading(false); }
          return;
        } catch (err) {
          console.warn('[useMarketSignals] bralidus falló, intento Edge:', err);
        }
      }

      // 2. Edge market-signals (indicadores reales vía mindicador.cl) — por defecto.
      const supaUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      if (supaUrl) {
        try {
          const res = await fetch(`${supaUrl.replace(/\/$/, '')}/functions/v1/market-signals`, {
            headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
          });
          if (!res.ok) throw new Error(`market-signals ${res.status}`);
          const json = (await res.json()) as MarketSignalsData;
          if (!cancelled) { setData({ ...json, source: 'live' }); setLoading(false); }
          return;
        } catch (err) {
          console.warn('[useMarketSignals] Edge falló, fallback a mock:', err);
          if (!cancelled) setError(err instanceof Error ? err.message : 'unknown');
        }
      }

      // 3. Degradación elegante: el Command Center nunca queda en blanco.
      await new Promise((r) => setTimeout(r, 300));
      if (!cancelled) { setData(MOCK); setLoading(false); }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
