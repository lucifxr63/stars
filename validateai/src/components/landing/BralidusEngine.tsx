/* ════════════════════════════════════════════════════════════════
   BralidusEngine — sección que cuenta el motor de inteligencia detrás
   de Validus. Bralidus es un servicio GraphRAG (grafo de conocimiento +
   búsqueda vectorial) que ingesta datos institucionales chilenos reales
   y devuelve evidencia citable con procedencia. Es el diferenciador
   "comprobable, no opinión de chatbot".
═══════════════════════════════════════════════════════════════════ */

/* Fuentes reales que ingesta Bralidus */
const SOURCES = [
  { label: 'Banco Central (BCCh)', color: '#0EB5C6' },
  { label: 'CMF', color: '#34D399' },
  { label: 'SEIA', color: '#38D5E3' },
  { label: 'Mercado Público', color: '#A78BFA' },
  { label: 'Diario Oficial', color: '#F7C56C' },
  { label: 'INAPI', color: '#34D399' },
  { label: 'FRED · OpenBB', color: '#38D5E3' },
  { label: 'Prensa económica LatAm', color: '#0EB5C6' },
];

/* Corpus de doctrina VC — los 9 playbooks RAG que razona Bralidus */
const PLAYBOOKS = [
  { n: '01', label: 'Validación', desc: 'Mom Test' },
  { n: '02', label: 'Economics', desc: 'Unit economics' },
  { n: '03', label: 'Legal Chile', desc: 'Ley 21.521 · CMF' },
  { n: '04', label: 'Tech Stack', desc: 'No-code / low-code' },
  { n: '05', label: 'Growth', desc: 'GTM · PLG' },
  { n: '06', label: 'Funding', desc: 'Fases de inversión' },
  { n: '07', label: 'Producto & IA', desc: 'Blue Ocean' },
  { n: '08', label: 'Psicología', desc: 'Sesgos cognitivos' },
  { n: '09', label: 'CORFO / SII', desc: 'Financiamiento estatal' },
];

/* Pipeline real de /query/moe — lo que hace BralidusPy en cada consulta */
const PIPELINE = [
  { n: '01', title: 'Gating Network', desc: 'Enruta tu pregunta al experto correcto por keywords, semántica y tu industria/etapa.', color: '#0EB5C6' },
  { n: '02', title: 'Embedding 1536-d', desc: 'Vectoriza la consulta con caché para recuperar solo lo relevante.', color: '#38D5E3' },
  { n: '03', title: 'GraphRAG híbrido', desc: 'Recorre el grafo de conocimiento + similitud vectorial sobre el sub-grafo del experto.', color: '#A78BFA' },
  { n: '04', title: 'Evidencia citable', desc: 'Ensambla el contexto con procedencia: indicador, valor, fecha y fuente.', color: '#34D399' },
];

/* Los 5 expertos reales del MoE de BralidusPy → cómo se unen al dossier de Validus.
   Cada experto tiene un destino primario; todos convergen en Due Diligence. */
const EXPERTS = [
  { name: 'Unit Economics', color: '#34D399', feeds: 'Finanzas', desc: 'CAC/LTV, retención por cohortes y eficiencia de capital con benchmarks reales.' },
  { name: 'Macroeconómico', color: '#0EB5C6', feeds: 'Finanzas', desc: 'TPM, inflación, empleo y ciclo económico desde BCCh y FRED, para el análisis de riesgo.' },
  { name: 'Mercados Financieros', color: '#38D5E3', feeds: 'Estrategia', desc: 'IPSA, cobre, litio, USD/CLP y VIX para dimensionar mercado y timing.' },
  { name: 'Estrategia y GTM', color: '#A78BFA', feeds: 'Estrategia', desc: 'SWOT, radar de competidores y plan de go-to-market.' },
  { name: 'Legal y Regulatorio', color: '#F7C56C', feeds: 'Inversión', desc: 'CMF, Diario Oficial, marco societario y Ley 21.719.' },
];

/* Procedencia de ejemplo — evidencia citable real que produce Bralidus */
const EVIDENCE = [
  { metric: 'TPM 5,00%', source: 'Banco Central de Chile · jun 2026', effect: 'Ajusta ↑ el riesgo financiero del modelo', color: '#0EB5C6' },
  { metric: 'Sanción sectorial', source: 'CMF · API oficial', effect: 'Suma señal de riesgo regulatorio', color: '#F87171' },
  { metric: 'Licitación adjudicada', source: 'Mercado Público · > $5M CLP', effect: 'Confirma demanda B2G del segmento', color: '#34D399' },
];

/* Grafo de conocimiento — hub Bralidus → 5 expertos (MoE) → sus fuentes de datos.
   Refleja la arquitectura real: ramificación multi-nivel con decenas de nodos. */
const GRAPH_EXPERTS = [
  { label: 'Macro', color: '#0EB5C6', sources: ['FRED', 'BCCh', 'OpenBB'] },
  { label: 'Mercados', color: '#38D5E3', sources: ['yfinance', 'VIX'] },
  { label: 'Unit Econ', color: '#34D399', sources: ['Benchmarks'] },
  { label: 'Legal', color: '#F7C56C', sources: ['CMF', 'D. Oficial', 'SEIA'] },
  { label: 'Estrategia', color: '#A78BFA', sources: ['M. Público', 'Prensa', 'Empleo'] },
];

function KnowledgeGraph() {
  const cx = 200, cy = 192, R1 = 84, R2 = 152;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const polar = (r: number, deg: number): [number, number] => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

  const experts = GRAPH_EXPERTS.map((e, i) => {
    const base = -90 + (i * 360) / GRAPH_EXPERTS.length;
    const [x, y] = polar(R1, base);
    const n = e.sources.length;
    const sources = e.sources.map((label, j) => {
      const a = base + (j - (n - 1) / 2) * 24;
      const [sx, sy] = polar(R2, a);
      return { label, x: sx, y: sy };
    });
    return { ...e, x, y, sources };
  });

  return (
    <svg viewBox="0 0 400 384" className="w-full h-auto" role="img" aria-label="Grafo de conocimiento de Bralidus: núcleo conectado a 5 expertos y sus fuentes de datos">
      {/* Web entre expertos */}
      <polygon points={experts.map(e => `${e.x},${e.y}`).join(' ')} fill="none" stroke="currentColor" className="text-gray-200 dark:text-white/[0.08]" strokeWidth="1" />

      {/* Aristas experto → fuentes */}
      {experts.flatMap((e, i) => e.sources.map((s, j) => (
        <line key={`es${i}-${j}`} x1={e.x} y1={e.y} x2={s.x} y2={s.y} stroke={e.color} strokeOpacity="0.3" strokeWidth="1" />
      )))}

      {/* Aristas hub → expertos */}
      {experts.map((e, i) => (
        <line key={`he${i}`} x1={cx} y1={cy} x2={e.x} y2={e.y} stroke={e.color} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="3 4" />
      ))}

      {/* Pulsos en aristas hub → expertos */}
      {experts.map((e, i) => (
        <circle key={`pu${i}`} r="2.5" fill={e.color} className="animate-pulse" style={{ animationDelay: `${i * 0.35}s` }} cx={(cx + e.x) / 2} cy={(cy + e.y) / 2} />
      ))}

      {/* Nodos fuente */}
      {experts.flatMap((e, i) => e.sources.map((s, j) => (
        <g key={`sn${i}-${j}`}>
          <circle cx={s.x} cy={s.y} r="4.5" fill={`${e.color}33`} stroke={e.color} strokeWidth="1.25" />
          <text x={s.x} y={s.y - 8} textAnchor="middle" className="fill-gray-500 dark:fill-[#8B8AA0]" style={{ fontSize: '6.5px', fontWeight: 600 }}>{s.label}</text>
        </g>
      )))}

      {/* Nodos experto (pill) */}
      {experts.map((e, i) => {
        const w = e.label.length * 5.4 + 18;
        return (
          <g key={`ex${i}`}>
            <rect x={e.x - w / 2} y={e.y - 9} width={w} height="18" rx="9" fill={`${e.color}22`} stroke={e.color} strokeWidth="1.25" />
            <text x={e.x} y={e.y + 3} textAnchor="middle" className="fill-gray-700 dark:fill-[#F0EFF8]" style={{ fontSize: '8px', fontWeight: 700 }}>{e.label}</text>
          </g>
        );
      })}

      {/* Hub central */}
      <circle cx={cx} cy={cy} r="33" fill="none" stroke="#0EB5C6" strokeOpacity="0.2" strokeWidth="1.5" className="animate-pulse" />
      <circle cx={cx} cy={cy} r="27" fill="#0EB5C6" />
      <text x={cx} y={cy - 1} textAnchor="middle" fill="#fff" style={{ fontSize: '10px', fontWeight: 800 }}>Bralidus</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="#fff" fillOpacity="0.85" style={{ fontSize: '6px', fontWeight: 600 }}>GraphRAG</text>
    </svg>
  );
}

export function BralidusEngine() {
  return (
    <section id="bralidus" className="py-16 sm:py-24 bg-white dark:bg-[#12121A] border-t border-gray-100 dark:border-white/[0.06] relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[400px] bg-[#A78BFA]/[0.05] blur-[120px] rounded-full pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#A78BFA]/10 border border-[#A78BFA]/20 rounded-full text-[11px] font-semibold text-[#A78BFA] mb-4 uppercase tracking-wide">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
            Motor de inteligencia · Bralidus
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
            No es un chatbot opinando.<br className="hidden sm:block" /> Es <span className="gradient-text">Bralidus</span> razonando con datos reales
          </h2>
          <p className="text-gray-500 dark:text-[#8B8AA0] max-w-2xl mx-auto text-base leading-relaxed">
            Cada veredicto de Validus lo respalda <strong className="text-gray-700 dark:text-[#C4C4D4]">Bralidus</strong>, su motor GraphRAG con <strong className="text-gray-700 dark:text-[#C4C4D4]">5 expertos (Mixture of Experts)</strong>: un grafo de conocimiento que ingesta datos institucionales chilenos y devuelve evidencia citable, no texto inventado.
          </p>
        </div>

        {/* Pipeline real de /query/moe */}
        <div className="mb-12">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-[#afaebb] uppercase tracking-widest mb-5 text-center">Lo que hace Bralidus en cada consulta</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PIPELINE.map((step, i) => (
              <div key={step.n} className="relative bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.06] rounded-2xl p-5">
                {i < PIPELINE.length - 1 && (
                  <svg className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 w-5 h-5 text-gray-300 dark:text-white/15 z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                )}
                <span className="font-heading text-sm font-black" style={{ color: step.color }}>{step.n}</span>
                <h4 className="font-heading text-base font-bold text-gray-900 dark:text-[#F0EFF8] mt-1 mb-1.5">{step.title}</h4>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-[#afaebb] mt-4 text-center leading-relaxed max-w-2xl mx-auto">
            En paralelo, el <strong className="text-gray-600 dark:text-[#C4C4D4]">Radar Forense</strong> inyecta señales de riesgo en tiempo real —alza de TPM, quiebras del Boletín Concursal, sanciones CMF— antes de enrutar.
          </p>
        </div>

        {/* Grafo + procedencia */}
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center mb-12">
          {/* Grafo */}
          <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.06] rounded-3xl p-6 sm:p-8">
            <p className="text-[11px] font-bold text-[#0EB5C6] dark:text-[#38D5E3] uppercase tracking-wide mb-4 text-center">Grafo de conocimiento</p>
            <KnowledgeGraph />
            <p className="text-[11px] text-gray-400 dark:text-[#afaebb] text-center mt-4 leading-relaxed">
              Hub Bralidus → 5 expertos → sus fuentes en vivo. Cientos de nodos y aristas cruzando macro, mercados, legal y unit economics.
            </p>
          </div>

          {/* Procedencia */}
          <div>
            <p className="text-[11px] font-bold text-[#A78BFA] uppercase tracking-wide mb-4">Evidencia con procedencia</p>
            <div className="space-y-3">
              {EVIDENCE.map(e => (
                <div key={e.metric} className="flex items-start gap-3 bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.06] rounded-2xl p-4">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: e.color }} />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">{e.metric}</p>
                      <p className="text-[11px] text-gray-400 dark:text-[#8B8AA0]">{e.source}</p>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-[#C4C4D4] mt-0.5">{e.effect}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-[#afaebb] mt-4 leading-relaxed">
              Así se ve la trazabilidad: el score sube o baja con un dato fechado y su fuente. Defendible frente a cualquier inversor.
            </p>
          </div>
        </div>

        {/* Mixture of Experts → dossier de Validus */}
        <div className="mb-10">
          <div className="text-center mb-6">
            <h3 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-2">5 expertos, un veredicto</h3>
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] max-w-xl mx-auto">Cada experto de Bralidus alimenta una sección distinta de tu dossier. Así se unen el motor y el reporte.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXPERTS.map(e => (
              <div key={e.name} className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.06] rounded-2xl p-5 hover:border-gray-200 dark:hover:border-white/10 transition-colors duration-200">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  <h4 className="font-heading text-base font-bold text-gray-900 dark:text-[#F0EFF8] leading-tight">Experto {e.name}</h4>
                </div>
                <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-3">{e.desc}</p>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                  style={{ color: e.color, borderColor: `${e.color}33`, backgroundColor: `${e.color}0f` }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  Alimenta {e.feeds}
                </span>
              </div>
            ))}
            {/* Card de convergencia → Due Diligence */}
            <div className="bg-gradient-to-br from-[#A78BFA]/[0.12] to-[#0EB5C6]/[0.08] border border-[#A78BFA]/25 rounded-2xl p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#A78BFA]/20 text-[#A78BFA]">Premium</span>
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Due Diligence</p>
              </div>
              <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">
                Aquí <strong className="text-gray-900 dark:text-[#F0EFF8]">convergen los 5 expertos</strong>: el Due Diligence Score hace un doble pull del MoE completo + override macro, con procedencia citable en cada hallazgo.
              </p>
            </div>
          </div>
        </div>

        {/* Dos capas de conocimiento */}
        <div className="mb-12">
          <div className="text-center mb-6">
            <h3 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-2">Dos capas de conocimiento</h3>
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] max-w-xl mx-auto">Bralidus fusiona datos institucionales reales de Chile con un corpus curado de doctrina VC. Hechos + criterio.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Capa 1 — Datos en vivo */}
            <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-9 h-9 rounded-xl bg-[#0EB5C6]/10 text-[#0EB5C6] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" /></svg>
                </div>
                <div>
                  <p className="font-heading text-base font-bold text-gray-900 dark:text-[#F0EFF8] leading-tight">Datos en vivo</p>
                  <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0]">Fuentes institucionales que se actualizan solas</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {SOURCES.map(s => (
                  <span key={s.label} className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                    style={{ color: s.color, borderColor: `${s.color}33`, backgroundColor: `${s.color}0f` }}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Capa 2 — Doctrina VC */}
            <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[#A78BFA]/10 text-[#A78BFA] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                </div>
                <div>
                  <p className="font-heading text-base font-bold text-gray-900 dark:text-[#F0EFF8] leading-tight">Doctrina VC · 9 playbooks</p>
                  <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0]">El cómo construir y evaluar una startup</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PLAYBOOKS.map(p => (
                  <div key={p.n} className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06]">
                    <span className="font-heading text-[11px] font-black text-[#A78BFA] shrink-0">{p.n}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-gray-900 dark:text-[#F0EFF8] leading-tight truncate">{p.label}</p>
                      <p className="text-[9px] text-gray-400 dark:text-[#8B8AA0] truncate">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Roadmap — tarjeta perfil dev */}
        <div className="max-w-3xl mx-auto">
          <div className="rounded-3xl border border-white/[0.08] bg-[#0D0D15] overflow-hidden shadow-2xl">
            {/* Terminal chrome */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <span className="font-mono text-[11px] text-[#8B8AA0] truncate">~/bralidus/roadmap.md</span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-[#34D399]/12 text-[#34D399] border border-[#34D399]/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                Próximamente · API
              </span>
            </div>

            {/* Body — perfil dev */}
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
              {/* Avatar */}
              <div className="shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0EB5C6] to-[#A78BFA] flex items-center justify-center text-white font-black text-lg font-heading shadow-lg">
                  LA
                </div>
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
                  <p className="font-heading text-base font-bold text-[#F0EFF8]">Luciano Abarca</p>
                  <span className="font-mono text-xs text-[#0EB5C6]">@labarca</span>
                </div>
                <p className="font-mono text-[11px] text-[#8B8AA0] mb-3">Creador de Bralidus · Dev</p>

                <p className="text-sm text-[#C4C4D4] leading-relaxed mb-4">
                  <span className="font-mono text-[#34D399]">{'// '}</span>
                  Bralidus tendrá pronto su propia página, operando como una <strong className="text-[#F0EFF8]">API B2B</strong> lista para potenciar productos de terceros con nuestra arquitectura REST y GraphRAG.
                </p>

                <div className="flex flex-wrap gap-2">
                  {['API REST', 'GraphRAG', 'Open for devs'].map(t => (
                    <span key={t} className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[#8B8AA0]">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
