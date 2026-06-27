import { useState } from 'react';
import {
  EXAMPLE_IDEA, EXAMPLE_SCORE, EXAMPLE_SCORE_BREAKDOWN, EXAMPLE_AI_FEEDBACK,
  EXAMPLE_CUSTOMER, EXAMPLE_VALUE_PROP, EXAMPLE_MARKET_SIZING,
  EXAMPLE_COMPETITIVE, EXAMPLE_RISK, EXAMPLE_UNIT_ECONOMICS, EXAMPLE_MVP,
} from '@/data/exampleReport';

/* ════════════════════════════════════════════════════════════════
   ProductShowcase — réplica fiel del dossier real de Validus.
   Mismo layout de 7 pestañas que ValidationDetail (Veredicto, Validación,
   Estrategia, Finanzas, Hoja de Ruta, Inversión, Due Diligence) con datos
   reales de exampleReport.ts (FreshBox). Pieza central de conversión:
   muestra el producto real, no un mockup genérico.
═══════════════════════════════════════════════════════════════════ */

/* ─── Tabs (idéntico a ValidationDetail) ─── */
const TABS = [
  { id: 'Veredicto',     dot: '#0EB5C6', tier: null },
  { id: 'Validación',    dot: '#34D399', tier: null },
  { id: 'Estrategia',    dot: '#A78BFA', tier: 'Pro' },
  { id: 'Finanzas',      dot: '#F7C56C', tier: 'Pro' },
  { id: 'Hoja de Ruta',  dot: '#38D5E3', tier: 'Pro' },
  { id: 'Inversión',     dot: '#34D399', tier: 'Pro' },
  { id: 'Due Diligence', dot: '#A78BFA', tier: 'Premium' },
] as const;
type TabId = typeof TABS[number]['id'];

/* ─── Datos consistentes con FreshBox para tabs sin example data ─── */
const MOTIVOS = [
  'Dolor real: desconfianza en el origen y la calidad de los orgánicos del retail',
  'Diferenciador emocional difícil de copiar: trazabilidad QR del agricultor',
  'Mercado orgánico +40% post-pandemia con segmento ABC1-C2 dispuesto a pagar premium',
];
const BANDERAS = [
  'Logística de última milla intensiva en capital y difícil de escalar',
  'Churn alto típico de suscripciones D2C de alimentos',
  'Dependencia de pocos agricultores certificados (riesgo de oferta)',
];
const INSIGHTS = [
  { label: 'Go-to-Market & Ventas', color: '#34D399', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z', text: 'Crecimiento por referidos + Instagram hiperlocal en 3 comunas. Densifica rutas antes de expandir: cada comuna nueva baja el costo de entrega.' },
  { label: 'Veredicto de Inversión', color: '#F7C56C', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659', text: 'Invertible en pre-seed condicionado a preventa pagada y red de ≥3 agricultores. Instrumento: SAFE con fondos no dilutivos de CORFO en paralelo.' },
  { label: 'Producto & IA (Blue Ocean)', color: '#38D5E3', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z', text: 'La IA personaliza la caja por preferencias y predice el desperdicio del hogar para reducir churn. No reemplaza la curaduría: la escala.' },
  { label: 'Diagnóstico de Sesgos', color: '#F87171', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z', text: 'Cuidado con el sesgo de "producto bonito": el equipo tiende a sobre-invertir en la app y sub-invertir en la operación logística, que es donde se gana.' },
];
const FOUNDER_FIT = {
  score: 76,
  dims: [
    { label: 'Conocimiento Problema', val: 82 },
    { label: 'Exp. Industria', val: 70 },
    { label: 'Capacidad Técnica', val: 74 },
    { label: 'Red de Contactos', val: 66 },
    { label: 'Track Record', val: 64 },
  ],
  gaps: ['Experiencia en logística de última milla a escala', 'Antecedentes en retención de suscripciones D2C'],
  ruta: ['Sumar un socio/asesor con trayectoria en operaciones de delivery', 'Contratar growth con foco en retención antes de escalar'],
};
const JTBD = 'El "job" de la familia ABC1-C2 es comer sano sin perder el sábado en el mercado ni botar comida. FreshBox se contrata para "que mi casa coma fresco y local sin que yo tenga que pensarlo".';
const MOM_TEST = [
  'Habla con 10 familias ABC1-C2 sin mencionar tu solución — pregunta cómo compran hoy',
  'Mide cuántas botan comida por semana y cuánto pagarían por evitarlo',
  'Lanza una preventa de 50 cajas antes de comprar inventario',
  'Valida el diferenciador de trazabilidad con un MVP de un solo agricultor',
  'Convierte la preventa en una lista de espera con depósito reembolsable',
];
const SWOT = {
  fortalezas: ['Diferenciador de trazabilidad emocional', 'Mercado orgánico +40% post-pandemia', 'Margen premium defendible'],
  mejoras: ['Logística de última milla intensiva en capital', 'Churn alto en suscripciones D2C', 'Dependencia de pocos agricultores'],
  oportunidades: ['Alianzas con agricultores certificados SAG', 'Cajas temáticas (keto, vegano)', 'Sello de trazabilidad como marca premium'],
  amenazas: ['Supermercados con sección orgánica + delivery', 'Inflación alimentaria reduce gasto premium', 'Estacionalidad de la oferta agrícola'],
};
const MARKET_SIGNALS = {
  trend: 'El delivery de alimentos frescos y la demanda de orgánicos crecen de forma sostenida en Chile post-pandemia.',
  timing: 'Ventana favorable: el hábito de delivery quedó consolidado y la conciencia de alimentación saludable está en alza.',
  rondas: [
    { name: 'NotCo', amount: 'US$ 235M', year: 2021 },
    { name: 'Agrofy', amount: 'US$ 30M', year: 2021 },
  ],
  noticias: ['Mercado orgánico chileno crece a doble dígito anual', 'El delivery de supermercado se normaliza post-pandemia', 'Ley 20.606 impulsa el consumo saludable'],
};
const ROADMAP = [
  { name: 'Configurador + Preventa', weeks: 2, goal: 'Validar demanda con 50 suscriptores', stack: 'No-code' },
  { name: 'Suscripción y Pagos', weeks: 2, goal: 'Cobro recurrente con Transbank', stack: 'Low-code' },
  { name: 'Operación y Tracking', weeks: 2, goal: 'Ruta de entrega + notificaciones', stack: 'Low-code' },
];
const CAP_TABLE = [
  { name: 'Fundador/a CEO', role: 'CEO (producto/ops)', pct: 52, color: '#0EB5C6' },
  { name: 'Fundador/a COO', role: 'COO (logística)', pct: 38, color: '#A78BFA' },
  { name: 'Pool equipo (ESOP)', role: 'Reservado', pct: 10, color: '#F7C56C' },
];
const LEGAL_CHECKLIST = [
  { sev: 'Crítico', title: 'Constitución de SpA', desc: 'Vía Empresa en un Día; estatutos con clases de acciones', tag: 'Ley 20.659' },
  { sev: 'Crítico', title: 'Pacto de accionistas con vesting', desc: 'Cliff, leaver clauses y reglas de decisión', tag: 'Buenas prácticas VC' },
  { sev: 'Importante', title: 'Registro de marca INAPI', desc: 'Marca "FreshBox" en clases 29, 31 y 35', tag: 'INAPI' },
  { sev: 'Importante', title: 'Protocolo Ley Karin', desc: 'Prevención de acoso laboral aunque el equipo sea pequeño', tag: 'Ley 21.643' },
];
const FUNDRAISING = {
  instrument: 'SAFE Note',
  ticket: '$150K – $400K USD',
  valuation: '$1.5M – $3.0M pre-money',
  readiness: 64,
  narrative: 'Chile quiere comer sano y local, pero el retail no garantiza origen y el mercado campesino no escala. FreshBox es la caja orgánica trazable que conecta a las familias con su agricultor — suscripción recurrente, margen premium y lealtad emocional.',
  funds: ['Platanus Ventures', 'Fen Ventures', 'Dadneo / The Yield Lab LatAm'],
  blockers: ['Aún sin preventa pagada que valide demanda', 'Red de agricultores certificados por formalizar'],
  milestones: ['Cerrar preventa de 50 cajas', 'Firmar 3 agricultores certificados SAG', 'Alcanzar 200 suscriptores con churn <8%'],
};
const DD = {
  score: 71,
  dims: [
    { label: 'Tesis de inversión', val: 74 },
    { label: 'Mercado', val: 80 },
    { label: 'Producto', val: 70 },
    { label: 'Equipo', val: 68 },
    { label: 'Riesgo', val: 63 },
  ],
  verdict: 'Invertible en pre-seed condicionado a una preventa pagada y a una red de ≥3 agricultores. El cuello de botella es la unidad económica de la última milla, no la demanda.',
  strengths: ['Diferenciador defendible y emocional', 'Timing de mercado favorable'],
  watchouts: ['Sin tracción pagada todavía', 'Logística por probar a escala'],
};

/* ─── Helpers ─── */
const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M` : `$${(n / 1_000).toFixed(0)}K`;
const riskColor = (s: number) => s < 40 ? '#34D399' : s < 65 ? '#FBBF24' : '#F87171';
const riskLabel = (s: number) => s < 40 ? 'Bajo' : s < 65 ? 'Medio' : 'Alto';

function ScoreCircle({ score, size = 96 }: { score: number; size?: number }) {
  const color = score >= 70 ? '#34D399' : score >= 50 ? '#FBBF24' : '#F87171';
  const r = 33, circ = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90 w-full h-full" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} stroke="currentColor" className="text-gray-200 dark:text-white/10" strokeWidth="7" fill="none" />
        <circle cx="44" cy="44" r={r} stroke={color} strokeWidth="7" fill="none"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .7s ease' }} />
      </svg>
      <div className="text-center z-10">
        <p className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8] font-heading leading-none">{score}</p>
        <p className="text-[10px] text-gray-400 dark:text-[#8B8AA0] font-medium mt-0.5">/100</p>
      </div>
    </div>
  );
}

/* Radar pentagonal genérico (5 ejes, valores 0–100) */
function Radar({ values, color }: { values: number[]; color: string }) {
  const cx = 60, cy = 60, R = 46;
  const pts = (vals: number[]) => vals.map((v, i) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    const r = (v / 100) * R;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  const grid = [0.33, 0.66, 1].map(f => pts(values.map(() => f * 100)));
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32 sm:w-36 sm:h-36 shrink-0">
      {grid.map((g, i) => (
        <polygon key={i} points={g} fill="none" stroke="currentColor" className="text-gray-200 dark:text-white/10" strokeWidth="1" />
      ))}
      <polygon points={pts(values)} fill={`${color}33`} stroke={color} strokeWidth="1.5" />
      {values.map((v, i) => {
        const a = (-90 + i * 72) * Math.PI / 180;
        const r = (v / 100) * R;
        return <circle key={i} cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r="2.5" fill={color} />;
      })}
    </svg>
  );
}

function Bar({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] text-gray-500 dark:text-[#8B8AA0] w-32 sm:w-36 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${val}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-bold text-gray-700 dark:text-[#F0EFF8] tabular-nums w-6 text-right">{val}</span>
    </div>
  );
}

function SectionLabel({ children, color = '#0EB5C6' }: { children: React.ReactNode; color?: string }) {
  return <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color }}>{children}</p>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4 sm:p-5 ${className}`}>{children}</div>;
}

/* ════════════ TAB PANELS ════════════ */

function VeredictoPanel() {
  const dims = Object.entries(EXAMPLE_SCORE_BREAKDOWN) as [string, number][];
  const labels: Record<string, string> = { problem: 'Problema', market: 'Mercado', competition: 'Competencia', solution: 'Solución', execution: 'Ejecución' };
  const colors = ['#0EB5C6', '#34D399', '#F7C56C', '#38D5E3', '#F87171'];
  return (
    <div className="space-y-5">
      {/* Resumen ejecutivo */}
      <div className="flex flex-col sm:flex-row gap-4 items-start bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4 sm:p-5">
        <div className="w-14 h-14 rounded-2xl bg-[#0EB5C6] flex flex-col items-center justify-center text-white shrink-0 font-heading">
          <span className="text-lg font-black leading-none">{EXAMPLE_SCORE}</span>
          <span className="text-[8px] opacity-80">/100</span>
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-[#34D399] uppercase tracking-wide mb-1.5">Idea con buen potencial</p>
          <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{EXAMPLE_AI_FEEDBACK}</p>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-[#0EB5C6] dark:text-[#C4BCFC] bg-[#0EB5C6]/[0.06] border border-[#0EB5C6]/15 rounded-xl px-3.5 py-2.5">
        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        <span><strong>Veredicto VC</strong> — generado con los Playbooks de Validación, Economics, Legal Chile y Tech Stack. Sin filtros de cortesía.</span>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <SectionLabel color="#F7C56C">Desglose del score</SectionLabel>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Radar values={dims.map(([, v]) => v)} color="#0EB5C6" />
            <div className="flex-1 w-full space-y-2">
              {dims.map(([k, v], i) => <Bar key={k} label={labels[k] ?? k} val={v} color={colors[i]} />)}
            </div>
          </div>
        </Card>
        <div className="space-y-3">
          <div className="bg-[#F87171]/[0.07] border border-[#F87171]/20 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5 text-[#F87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              <p className="text-[11px] font-bold text-[#F87171] uppercase tracking-wide">Verdad incómoda</p>
            </div>
            <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">
              Tu cuello de botella no es la demanda: es la unidad económica de la última milla y el churn. Si no cierras una preventa pagada de 50 cajas en 60 días, el mejor producto se queda en el laboratorio.
            </p>
          </div>
          <div className="bg-[#34D399]/[0.07] border border-[#34D399]/20 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-[#34D399] uppercase tracking-wide mb-2">Unit Economics</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: 'LTV/CAC', v: `${EXAMPLE_UNIT_ECONOMICS.ltvCacRatio.value}x` },
                { l: 'Payback', v: `${EXAMPLE_UNIT_ECONOMICS.paybackMonths.min}–${EXAMPLE_UNIT_ECONOMICS.paybackMonths.max}m` },
              ].map(m => (
                <div key={m.l} className="bg-white dark:bg-[#12121A] rounded-lg p-2 text-center border border-gray-100 dark:border-white/[0.05]">
                  <p className="text-sm font-black font-heading text-[#34D399]">{m.v}</p>
                  <p className="text-[10px] text-gray-500 dark:text-[#8B8AA0]">{m.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Motivos para invertir / Banderas rojas */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-[#34D399]/[0.06] border border-[#34D399]/15 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <svg className="w-4 h-4 text-[#34D399]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-[11px] font-bold text-[#34D399] uppercase tracking-wide">Motivos para invertir</p>
          </div>
          <ul className="space-y-2">
            {MOTIVOS.map(m => <li key={m} className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed flex gap-2"><span className="text-[#34D399] mt-0.5">•</span>{m}</li>)}
          </ul>
        </div>
        <div className="bg-[#F87171]/[0.06] border border-[#F87171]/15 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <svg className="w-4 h-4 text-[#F87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-[11px] font-bold text-[#F87171] uppercase tracking-wide">Banderas rojas</p>
          </div>
          <ul className="space-y-2">
            {BANDERAS.map(m => <li key={m} className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed flex gap-2"><span className="text-[#F87171] mt-0.5">•</span>{m}</li>)}
          </ul>
        </div>
      </div>

      {/* Insight cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        {INSIGHTS.map(ins => (
          <div key={ins.label} className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className="w-3.5 h-3.5" style={{ color: ins.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={ins.icon} /></svg>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: ins.color }}>{ins.label}</p>
            </div>
            <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{ins.text}</p>
          </div>
        ))}
      </div>

      {/* Founder-Market Fit */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel color="#38D5E3">Founder-Market Fit</SectionLabel>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#34D399]/15 text-[#34D399]">{FOUNDER_FIT.score} · Fit alto</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Radar values={FOUNDER_FIT.dims.map(d => d.val)} color="#38D5E3" />
          <div className="flex-1 w-full space-y-2">
            {FOUNDER_FIT.dims.map(d => <Bar key={d.label} label={d.label} val={d.val} color="#38D5E3" />)}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
            <p className="text-[10px] font-bold text-[#F7C56C] uppercase mb-1.5">Gaps identificados</p>
            {FOUNDER_FIT.gaps.map(g => <p key={g} className="text-xs text-gray-600 dark:text-[#8B8AA0] leading-relaxed">• {g}</p>)}
          </div>
          <div className="bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
            <p className="text-[10px] font-bold text-[#A78BFA] uppercase mb-1.5">Ruta sugerida</p>
            {FOUNDER_FIT.ruta.map((g, i) => <p key={g} className="text-xs text-gray-600 dark:text-[#8B8AA0] leading-relaxed">{i + 1}. {g}</p>)}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ValidacionPanel() {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-[#0EB5C6]/[0.07] border border-[#0EB5C6]/15 rounded-2xl p-4">
          <SectionLabel>Segmento objetivo</SectionLabel>
          <p className="text-sm text-gray-900 dark:text-[#F0EFF8] leading-relaxed">{EXAMPLE_CUSTOMER.customer_segment}</p>
        </div>
        <div className="bg-[#F7C56C]/[0.07] border border-[#F7C56C]/15 rounded-2xl p-4">
          <SectionLabel color="#F7C56C">Propuesta de valor</SectionLabel>
          <p className="text-sm text-gray-900 dark:text-[#F0EFF8] leading-relaxed line-clamp-4">{EXAMPLE_VALUE_PROP.value_proposition}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <SectionLabel color="#F87171">Pain points a validar</SectionLabel>
          <ul className="space-y-2">
            {EXAMPLE_CUSTOMER.customer_pain_points.map(p => (
              <li key={p} className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed flex gap-2"><span className="text-[#F87171] mt-0.5">•</span>{p}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionLabel color="#0EB5C6">Diferenciador clave</SectionLabel>
          <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed mb-3">{EXAMPLE_VALUE_PROP.differentiator}</p>
          <p className="text-[10px] font-bold text-[#A78BFA] uppercase mb-1.5">Jobs-to-be-done</p>
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{JTBD}</p>
        </Card>
      </div>

      <Card>
        <SectionLabel color="#34D399">Mom Test — pasos de validación</SectionLabel>
        <div className="space-y-2.5">
          {MOM_TEST.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#34D399] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SwotQuadrant({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className="rounded-2xl p-3.5 border" style={{ backgroundColor: `${color}12`, borderColor: `${color}26` }}>
      <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color }}>{label}</p>
      {items.map(s => <p key={s} className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">• {s}</p>)}
    </div>
  );
}

function EstrategiaPanel() {
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        {/* TAM/SAM/SOM */}
        <div className="space-y-2.5">
          <SectionLabel>Tamaño de mercado · {EXAMPLE_IDEA.target_country}</SectionLabel>
          {(['tam', 'sam', 'som'] as const).map(tier => {
            const t = EXAMPLE_MARKET_SIZING[tier];
            const meta = { tam: { c: '#34D399', w: '100%' }, sam: { c: '#38D5E3', w: '55%' }, som: { c: '#F7C56C', w: '22%' } }[tier];
            return (
              <div key={tier} className="border rounded-2xl p-3.5" style={{ backgroundColor: `${meta.c}12`, borderColor: `${meta.c}26` }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black uppercase tracking-wide" style={{ color: meta.c }}>{tier}</span>
                  <span className="text-[10px] text-gray-500 dark:text-[#8B8AA0]">Confianza: {t.confidence}</span>
                </div>
                <p className="font-bold text-gray-900 dark:text-[#F0EFF8] font-heading text-sm">{fmt(t.value_low)} – {fmt(t.value_high)} CLP</p>
                <div className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: meta.w, backgroundColor: meta.c }} />
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0] leading-relaxed bg-gray-50 dark:bg-white/[0.02] rounded-xl p-3">
            <strong className="text-gray-700 dark:text-[#C4C4D4]">Metodología:</strong> {EXAMPLE_MARKET_SIZING.methodology}
          </p>
        </div>

        {/* SWOT 2x2 */}
        <div>
          <SectionLabel color="#A78BFA">Análisis SWOT</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <SwotQuadrant label="Fortalezas" items={SWOT.fortalezas} color="#34D399" />
            <SwotQuadrant label="Áreas de mejora" items={SWOT.mejoras} color="#F7C56C" />
            <SwotQuadrant label="Oportunidades" items={SWOT.oportunidades} color="#0EB5C6" />
            <SwotQuadrant label="Amenazas" items={SWOT.amenazas} color="#F87171" />
          </div>
        </div>
      </div>

      {/* Competidores */}
      <Card>
        <SectionLabel color="#A78BFA">Radar de competidores</SectionLabel>
        <div className="space-y-2.5">
          {EXAMPLE_COMPETITIVE.competitors.map(c => (
            <div key={c.name} className="border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 bg-white dark:bg-[#12121A]">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-gray-900 dark:text-[#F0EFF8] text-sm">{c.name}</p>
                <span className="text-[10px] text-gray-500 dark:text-[#8B8AA0]">{c.pricing}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{c.description}</p>
            </div>
          ))}
          <div className="bg-[#0EB5C6]/[0.07] border border-[#0EB5C6]/20 rounded-xl p-3">
            <p className="text-[11px] font-bold text-[#0EB5C6] dark:text-[#38D5E3] uppercase mb-1">Tu ventaja competitiva</p>
            <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{EXAMPLE_COMPETITIVE.competitive_advantage_suggestion}</p>
          </div>
        </div>
      </Card>

      {/* Señales de mercado */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <SectionLabel color="#34D399">Señales de mercado</SectionLabel>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#34D399]/15 text-[#34D399] -mt-3">Creciendo · Timing óptimo</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed mb-3">{MARKET_SIGNALS.trend} {MARKET_SIGNALS.timing}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-500 dark:text-[#8B8AA0] uppercase mb-2">Rondas recientes</p>
            {MARKET_SIGNALS.rondas.map(r => (
              <div key={r.name} className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
                <span className="text-xs text-gray-700 dark:text-[#C4C4D4]">{r.name} <span className="text-gray-400">· {r.year}</span></span>
                <span className="text-xs font-bold text-[#34D399]">{r.amount}</span>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-500 dark:text-[#8B8AA0] uppercase mb-2">Noticias clave</p>
            {MARKET_SIGNALS.noticias.map(n => <p key={n} className="text-xs text-gray-600 dark:text-[#8B8AA0] leading-relaxed mb-1">• {n}</p>)}
          </div>
        </div>
      </Card>
    </div>
  );
}

function FinanzasPanel() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { l: 'CAC', v: `${fmt(EXAMPLE_UNIT_ECONOMICS.cac.min)}–${fmt(EXAMPLE_UNIT_ECONOMICS.cac.max)}`, c: '#0EB5C6' },
          { l: 'LTV', v: `${fmt(EXAMPLE_UNIT_ECONOMICS.ltv.min)}–${fmt(EXAMPLE_UNIT_ECONOMICS.ltv.max)}`, c: '#34D399' },
          { l: 'LTV/CAC', v: `${EXAMPLE_UNIT_ECONOMICS.ltvCacRatio.value}x`, c: '#34D399' },
          { l: 'Break-even', v: `${EXAMPLE_UNIT_ECONOMICS.breakEvenUsers}u`, c: '#F7C56C' },
        ].map(m => (
          <div key={m.l} className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-2xl p-3 text-center">
            <p className="text-[10px] text-gray-500 dark:text-[#8B8AA0] mb-1 uppercase tracking-wide">{m.l}</p>
            <p className="font-black text-gray-900 dark:text-[#F0EFF8] text-sm font-heading" style={{ color: m.c }}>{m.v}</p>
          </div>
        ))}
      </div>

      {/* Gráfico CAC vs LTV */}
      <Card>
        <SectionLabel color="#34D399">CAC vs LTV promedio</SectionLabel>
        {[
          { l: 'CAC', val: (EXAMPLE_UNIT_ECONOMICS.cac.min + EXAMPLE_UNIT_ECONOMICS.cac.max) / 2, c: '#38D5E3' },
          { l: 'LTV', val: (EXAMPLE_UNIT_ECONOMICS.ltv.min + EXAMPLE_UNIT_ECONOMICS.ltv.max) / 2, c: '#A78BFA' },
        ].map(row => {
          const max = (EXAMPLE_UNIT_ECONOMICS.ltv.min + EXAMPLE_UNIT_ECONOMICS.ltv.max) / 2;
          return (
            <div key={row.l} className="flex items-center gap-3 mb-2">
              <span className="text-[11px] font-bold text-gray-500 dark:text-[#8B8AA0] w-10 shrink-0">{row.l}</span>
              <div className="flex-1 h-6 bg-gray-100 dark:bg-white/[0.04] rounded-lg overflow-hidden">
                <div className="h-full rounded-lg flex items-center justify-end px-2" style={{ width: `${(row.val / max) * 100}%`, backgroundColor: row.c }}>
                  <span className="text-[10px] font-bold text-white">{fmt(row.val)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0] mt-2">Recuperación (payback): {EXAMPLE_UNIT_ECONOMICS.paybackMonths.min}–{EXAMPLE_UNIT_ECONOMICS.paybackMonths.max} meses · Churn estimado: {EXAMPLE_UNIT_ECONOMICS.monthlyChurnEstimate}%/mes</p>
      </Card>

      {/* Matriz de riesgos */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel color="#F87171">Análisis de riesgos · 4 dimensiones</SectionLabel>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${riskColor(EXAMPLE_RISK.overallRiskScore)}26`, color: riskColor(EXAMPLE_RISK.overallRiskScore) }}>
            {EXAMPLE_RISK.overallRiskScore} · Riesgo {riskLabel(EXAMPLE_RISK.overallRiskScore)}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {Object.values(EXAMPLE_RISK.dimensions).map(d => (
            <div key={d.label} className="bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-900 dark:text-[#F0EFF8]">{d.label}</p>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${riskColor(d.score)}26`, color: riskColor(d.score) }}>{d.score} · {riskLabel(d.score)}</span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{d.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-[#34D399]/[0.07] border border-[#34D399]/15 rounded-xl p-3">
          <p className="text-[11px] font-bold text-[#34D399] uppercase mb-1.5">Mitigaciones recomendadas</p>
          {EXAMPLE_RISK.mitigations.slice(0, 3).map((m, i) => (
            <p key={i} className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{i + 1}. {m}</p>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RoadmapPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 bg-[#F7C56C]/[0.07] border border-[#F7C56C]/15 rounded-xl px-3.5 py-2.5">
        <svg className="w-3.5 h-3.5 text-[#F7C56C] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>
        <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">MVP <strong className="text-gray-900 dark:text-[#F0EFF8]">{EXAMPLE_MVP.mvp_type === 'web_app' ? 'web app' : EXAMPLE_MVP.mvp_type}</strong> · 6 semanas estimadas · enfoque no-code/low-code para validar antes de invertir en producto.</p>
      </div>
      {ROADMAP.map((s, i) => (
        <div key={i} className="border border-gray-200 dark:border-white/[0.06] rounded-2xl p-4 bg-gray-50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-bold text-gray-900 dark:text-[#F0EFF8] text-sm">Sprint {i + 1} — {s.name}</p>
            <div className="flex gap-2 shrink-0">
              <span className="text-[10px] text-gray-400 dark:text-[#8B8AA0]">{s.weeks} sem.</span>
              <span className="text-[10px] bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-[#C4C4D4] px-2 py-0.5 rounded-full">{s.stack}</span>
            </div>
          </div>
          <p className="text-xs text-[#0EB5C6] dark:text-[#38D5E3] italic">{s.goal}</p>
        </div>
      ))}
      <div className="bg-[#0EB5C6]/[0.06] border border-[#0EB5C6]/15 rounded-2xl p-4">
        <p className="text-[11px] font-bold text-[#0EB5C6] dark:text-[#38D5E3] uppercase mb-2">Flujo del usuario</p>
        <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{EXAMPLE_MVP.mvp_user_flow}</p>
      </div>
    </div>
  );
}

function InversionPanel() {
  const sevColor = (s: string) => s === 'Crítico' ? '#F87171' : '#F7C56C';
  return (
    <div className="space-y-4">
      {/* Narrative del pitch */}
      <div className="bg-[#A78BFA]/[0.07] border border-[#A78BFA]/20 rounded-2xl p-4">
        <p className="text-[11px] font-bold text-[#A78BFA] uppercase mb-1.5">Narrative del pitch</p>
        <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed italic">"{FUNDRAISING.narrative}"</p>
      </div>

      {/* Cap table */}
      <Card>
        <SectionLabel color="#A78BFA">Cap table inicial</SectionLabel>
        <div className="flex h-3 rounded-full overflow-hidden mb-4">
          {CAP_TABLE.map(r => <div key={r.name} style={{ width: `${r.pct}%`, backgroundColor: r.color }} />)}
        </div>
        <div className="space-y-2">
          {CAP_TABLE.map(r => (
            <div key={r.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-[#F0EFF8] leading-none">{r.name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-[#8B8AA0] mt-0.5">{r.role}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8] tabular-nums">{r.pct}%</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[#F87171] bg-[#F87171]/[0.07] border border-[#F87171]/15 rounded-xl px-3 py-2">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span>Evita el split 50-50: vesting 4 años con 1 de cliff antes de levantar capital.</span>
        </div>
      </Card>

      {/* Checklist legal */}
      <Card>
        <SectionLabel color="#F87171">Checklist legal Chile</SectionLabel>
        <div className="space-y-2">
          {LEGAL_CHECKLIST.map(item => (
            <div key={item.title} className="flex items-start gap-2.5 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ backgroundColor: `${sevColor(item.sev)}26`, color: sevColor(item.sev) }}>{item.sev}</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-[#F0EFF8]">{item.title}</p>
                <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{item.desc}</p>
              </div>
              <span className="text-[9px] font-medium text-gray-400 dark:text-[#8B8AA0] bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded shrink-0">{item.tag}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Fundraising */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel color="#34D399">Estrategia de fundraising</SectionLabel>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F7C56C]/15 text-[#F7C56C]">{FUNDRAISING.readiness}/100 · En preparación</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5 mb-3">
          <div className="bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
            <p className="text-[10px] text-gray-500 dark:text-[#8B8AA0] uppercase mb-1">Instrumento · Ticket</p>
            <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">{FUNDRAISING.instrument}</p>
            <p className="text-xs text-[#34D399] font-semibold mt-0.5">{FUNDRAISING.ticket}</p>
          </div>
          <div className="bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
            <p className="text-[10px] text-gray-500 dark:text-[#8B8AA0] uppercase mb-1">Valorización</p>
            <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">{FUNDRAISING.valuation}</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-[#8B8AA0] uppercase mb-1.5">Fondos recomendados</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {FUNDRAISING.funds.map(f => (
            <span key={f} className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-[#C4C4D4]">{f}</span>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <div className="bg-[#F87171]/[0.06] border border-[#F87171]/15 rounded-xl p-3">
            <p className="text-[10px] font-bold text-[#F87171] uppercase mb-1.5">Bloqueadores actuales</p>
            {FUNDRAISING.blockers.map(b => <p key={b} className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">✕ {b}</p>)}
          </div>
          <div className="bg-[#34D399]/[0.06] border border-[#34D399]/15 rounded-xl p-3">
            <p className="text-[10px] font-bold text-[#34D399] uppercase mb-1.5">Hitos antes de la ronda</p>
            {FUNDRAISING.milestones.map((m, i) => <p key={m} className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{i + 1}. {m}</p>)}
          </div>
        </div>
      </Card>
    </div>
  );
}

function DueDiligencePanel() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#A78BFA]/[0.08] to-[#0EB5C6]/[0.05] border border-[#A78BFA]/20 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <ScoreCircle score={DD.score} size={104} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#A78BFA]/15 text-[#A78BFA]">Due Diligence · AI-RAG</span>
              <span className="text-[10px] text-gray-500 dark:text-[#8B8AA0]">Filtro estilo Paul Graham + fondos VC</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{DD.verdict}</p>
          </div>
        </div>
      </div>
      <Card>
        <SectionLabel color="#A78BFA">Desglose due diligence</SectionLabel>
        <div className="space-y-2">
          {DD.dims.map(d => <Bar key={d.label} label={d.label} val={d.val} color="#A78BFA" />)}
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-[#34D399]/[0.06] border border-[#34D399]/15 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-[#34D399] uppercase mb-2">A favor de la tesis</p>
          {DD.strengths.map(s => <p key={s} className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">✓ {s}</p>)}
        </div>
        <div className="bg-[#F7C56C]/[0.06] border border-[#F7C56C]/15 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-[#F7C56C] uppercase mb-2">A vigilar</p>
          {DD.watchouts.map(s => <p key={s} className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">! {s}</p>)}
        </div>
      </div>
    </div>
  );
}

const PANELS: Record<TabId, React.ComponentType> = {
  'Veredicto': VeredictoPanel,
  'Validación': ValidacionPanel,
  'Estrategia': EstrategiaPanel,
  'Finanzas': FinanzasPanel,
  'Hoja de Ruta': RoadmapPanel,
  'Inversión': InversionPanel,
  'Due Diligence': DueDiligencePanel,
};

/* ════════════ MAIN ════════════ */
export function ProductShowcase() {
  const [active, setActive] = useState<TabId>('Veredicto');
  const Panel = PANELS[active];

  return (
    <section id="demo" className="py-16 sm:py-24 bg-gray-50 dark:bg-[#0A0A0F] border-t border-gray-100 dark:border-white/[0.06] relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#0EB5C6]/[0.06] blur-[120px] rounded-full pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0EB5C6]/10 border border-[#0EB5C6]/20 rounded-full text-[11px] font-semibold text-[#0EB5C6] dark:text-[#38D5E3] mb-4 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0EB5C6] animate-pulse" />
            El dossier real — explóralo en vivo
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">
            No es un score. Es el <span className="gradient-text">dossier que armaría un VC</span>
          </h2>
          <p className="text-gray-500 dark:text-[#8B8AA0] max-w-xl mx-auto text-sm">
            7 secciones de análisis institucional: veredicto sin filtros, mercado, finanzas, gobernanza y due diligence — sobre una idea real.
          </p>
        </div>

        {/* Dossier window */}
        <div className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-200 dark:border-white/[0.06] overflow-hidden shadow-2xl dark:shadow-none">
          {/* Top bar — idea + score */}
          <div className="bg-gray-50 dark:bg-[#1A1A26] px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0EB5C6] flex items-center justify-center text-white font-black text-sm font-heading shrink-0">{EXAMPLE_SCORE}</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 dark:text-[#F0EFF8] text-sm">{EXAMPLE_IDEA.idea_name}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0EB5C6]/15 text-[#0EB5C6] dark:text-[#38D5E3]">v1</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] capitalize">{EXAMPLE_IDEA.idea_industry} · {EXAMPLE_IDEA.target_country}</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[#34D399]/12 text-[#34D399] border border-[#34D399]/20 whitespace-nowrap">
              Idea con buen potencial
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-3 sm:px-4 pt-3 border-b border-gray-200 dark:border-white/[0.06] overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 text-xs font-medium rounded-t-lg whitespace-nowrap transition-all duration-150 cursor-pointer
                  ${active === t.id
                    ? 'text-gray-900 dark:text-[#F0EFF8] border-b-2 border-[#0EB5C6] bg-[#0EB5C6]/5'
                    : 'text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] border-b-2 border-transparent'}`}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.dot }} />
                {t.id}
                {t.tier && (
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded leading-none ${t.tier === 'Premium' ? 'bg-[#A78BFA]/15 text-[#A78BFA]' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-[#8B8AA0]'}`}>{t.tier}</span>
                )}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div className="p-4 sm:p-6 min-h-[420px]">
            <Panel />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-[#afaebb] mt-5">
          Ejemplo real generado por Validus · Tu dossier se adapta a tu idea, industria y país.
        </p>
      </div>
    </section>
  );
}
