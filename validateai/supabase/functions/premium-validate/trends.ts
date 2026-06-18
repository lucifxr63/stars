// Agente Google Trends (SerpApi) del flujo premium, extraído de premium-validate
// (#T3.5 W3). SERPAPI_KEY relocada; la math de trayectoria extraída a trajectoryOf (pura).
const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');

/** Trayectoria de interés: 1ra mitad vs 2da. Pura → testeable. */
export function trajectoryOf(values: number[]): 'upward' | 'downward' | 'stable' {
  const first6 = values.slice(0, Math.floor(values.length / 2));
  const last6 = values.slice(Math.floor(values.length / 2));
  const firstAvg = first6.length ? first6.reduce((a, b) => a + b, 0) / first6.length : 0;
  const lastAvg = last6.length ? last6.reduce((a, b) => a + b, 0) / last6.length : 0;
  return lastAvg > firstAvg * 1.1 ? 'upward' : lastAvg < firstAvg * 0.9 ? 'downward' : 'stable';
}

async function fetchTrendsReal(idea: string): Promise<unknown> {
  const keyword = encodeURIComponent(idea.slice(0, 100));
  const url = `https://serpapi.com/search.json?engine=google_trends&q=${keyword}&date=today+12-m&api_key=${SERPAPI_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi error: ${res.status}`);

  const data = await res.json();
  const timeline: { date: string; values: { query: string; value: number }[] }[] = data.interest_over_time?.timeline_data ?? [];

  const values = timeline.flatMap((t) => t.values.map((v) => v.value)).filter((v) => v > 0);
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

  const trajectory = trajectoryOf(values);

  const related = (data.related_queries?.rising ?? []).slice(0, 4).map(
    (q: { query: string }) => q.query,
  );

  return {
    status: 'success',
    source: 'Google Trends (SerpApi)',
    keyword: idea.slice(0, 100),
    average_interest_last_12_months: avg,
    trend_trajectory: trajectory,
    related_breakout_queries: related,
    data_points: timeline.length,
  };
}

// deno-lint-ignore require-await -- el throw debe ser promesa rechazada (Promise.allSettled)
export async function fetchTrends(idea: string): Promise<unknown> {
  if (!SERPAPI_KEY) {
    throw new Error('SERPAPI_KEY not configured — set SERPAPI_KEY in Supabase secrets');
  }
  return fetchTrendsReal(idea);
}
