import axios from 'axios';

export interface PostData {
  id: number;
  tag_sistema: string;
  titulo: string;
  subtitulo: string;
  metrica: string;
  benchmark: string;
  saludable: string;
  peligro: string;
  insight: string;
  chartLabels: string[];
  chartData: number[];
  chartType: 'line' | 'bar';
  fuente: string;
}

// ─── Mindicador.cl (Chile) ───────────────────────────────────────────────────
async function fetchMindicador(codigo: string): Promise<{ nombre: string; serie: { fecha: string; valor: number }[] }> {
  const res = await axios.get(`https://mindicador.cl/api/${codigo}`, { timeout: 10000 });
  return res.data;
}

// ─── Banco Central (BCCH) ────────────────────────────────────────────────────
const BCCH_USER = process.env.BDE_USER ?? '';
const BCCH_PASS = process.env.BDE_PASS ?? '';

async function fetchBCCH(seriesId: string, firstdate: string, lastdate: string) {
  const url = `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?user=${encodeURIComponent(BCCH_USER)}&pass=${encodeURIComponent(BCCH_PASS)}&function=GetSeries&timeseries=${seriesId}&firstdate=${firstdate}&lastdate=${lastdate}&format=json`;
  const res = await axios.get(url, { timeout: 10000 });
  if (res.data.Codigo !== 0) throw new Error(`BCCH error: ${res.data.Descripcion}`);
  return res.data.Series.Obs as { indexDateString: string; value: string }[];
}

// ─── World Bank ──────────────────────────────────────────────────────────────
async function fetchWorldBank(indicator: string, countries: string[], mrv = 5) {
  const iso = countries.join(';');
  const url = `https://api.worldbank.org/v2/country/${iso}/indicator/${indicator}?format=json&mrv=${mrv}&per_page=${mrv * countries.length}`;
  const res = await axios.get(url, { timeout: 10000 });
  return res.data[1] as { countryiso3code: string; date: string; value: number | null; country: { value: string } }[];
}

function fmt(n: number, decimals = 1) { return n.toFixed(decimals); }
function parseDate(d: string) { return d.slice(0, 7); } // "YYYY-MM"
function parseBCCHDate(d: string) { // "DD-MM-YYYY" → "MM/YY"
  const [, m, y] = d.split('-');
  return `${m}/${y.slice(2)}`;
}

// ─── Generadores de Posts ─────────────────────────────────────────────────────

async function postUSDCLP(): Promise<PostData> {
  const obs = await fetchBCCH('F073.TCO.PRE.Z.D', '2026-02-01', new Date().toISOString().slice(0, 10));
  const recent = obs.slice(-30); // últimos 30 días hábiles
  const labels = recent.filter((_, i) => i % 6 === 0).map(o => parseBCCHDate(o.indexDateString));
  const data = recent.filter((_, i) => i % 6 === 0).map(o => parseFloat(o.value));
  const last = parseFloat(obs[obs.length - 1].value);
  const prev = parseFloat(obs[0].value);
  const delta = ((last - prev) / prev * 100).toFixed(1);
  const tendencia = last > prev ? 'al alza' : 'a la baja';

  return {
    id: 1,
    tag_sistema: '/SYS/FX/CHILE-2026',
    titulo: `El dólar ${tendencia}: impacto real en tu startup`,
    subtitulo: `Con USD/CLP en $${last.toFixed(0)}, los costos en dólares presionan los márgenes B2B.`,
    metrica: 'USD/CLP (Dólar Observado)',
    benchmark: `$${last.toFixed(0)}`,
    saludable: last < 900 ? 'Bajo $900 → margen estable' : 'Hedging activo',
    peligro: last > 950 ? `Sobre $950 → costos +${delta}%` : `Volatilidad ±${Math.abs(parseFloat(delta)).toFixed(0)}%`,
    insight: `El tipo de cambio pasó de $${prev.toFixed(0)} a $${last.toFixed(0)} en 30 días (${delta > '0' ? '+' : ''}${delta}%). Para startups SaaS con costos en USD (AWS, Stripe, herramientas), esto comprime directamente el EBITDA sin acción del equipo.`,
    chartLabels: labels,
    chartData: data,
    chartType: 'line',
    fuente: 'Banco Central de Chile',
  };
}

async function postUF(): Promise<PostData> {
  const obs = await fetchBCCH('F073.UFF.PRE.Z.D', '2026-01-01', new Date().toISOString().slice(0, 10));
  const recent = obs.slice(-60);
  const labels = recent.filter((_, i) => i % 10 === 0).map(o => parseBCCHDate(o.indexDateString));
  const data = recent.filter((_, i) => i % 10 === 0).map(o => parseFloat(o.value));
  const last = parseFloat(obs[obs.length - 1].value);
  const firstYear = parseFloat(obs[0].value);
  const crecimiento = ((last - firstYear) / firstYear * 100).toFixed(2);

  return {
    id: 2,
    tag_sistema: '/SYS/MACRO/CHILE-2026',
    titulo: 'La UF en 2026: el ancla que mueve contratos B2B',
    subtitulo: `Con UF en $${last.toFixed(2)}, los contratos indexados están renegociando márgenes.`,
    metrica: 'Valor UF (CLP)',
    benchmark: `$${last.toFixed(0)}`,
    saludable: 'Contratos indexados UF → protegido',
    peligro: 'Precio fijo CLP → pérdida real',
    insight: `La UF acumula un ${crecimiento}% de crecimiento en lo que va de 2026. Startups B2B con contratos en pesos fijos están absorbiendo inflación sin compensación. La indexación a UF en contratos anuales ya no es opcional: es defensa del margen.`,
    chartLabels: labels,
    chartData: data,
    chartType: 'line',
    fuente: 'Banco Central de Chile',
  };
}

async function postIPC(): Promise<PostData> {
  const { serie } = await fetchMindicador('ipc');
  const recent = serie.slice(0, 12).reverse();
  const labels = recent.map(d => d.fecha.slice(0, 7));
  const data = recent.map(d => d.valor);
  const last = data[data.length - 1];
  const acum = data.reduce((a, b) => a + b, 0);

  return {
    id: 3,
    tag_sistema: '/SYS/MACRO/IPC-2026',
    titulo: 'Inflación mensual en Chile: lo que el IPC no dice',
    subtitulo: 'Los costos operativos suben aunque el IPC parezca bajo.',
    metrica: 'Variación IPC Mensual (%)',
    benchmark: `${last}%`,
    saludable: '< 0.3% mensual → costos controlados',
    peligro: '> 0.5% mensual → presión real',
    insight: `El IPC acumula ${acum.toFixed(1)}% en los últimos 12 meses. Para startups B2B con equipos en Chile, esto se traduce directamente en presión salarial: los reajustes de remuneraciones que el equipo espera no son discrecionales, son obligaciones implícitas del mercado laboral.`,
    chartLabels: labels,
    chartData: data,
    chartType: 'bar',
    fuente: 'INE / mindicador.cl',
  };
}

async function postTPM(): Promise<PostData> {
  const { serie } = await fetchMindicador('tpm');
  const recent = serie.slice(0, 18).reverse();
  const labels = recent.map(d => d.fecha.slice(0, 7));
  const data = recent.map(d => d.valor);
  const last = data[data.length - 1];

  return {
    id: 4,
    tag_sistema: '/SYS/MACRO/TASAS-2026',
    titulo: `TPM en ${last}%: el costo invisible del capital`,
    subtitulo: 'La tasa de política monetaria define cuánto cuesta financiar tu crecimiento.',
    metrica: 'Tasa Política Monetaria (%)',
    benchmark: `${last}%`,
    saludable: '< 4% → deuda a costo razonable',
    peligro: '> 5% → equity más barato que deuda',
    insight: `Con TPM en ${last}%, el crédito en Chile sigue caro. Para startups pre-revenue o pre-breakeven, esto no es trivial: un préstamo de desarrollo a tasa variable puede destruir runway en 6 meses. La alternativa — equity — diluye más, pero no te mata con intereses.`,
    chartLabels: labels,
    chartData: data,
    chartType: 'line',
    fuente: 'Banco Central de Chile / mindicador.cl',
  };
}

async function postGDPLatam(): Promise<PostData> {
  const countries = ['CL', 'MX', 'CO', 'AR', 'BR', 'PE'];
  const names: Record<string, string> = { CL: 'Chile', MX: 'México', CO: 'Colombia', AR: 'Argentina', BR: 'Brasil', PE: 'Perú' };
  const raw = await fetchWorldBank('NY.GDP.MKTP.KD.ZG', countries, 1);
  const latest = countries
    .map(iso => raw.find(r => r.countryiso3code === iso || r.country.value.includes(names[iso])))
    .filter(Boolean)
    .map(r => ({ label: names[r!.countryiso3code] ?? r!.country.value, value: r!.value ?? 0 }));

  const sorted = [...latest].sort((a, b) => b.value - a.value);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return {
    id: 5,
    tag_sistema: '/SYS/LATAM/GDP-2025',
    titulo: 'PIB LatAm 2025: dónde crecer y dónde no quemar runway',
    subtitulo: 'El crecimiento económico define el tamaño del mercado disponible para tu startup.',
    metrica: 'Crecimiento PIB Real (%)',
    benchmark: `${fmt(best.value)}%`,
    saludable: `${best.label} ${fmt(best.value)}% → expansión`,
    peligro: `${worst.label} ${fmt(worst.value)}% → contracción`,
    insight: `La brecha de crecimiento entre ${best.label} (${fmt(best.value)}%) y ${worst.label} (${fmt(worst.value)}%) define mercados radicalmente distintos para el mismo producto. Expandirte a LatAm no es una estrategia: escoger el país correcto sí lo es.`,
    chartLabels: sorted.map(d => d.label),
    chartData: sorted.map(d => parseFloat(fmt(d.value))),
    chartType: 'bar',
    fuente: 'Banco Mundial 2025',
  };
}

async function postDolar(): Promise<PostData> {
  const { serie } = await fetchMindicador('dolar');
  const recent = serie.slice(0, 20).reverse();
  const labels = recent.map(d => d.fecha.slice(5, 10));
  const data = recent.map(d => d.valor);
  const last = data[data.length - 1];
  const min = Math.min(...data);
  const max = Math.max(...data);

  return {
    id: 6,
    tag_sistema: '/SYS/FX/VOLATILITY-2026',
    titulo: 'Volatilidad cambiaria: el riesgo que tu modelo no modela',
    subtitulo: 'Rango USD/CLP de 20 días: la volatilidad que destruye proyecciones.',
    metrica: 'USD/CLP — Rango 20 días',
    benchmark: `$${(max - min).toFixed(0)} rango`,
    saludable: 'Rango < $30 → estabilidad operativa',
    peligro: `Rango > $50 → ${((max - min) / min * 100).toFixed(1)}% volatilidad`,
    insight: `El tipo de cambio osciló entre $${min.toFixed(0)} y $${max.toFixed(0)} en los últimos 20 días. Startups que facturan en CLP y pagan en USD (cloud, SaaS tools) absorben este riesgo directamente. La cobertura cambiaria no es finanzas avanzadas: es supervivencia operacional.`,
    chartLabels: labels,
    chartData: data,
    chartType: 'line',
    fuente: 'Banco Central de Chile / mindicador.cl',
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function fetchAllPosts(): Promise<PostData[]> {
  console.log('🔄 Consultando fuentes de datos...');

  const results = await Promise.allSettled([
    postUSDCLP(),
    postUF(),
    postIPC(),
    postTPM(),
    postGDPLatam(),
    postDolar(),
  ]);

  const posts: PostData[] = [];
  const names = ['USD/CLP', 'UF', 'IPC', 'TPM', 'PIB LatAm', 'Volatilidad FX'];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`  ✅ ${names[i]}`);
      posts.push(r.value);
    } else {
      console.warn(`  ⚠️  ${names[i]}: ${r.reason?.message ?? 'error'}`);
    }
  });

  console.log(`\n📊 ${posts.length} posts con datos reales generados\n`);
  return posts;
}
