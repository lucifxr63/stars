import React, { useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip);

const CONTENT_PRESETS = [
  {
    tag_sistema: "/SYS/METRICS/2026",
    titulo: "La crisis de retención B2B en LatAm",
    subtitulo: "Por qué el crecimiento a cualquier costo ya no sirve y los VCs exigen eficiencia pura.",
    metrica: "LTV:CAC Ratio Promedio",
    benchmark: "4.5x",
    saludable: "> 3x",
    peligro: "< 2x",
    insight: "El 60% de las startups Serie A en LatAm están quemando caja. En 2026, si tu cliente no te deja al menos el triple de lo que costó traerlo, estás financiando tu propia quiebra.",
    copyLinkedIn: "El 60% de las startups Serie A en LatAm están financiando su propia quiebra sin saberlo.\n\nNo es hipérbole. Es lo que dice el dato duro cuando analizas el LTV:CAC de la región.\n\n¿Cuál es el mayor error que ves en founders de LatAm cuando hablan de crecimiento?\n\n#StartupsLatAm #VentureCapital #SaaS #UnitEconomics",
    chartType: 'line' as const,
    chartLabels: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026'],
    chartData: [1.5, 2.1, 2.8, 3.4, 4.5],
  },
  {
    tag_sistema: "/SYS/GROWTH/ACQUISITION",
    titulo: "El verdadero costo de adquirir un cliente",
    subtitulo: "Las startups están abandonando los canales tradicionales por la venta conversacional.",
    metrica: "CAC Promedio (USD)",
    benchmark: "$20",
    saludable: "WhatsApp API",
    peligro: "LinkedIn Ads",
    insight: "Meta y Google Ads se han vuelto prohibitivos para startups B2B tempranas. WhatsApp API no solo reduce el CAC a $20, sino que triplica la tasa de respuesta inicial.",
    copyLinkedIn: "La mayoría de startups B2B en etapa temprana están quemando runway en canales que no pueden pagar.\n\nUn CAC de $20 no es un accidente. Es el resultado de elegir el canal correcto.\n\n¿Están midiendo el CAC por canal de forma independiente?\n\n#B2BSaaS #GrowthMarketing #StartupsLatAm",
    chartType: 'bar' as const,
    chartLabels: ['LinkedIn Ads', 'Google Ads', 'Cold Email', 'WhatsApp API'],
    chartData: [150, 120, 75, 20],
  },
];

const DEFAULT_POST = CONTENT_PRESETS[1];

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  plugins: { legend: { display: false } },
  scales: {
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', font: { size: 10 } } },
    x: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } },
  },
};

export default function DataStoryEngine() {
  const imageRef = useRef<HTMLDivElement>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [postData, setPostData] = useState({ ...DEFAULT_POST });
  const [chartConfig, setChartConfig] = useState({
    type: DEFAULT_POST.chartType,
    labels: DEFAULT_POST.chartLabels,
    data: DEFAULT_POST.chartData,
  });

  const set = (key: string, value: string) =>
    setPostData(prev => ({ ...prev, [key]: value }));

  const handleDownload = useCallback(() => {
    if (!imageRef.current) return;
    toast.info('Generando imagen de alta resolución...');
    toPng(imageRef.current, { cacheBust: true, pixelRatio: 2 })
      .then(dataUrl => {
        const a = document.createElement('a');
        a.download = `datashield_post_${Date.now()}.png`;
        a.href = dataUrl;
        a.click();
        toast.success('Imagen descargada con éxito');
      })
      .catch(() => toast.error('Error al generar la imagen'));
  }, []);

  const handleAIGenerate = async () => {
    setIsGeneratingAI(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-validate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            validationId: 'admin-content',
            step: 0,
            promptType: 'market_signals',
            context: {
              idea_name: 'DataShield Content Engine',
              idea_description:
                'Genera un tema de Data Storytelling para LinkedIn orientado a founders B2B en LatAm. Responde SOLO con un JSON válido con este formato exacto: {"tag_sistema":"/SYS/TEMA/2026","titulo":"...","subtitulo":"...","metrica":"...","benchmark":"...","saludable":"...","peligro":"...","insight":"...","copyLinkedIn":"..."}',
              idea_industry: 'SaaS / Marketing',
              target_country: 'Chile',
              business_stage: 'growth',
            },
          }),
        }
      );

      if (!res.ok) throw new Error('Error del servidor de IA');
      const raw = await res.json();

      // Intentar parsear JSON estructurado del response
      const text: string =
        typeof raw === 'string' ? raw : raw.result ?? raw.content ?? JSON.stringify(raw);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setPostData(prev => ({ ...prev, ...parsed }));
        toast.success('Contenido sugerido por IA');
      } else {
        // Si no viene JSON, al menos actualizar el insight con el texto
        setPostData(prev => ({ ...prev, insight: text.slice(0, 200) }));
        toast.success('Insight actualizado por IA');
      }
    } catch (err) {
      console.error(err);
      // Fallback: rotar al otro preset para demo
      const other = CONTENT_PRESETS.find(p => p.titulo !== postData.titulo) ?? CONTENT_PRESETS[0];
      setPostData({ ...other });
      setChartConfig({ type: other.chartType, labels: other.chartLabels, data: other.chartData });
      toast.info('Sugerencia aplicada (modo demo)');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const chartData = {
    labels: chartConfig.labels,
    datasets: [{
      data: chartConfig.data,
      borderColor: '#00f0ff',
      backgroundColor: chartConfig.type === 'line' ? 'rgba(0,240,255,0.1)' : '#b829ff',
      borderWidth: 3,
      pointBackgroundColor: '#b829ff',
      pointBorderColor: '#fff',
      pointRadius: 5,
      fill: true,
      tension: 0.4,
      borderRadius: 4,
    }],
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* ── Panel de control ─────────────────────────────────────────────── */}
      <div className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-white/10">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">🛠️ Data Story Factory</h2>
          <Button onClick={handleAIGenerate} disabled={isGeneratingAI} variant="outline" size="sm">
            {isGeneratingAI ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Pensando...
              </span>
            ) : '✨ Sugerir con IA'}
          </Button>
        </div>

        {/* Presets rápidos */}
        <div className="flex gap-2">
          {CONTENT_PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => { setPostData({ ...p }); setChartConfig({ type: p.chartType, labels: p.chartLabels, data: p.chartData }); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition truncate max-w-[48%]"
            >
              {p.titulo.slice(0, 28)}…
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Título</label>
          <Input value={postData.titulo} onChange={e => set('titulo', e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Subtítulo (italic)</label>
          <Input value={postData.subtitulo} onChange={e => set('subtitulo', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Métrica</label>
            <Input value={postData.metrica} onChange={e => set('metrica', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Benchmark</label>
            <Input value={postData.benchmark} onChange={e => set('benchmark', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">✅ Zona OK</label>
            <Input value={postData.saludable} onChange={e => set('saludable', e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">🚨 Zona Peligro</label>
            <Input value={postData.peligro} onChange={e => set('peligro', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">💡 Key Takeaway (Insight)</label>
          <Textarea rows={3} value={postData.insight} onChange={e => set('insight', e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Copy LinkedIn</label>
          <Textarea rows={5} value={postData.copyLinkedIn} onChange={e => set('copyLinkedIn', e.target.value)} />
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={handleDownload} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
            📸 Descargar PNG
          </Button>
          <Button
            variant="outline"
            onClick={() => { navigator.clipboard.writeText(postData.copyLinkedIn); toast.success('Copy copiado al portapapeles'); }}
          >
            📋 Copiar texto
          </Button>
        </div>
      </div>

      {/* ── Previsualización ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Preview 1080×1080</p>
        {/* Wrapper que contiene el canvas escalado */}
        <div
          className="rounded-xl overflow-hidden bg-black flex items-start justify-start"
          style={{ width: '486px', height: '486px', flexShrink: 0 }}
        >
          <div
            ref={imageRef}
            className="relative text-white flex flex-col justify-between overflow-hidden shrink-0"
            style={{
              width: '1080px',
              height: '1080px',
              transform: 'scale(0.45)',
              transformOrigin: 'top left',
              background: '#0f0f13',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '24px',
            }}
          >
            {/* Glow */}
            <div className="absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full z-0"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(0,0,0,0) 70%)' }} />

            <div className="relative z-10 p-16 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-4 w-4 rounded-full bg-red-500" />
                <div className="h-4 w-4 rounded-full bg-yellow-500" />
                <div className="h-4 w-4 rounded-full bg-green-500" />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#00f0ff', fontSize: 18, letterSpacing: '0.15em' }}>
                  {postData.tag_sistema}
                </span>
              </div>

              {/* Título + Subtítulo */}
              <h1 style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1, color: '#fff', marginBottom: 20 }}>
                {postData.titulo}
              </h1>
              <p style={{ fontFamily: "'Georgia',serif", fontSize: 30, color: '#9ca3af', fontStyle: 'italic', lineHeight: 1.4, marginBottom: 32 }}>
                "{postData.subtitulo}"
              </p>

              {/* Gráfico */}
              <div style={{ background: 'rgba(9,9,11,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 32, marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#6b7280', fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {postData.metrica}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#b829ff', fontSize: 40, fontWeight: 900 }}>
                    {postData.benchmark}
                  </span>
                </div>
                <div style={{ height: 220, width: '100%' }}>
                  {chartConfig.type === 'bar'
                    ? <Bar data={chartData as any} options={CHART_OPTIONS as any} />
                    : <Line data={chartData as any} options={CHART_OPTIONS as any} />
                  }
                </div>
              </div>

              {/* Key Takeaway */}
              <div style={{ background: 'rgba(49,46,129,0.3)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16, padding: 32, display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 32 }}>
                <span style={{ fontSize: 48 }}>💡</span>
                <div>
                  <p style={{ fontFamily: "'JetBrains Mono',monospace", color: '#818cf8', fontSize: 16, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>
                    Key Takeaway
                  </p>
                  <p style={{ color: '#e5e7eb', fontSize: 26, lineHeight: 1.5, fontWeight: 500 }}>
                    {postData.insight}
                  </p>
                </div>
              </div>

              {/* Badges + Footer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
                <div style={{ background: 'rgba(6,78,59,0.4)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 12, padding: 24 }}>
                  <p style={{ fontFamily: "'JetBrains Mono',monospace", color: '#34d399', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Status: OK</p>
                  <p style={{ color: '#fff', fontSize: 26, fontWeight: 700 }}>{postData.saludable}</p>
                </div>
                <div style={{ background: 'rgba(127,29,29,0.4)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: 24 }}>
                  <p style={{ fontFamily: "'JetBrains Mono',monospace", color: '#f87171', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Status: Warning</p>
                  <p style={{ color: '#fff', fontSize: 26, fontWeight: 700 }}>{postData.peligro}</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#4b5563', fontSize: 18 }}>SOURCE: VALIDATE_AI_DATA</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#fff', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>ValidateAI_</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
