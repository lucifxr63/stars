/* ════════════════════════════════════════════════════════════════
   DenariusPromo — cross-promo de ecosistema. Denarius (denarius.scouttech.lat)
   es la web hermana para llevar métricas, flujo de caja y una IA de salud
   financiera de tu PyME o startup. Branding verde propio de Denarius.
═══════════════════════════════════════════════════════════════════ */

const DENARIUS_URL = 'https://denarius.scouttech.lat/';
const GREEN = '#16A34A';

const FEATURES = [
  { title: 'Métricas en tiempo real', desc: 'Ingresos, egresos y liquidez sin planillas.' },
  { title: 'Flujo de caja claro', desc: 'Una foto de cuánta caja tienes, hoy.' },
  { title: 'IA de salud financiera', desc: 'Diagnóstico y alertas sobre tu PyME o startup.' },
];

const TXNS = [
  { label: 'Pago cliente — Factura 0212', time: 'Hoy, 14:30 hrs', amount: '+$1.250.000', positive: true },
  { label: 'Arriendo oficina', time: 'Ayer, 09:15 hrs', amount: '-$680.000', positive: false },
  { label: 'Sueldos equipo', time: '28 jun, 12:00 hrs', amount: '-$1.900.000', positive: false },
];

function DenariusMock() {
  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      <div className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-200 dark:border-white/[0.06] shadow-2xl dark:shadow-none p-5 sm:p-6">
        {/* Balance */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-1">Saldo del mes</p>
            <p className="text-3xl font-black text-gray-900 dark:text-[#F0EFF8] font-heading">$4.820.000</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${GREEN}1a`, color: GREEN }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
            +12,4%
          </span>
        </div>

        <div className="border-t border-gray-100 dark:border-white/[0.06] -mx-5 sm:-mx-6 mb-3" />

        {/* Transacciones */}
        <div className="space-y-2.5">
          {TXNS.map(t => (
            <div key={t.label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: t.positive ? `${GREEN}14` : '#EF444414' }}>
                <svg className="w-4 h-4" style={{ color: t.positive ? GREEN : '#EF4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.positive ? 'M4.5 19.5L19.5 4.5m0 0H9m10.5 0V15' : 'M19.5 4.5L4.5 19.5m0 0H15m-10.5 0V9'} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8] truncate">{t.label}</p>
                <p className="text-[11px] text-gray-400 dark:text-[#8B8AA0]">{t.time}</p>
              </div>
              <p className="text-sm font-bold shrink-0" style={{ color: t.positive ? GREEN : '#EF4444' }}>{t.amount}</p>
            </div>
          ))}
        </div>

        {/* IA insight */}
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl p-3" style={{ backgroundColor: `${GREEN}0d`, border: `1px solid ${GREEN}26` }}>
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: GREEN }}>
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
          </div>
          <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">
            <strong className="text-gray-900 dark:text-[#F0EFF8]">IA financiera:</strong> a este ritmo de gasto, tu caja alcanza para <strong>4,2 meses</strong>. Considera adelantar la cobranza de 2 facturas.
          </p>
        </div>
      </div>
    </div>
  );
}

export function DenariusPromo() {
  return (
    <section id="denarius" className="py-16 sm:py-24 border-t border-black/[0.05] dark:border-white/[0.06] bg-white dark:bg-[#12121A] relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[480px] h-[360px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: `${GREEN}14` }} />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left — text */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-semibold mb-5 uppercase tracking-wider"
              style={{ backgroundColor: `${GREEN}1a`, color: GREEN, border: `1px solid ${GREEN}33` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: GREEN }} />
              Parte del ecosistema · seguimos fomentando el emprendimiento
            </span>

            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4 leading-[1.1]">
              Validaste tu idea.{' '}
              <span style={{ color: GREEN }}>Ahora cuida su caja.</span>
            </h2>

            <p className="text-base text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-7 max-w-lg mx-auto lg:mx-0">
              También estamos construyendo <strong className="text-gray-700 dark:text-[#C4C4D4]">Denarius</strong>: la web para llevar tus métricas, el flujo de caja y una IA sobre la salud financiera de tu PyME o startup. Del problema a la operación, sin planillas.
            </p>

            <div className="space-y-3 mb-8 max-w-md mx-auto lg:mx-0">
              {FEATURES.map(f => (
                <div key={f.title} className="flex items-start gap-3 text-left">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${GREEN}1f` }}>
                    <svg className="w-3 h-3" style={{ color: GREEN }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed">
                    <strong className="text-gray-900 dark:text-[#F0EFF8] font-semibold">{f.title}.</strong> {f.desc}
                  </p>
                </div>
              ))}
            </div>

            <a href={DENARIUS_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-white font-semibold rounded-xl text-sm transition-all duration-150 active:scale-[0.98] shadow-lg cursor-pointer"
              style={{ backgroundColor: GREEN, boxShadow: `0 10px 25px -5px ${GREEN}59` }}>
              Conocer Denarius
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </a>
          </div>

          {/* Right — mockup */}
          <div className="order-1 lg:order-2">
            <DenariusMock />
          </div>
        </div>

        {/* Banda de sinergia — ecosistema conectado */}
        <div className="mt-10 sm:mt-14 rounded-3xl border border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-[#0A0A0F] p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-9 h-9 rounded-xl bg-[#0EB5C6]/12 text-[#0EB5C6] flex items-center justify-center font-heading font-black text-xs">V</span>
            <svg className="w-5 h-5 text-gray-400 dark:text-[#8B8AA0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center font-heading font-black text-xs" style={{ backgroundColor: `${GREEN}1f`, color: GREEN }}>D</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed text-center sm:text-left">
            <strong className="text-gray-900 dark:text-[#F0EFF8]">Ecosistema conectado:</strong> las finanzas reales que mides en Denarius pueden alimentar tu validación en Validus. Más datos duros sobre tu caja = un veredicto y un unit economics más precisos.
          </p>
        </div>
      </div>
    </section>
  );
}
