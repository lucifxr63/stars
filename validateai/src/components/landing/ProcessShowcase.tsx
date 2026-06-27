import { useState } from 'react';
import { EXAMPLE_IDEA, EXAMPLE_CUSTOMER, EXAMPLE_SCORE, EXAMPLE_SCORE_BREAKDOWN } from '@/data/exampleReport';

/* ════════════════════════════════════════════════════════════════
   ProcessShowcase — stepper interactivo "cómo funciona". Cada paso del
   wizard real (Idea → Mercado → Equipo → Dossier) se previsualiza con un
   panel realista del producto, relleno con el caso FreshBox (el mismo del
   dossier). Mismo patrón de tabs que ProductShowcase.
═══════════════════════════════════════════════════════════════════ */

const STEPS = [
  { n: '01', label: 'Tu idea',     sub: 'Define el problema y la solución', time: '~3 min', color: '#0EB5C6' },
  { n: '02', label: 'Tu mercado',  sub: 'A quién le vendes y cómo llegas',  time: '~3 min', color: '#34D399' },
  { n: '03', label: 'Tu equipo',   sub: 'Tu experiencia como founder',      time: '~2 min', color: '#38D5E3' },
  { n: '04', label: 'Tu dossier',  sub: 'Score + 7 secciones, listo',       time: '~2 min', color: '#F7C56C' },
] as const;

/* ─── Building blocks (look de formulario real) ─── */
function Field({ label, value, required, mono }: { label: string; value: string; required?: boolean; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 dark:text-[#8B8AA0] mb-1.5">
        {label}{required && <span className="text-[#F87171]"> *</span>}
      </p>
      <div className={`rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-[#0A0A0F] px-3.5 py-2.5 text-sm leading-relaxed ${mono ? 'font-mono text-[13px]' : ''} text-gray-800 dark:text-[#F0EFF8]`}>
        {value}
      </div>
    </div>
  );
}

function ChipRow({ label, options, selected, color }: { label: string; options: string[]; selected: string; color: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 dark:text-[#8B8AA0] mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = o === selected;
          return (
            <span key={o}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${on ? '' : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-[#8B8AA0] bg-white dark:bg-[#12121A]'}`}
              style={on ? { color, borderColor: `${color}66`, backgroundColor: `${color}14` } : undefined}>
              {o}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Bar({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] text-gray-500 dark:text-[#8B8AA0] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${val}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-bold text-gray-700 dark:text-[#F0EFF8] tabular-nums w-6 text-right">{val}</span>
    </div>
  );
}

/* ─── Panels (caso FreshBox) ─── */
function IdeaPanel() {
  return (
    <div className="space-y-4">
      <Field label="Nombre de tu idea" value={EXAMPLE_IDEA.idea_name} />
      <Field label="¿Qué problema resuelves?" required
        value="Las familias urbanas no confían en la calidad ni el origen de los orgánicos del supermercado, y no tienen tiempo de ir al mercado a elegir productos frescos." />
      <Field label="Describe tu solución" required
        value="Caja de verduras y frutas 100% orgánicas de agricultores locales verificados, armada según las preferencias del hogar y entregada en tu puerta cada semana." />
      <ChipRow label="Industria" color="#0EB5C6" selected="E-Commerce"
        options={['E-Commerce', 'SaaS', 'FinTech', 'HealthTech', 'FoodTech', 'Logística']} />
    </div>
  );
}

function MercadoPanel() {
  return (
    <div className="space-y-4">
      <Field label="A quién le vendes — ICP (Ideal Customer Profile)" value={EXAMPLE_CUSTOMER.customer_segment} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="País objetivo" value="Chile" />
        <Field label="Región" value="Región Metropolitana" />
      </div>
      <ChipRow label="Modelo de negocio" color="#34D399" selected="B2C"
        options={['B2B', 'B2C', 'B2B2C', 'Marketplace']} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rango de precio estimado" value="10–50 USD" />
        <Field label="Primeros 100 clientes" value="Instagram + referidos" />
      </div>
    </div>
  );
}

function EquipoPanel() {
  const fit = [
    { l: 'Problema', v: 82 }, { l: 'Industria', v: 70 }, { l: 'Técnica', v: 74 }, { l: 'Red', v: 66 },
  ];
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Años de experiencia en la industria" value="4 años" />
        <ChipRow label="Nivel técnico del equipo" color="#38D5E3" selected="Algo de código"
          options={['Nada técnico', 'Algo de código', 'Somos devs']} />
      </div>
      <ChipRow label="Composición del equipo" color="#38D5E3" selected="Equipo Fundador"
        options={['Solo Founder', 'Equipo Fundador', 'Equipo + Empleados']} />
      <ChipRow label="Estado de tracción" color="#38D5E3" selected="Idea en papel"
        options={['Idea en papel', 'MVP en desarrollo', 'MVP lanzado', 'Primeros clientes']} />
      <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-[#0A0A0F] px-3.5 py-2.5">
        <span className="w-4 h-4 rounded bg-[#38D5E3] flex items-center justify-center shrink-0">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </span>
        <span className="text-sm text-gray-800 dark:text-[#F0EFF8]">He sufrido o vivido este problema personalmente</span>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-3.5">
        <p className="text-[11px] font-bold text-[#38D5E3] uppercase tracking-wide mb-2.5">Founder-Market Fit calculado</p>
        <div className="space-y-2">
          {fit.map(f => <Bar key={f.l} label={f.l} val={f.v} color="#38D5E3" />)}
        </div>
      </div>
    </div>
  );
}

function DossierPanel() {
  const dims = Object.entries(EXAMPLE_SCORE_BREAKDOWN) as [string, number][];
  const labels: Record<string, string> = { problem: 'Problema', market: 'Mercado', competition: 'Competencia', solution: 'Solución', execution: 'Ejecución' };
  const colors = ['#0EB5C6', '#34D399', '#F7C56C', '#38D5E3', '#F87171'];
  const sections = ['Veredicto', 'Validación', 'Estrategia', 'Finanzas', 'Hoja de Ruta', 'Inversión', 'Due Diligence'];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#0EB5C6] flex flex-col items-center justify-center text-white shrink-0 font-heading">
          <span className="text-2xl font-black leading-none">{EXAMPLE_SCORE}</span>
          <span className="text-[8px] opacity-80">/100</span>
        </div>
        <div>
          <p className="text-[11px] font-bold text-[#34D399] uppercase tracking-wide">Idea con buen potencial</p>
          <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-snug">Tu dossier está listo: score, análisis y PDF investor-ready.</p>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] p-3.5 space-y-2">
        {dims.map(([k, v], i) => <Bar key={k} label={labels[k] ?? k} val={v} color={colors[i]} />)}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-500 dark:text-[#8B8AA0] mb-2">7 secciones generadas</p>
        <div className="flex flex-wrap gap-2">
          {sections.map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#C4C4D4] bg-white dark:bg-[#12121A]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const PANELS = [IdeaPanel, MercadoPanel, EquipoPanel, DossierPanel];

export function ProcessShowcase() {
  const [active, setActive] = useState(0);
  const Panel = PANELS[active];
  const step = STEPS[active];

  return (
    <section id="how" className="py-14 sm:py-20 lg:py-28 border-t border-black/[0.05] dark:border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#0EB5C6] mb-3">El proceso</p>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
            De la idea al dossier <span className="gradient-text">en 4 pasos</span>
          </h2>
          <p className="text-gray-500 dark:text-[#8B8AA0] max-w-lg mx-auto text-base">
            Sin configuración, sin templates. Describe tu idea y mira cómo se arma el dossier — paso a paso.
          </p>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
          {STEPS.map((s, i) => {
            const on = i === active;
            return (
              <button key={s.n} onClick={() => setActive(i)}
                className={`relative text-left rounded-2xl border p-4 transition-all duration-200 cursor-pointer
                  ${on ? 'bg-white dark:bg-[#12121A] shadow-lg dark:shadow-none' : 'bg-gray-50/60 dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/10'}`}
                style={on ? { borderColor: s.color } : undefined}>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center font-heading font-black text-sm"
                    style={{ backgroundColor: `${s.color}1a`, color: s.color }}>{s.n}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                    style={{ color: s.color, borderColor: `${s.color}30`, backgroundColor: `${s.color}0f` }}>{s.time}</span>
                </div>
                <p className={`font-heading text-sm font-bold ${on ? 'text-gray-900 dark:text-[#F0EFF8]' : 'text-gray-700 dark:text-[#C4C4D4]'}`}>{s.label}</p>
                <p className="text-[11px] text-gray-400 dark:text-[#8B8AA0] leading-snug mt-0.5">{s.sub}</p>
              </button>
            );
          })}
        </div>

        {/* Panel (pantalla del producto) */}
        <div className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-200 dark:border-white/[0.06] overflow-hidden shadow-xl dark:shadow-none">
          {/* Faux header del wizard */}
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-[#1A1A26]">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: step.color }}>Paso {step.n} de 04</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">{step.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <span key={s.n} className="h-1.5 rounded-full transition-all duration-300 bg-gray-200 dark:bg-white/10"
                  style={{ width: i === active ? 20 : 8, ...(i <= active ? { backgroundColor: step.color } : {}) }} />
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-7 min-h-[360px]">
            <Panel />
          </div>

          {/* Faux CTA del wizard */}
          <div className="px-5 sm:px-7 pb-5 sm:pb-6">
            <div className="w-full py-3 rounded-xl text-center text-sm font-semibold text-white" style={{ backgroundColor: step.color }}>
              {active < 3 ? 'Continuar →' : 'Ver dossier completo →'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
