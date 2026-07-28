import { useState } from 'react';

/* ════════════════════════════════════════════════════════════════
   FaqSection — FAQ visible. Las preguntas/respuestas reflejan 1:1 el
   JSON-LD FAQPage de index.html (requisito para que AEO/GEO sea legítimo:
   el contenido estructurado debe existir en la página).
═══════════════════════════════════════════════════════════════════ */

const FAQS = [
  {
    q: '¿Qué es Validus?',
    a: 'Validus es una plataforma de IA que valida ideas de startup. En 4 pasos arma un dossier nivel-VC con score de viabilidad, análisis de mercado (TAM/SAM/SOM), unit economics, gobernanza y due diligence.',
  },
  {
    q: '¿Cómo funciona Validus?',
    a: 'Describes tu idea, mercado y equipo en lenguaje natural. El motor Animus cruza tu caso con datos reales de Chile (Banco Central, CMF, SEIA, INAPI) y playbooks de fundraising para entregarte un dossier en unos 10 minutos.',
  },
  {
    q: '¿Cuánto cuesta Validus?',
    a: 'Hay un plan gratis con 3 validaciones al mes. Los planes pagados van de US$19 (Basic) a US$149 (Premium) al mes, con más validaciones, RAG de datos macro, due diligence y acceso a API.',
  },
  {
    q: '¿Para quién es Validus?',
    a: 'Para founders y PYMEs de Chile y LatAm que quieren validar una idea antes de invertir tiempo y capital, y para inversores o aceleradoras que evalúan startups.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Sí. Validus cumple la Ley 21.719 de protección de datos personales de Chile. Los datos se cifran y se anonimizan antes de cualquier análisis agregado.',
  },
  {
    q: '¿Qué es Animus?',
    a: 'Animus es el motor GraphRAG detrás de Validus: un grafo de conocimiento con 5 expertos (macro, mercados, unit economics, legal y estrategia) que razona con datos institucionales reales y entrega evidencia citable con procedencia.',
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-14 sm:py-20 lg:py-28 border-t border-black/[0.05] dark:border-white/[0.06] bg-white dark:bg-[#12121A]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#0EB5C6] mb-3">Preguntas frecuentes</p>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8]">
            Lo que querés saber
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q} className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-[#0A0A0F] overflow-hidden">
                <button
                  onClick={() => setOpen(on ? null : i)}
                  aria-expanded={on}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer hover:bg-gray-100/60 dark:hover:bg-white/[0.02] transition-colors">
                  <span className="font-heading text-base font-semibold text-gray-900 dark:text-[#F0EFF8]">{f.q}</span>
                  <svg className={`w-5 h-5 shrink-0 text-[#0EB5C6] transition-transform duration-200 ${on ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {on && (
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{f.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
