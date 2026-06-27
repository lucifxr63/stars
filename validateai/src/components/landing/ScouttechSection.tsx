/* ════════════════════════════════════════════════════════════════
   ScouttechSection — la empresa detrás de Validus y Denarius.
   Branding oficial de Scouttech (Design/): brújula navy #041440 + cian
   #0EB5C6, wordmark Scout·tech. Banda navy para dar gravedad de matriz.
═══════════════════════════════════════════════════════════════════ */

const SCOUTTECH_URL = 'https://scouttech.lat/';
const NAVY = '#041440';
const CYAN = '#0EB5C6';

/* Brújula oficial (assets/logo-mark.svg) — variante dark: 6 rayos cian + 2 blancos */
function Compass({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 370 371" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M215 120L185 0L155 120L185 170L215 120Z" fill={CYAN} />
      <path d="M155 251L185 371L215 251L185 201L155 251Z" fill={CYAN} />
      <path d="M121.853 222.355L51.1422 321.35L150.137 250.64L171.35 201.142L121.853 222.355Z" fill={CYAN} />
      <path d="M248.64 152.137L319.35 53.1421L220.355 123.853L199.142 173.35L248.64 152.137Z" fill={CYAN} />
      <path d="M120 157L0 187L120 217L170 187L120 157Z" fill={CYAN} />
      <path d="M250 217L370 187L250 157L200 187L250 217Z" fill={CYAN} />
      <path d="M220.355 250.64L319.35 321.35L248.64 222.355L199.142 201.142L220.355 250.64Z" fill="#FFFFFF" />
      <path d="M150.137 123.853L51.1421 53.1421L121.853 152.137L171.35 173.35L150.137 123.853Z" fill="#FFFFFF" />
    </svg>
  );
}

export function ScouttechSection() {
  return (
    <section id="scouttech" className="relative overflow-hidden" style={{ backgroundColor: NAVY }}>
      {/* Glow + brújula watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[130px] pointer-events-none" style={{ backgroundColor: 'rgba(14,181,198,0.12)' }} />
      <Compass className="absolute -right-16 -bottom-16 w-72 h-72 opacity-[0.05] pointer-events-none rotate-12" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        {/* Lockup */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Compass className="w-9 h-9" />
          <span className="font-heading text-2xl font-bold text-white tracking-tight">Scout<span style={{ color: CYAN }}>tech</span></span>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: CYAN }}>
          La empresa detrás de Validus y Denarius
        </p>

        <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-6">
          Mapeamos el terreno.<br />
          <span style={{ color: CYAN }}>Tú conquistas el mercado.</span>
        </h2>

        <p className="text-base text-white/60 max-w-xl mx-auto leading-relaxed mb-8">
          Scouttech construye la inteligencia para que emprender en LatAm sea menos incierto. <strong className="text-white/90 font-semibold">Validus</strong> valida tu idea, <strong className="text-white/90 font-semibold">Denarius</strong> cuida su caja — el resto lo conquistas tú.
        </p>

        {/* Productos */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-9">
          {[{ name: 'Validus', tag: 'Validación' }, { name: 'Denarius', tag: 'Finanzas' }].map(p => (
            <span key={p.name} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.04] text-white/80">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CYAN }} />
              {p.name} <span className="text-white/40">· {p.tag}</span>
            </span>
          ))}
        </div>

        <a href={SCOUTTECH_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 font-semibold rounded-xl text-sm transition-all duration-150 active:scale-[0.98] shadow-lg cursor-pointer"
          style={{ backgroundColor: CYAN, color: NAVY, boxShadow: '0 10px 25px -5px rgba(14,181,198,0.45)' }}>
          Conoce Scouttech
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
        </a>
      </div>
    </section>
  );
}
