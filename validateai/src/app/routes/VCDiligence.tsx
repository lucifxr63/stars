import { Link } from 'react-router-dom';

function Logo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} aria-label="Validus" role="img">
      <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" fill="white" />
      <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6" />
      <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6" />
    </svg>
  );
}

function SeverityBadge({ level }: { level: 'critical' | 'warning' | 'info' }) {
  const cfg = {
    critical: { bg: 'bg-red-500/10 border-red-500/30 text-red-400', dot: 'bg-red-500', label: 'RIESGO CRÍTICO' },
    warning:  { bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', dot: 'bg-amber-500', label: 'ALERTA' },
    info:     { bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400', dot: 'bg-blue-500', label: 'CONTEXTO' },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

const ALERTS = [
  {
    level: 'critical' as const,
    category: 'Compliance Datos · Ley 21.719',
    title: 'Sin Gestor de Consentimiento (CMP) — Multa máxima UF 15.000',
    impact: 'USD $586.000 de exposición · 117% del round',
    detail: 'La startup procesa datos de usuarios finales sin consentimiento explícito. Bajo la Ley 21.719 vigente en Chile, cada infracción grave puede alcanzar UF 15.000. La multa supera el capital total del round.',
  },
  {
    level: 'critical' as const,
    category: 'Compliance Fintech · Ley 21.521',
    title: 'Sin registro CMF — Operación financiera no autorizada',
    impact: 'Riesgo de cese operacional inmediato',
    detail: 'La Ley Fintech 21.521 exige registro ante la CMF para cualquier prestador de servicios de iniciación de pagos. Operar sin registro expone a la startup a una orden de cese que anula todas las transacciones procesadas.',
  },
  {
    level: 'critical' as const,
    category: 'Unit Economics',
    title: 'CAC de $8.200 CLP es matemáticamente inválido en compliance',
    impact: 'CAC real post-compliance: $18.000–$24.000 CLP · LTV:CAC cae de 5.5x a 2.1x',
    detail: 'El CAC fue calculado con campañas de Meta/Instagram sin CMP activo. Bajo la Ley 21.719, el retargeting y lookalike audience que generaron ese CAC dejan de ser replicables. El modelo de escalamiento x5 en 12 meses colapsa.',
  },
];

const COMPARISON = [
  { dimension: 'Compliance datos',    pitch: 'Implícitamente OK',      detected: 'CRÍTICO — sin CMP, Ley 21.719', crit: true },
  { dimension: 'Registro regulatorio', pitch: 'No mencionado',         detected: 'CRÍTICO — sin registro CMF',     crit: true },
  { dimension: 'CAC',                 pitch: '$8.200 CLP',             detected: '$18.000–$24.000 CLP (compliance)', crit: true },
  { dimension: 'LTV:CAC',            pitch: '~5.5x',                   detected: '~2.1x — bajo benchmark 3:1',      crit: true },
  { dimension: 'Payback period',     pitch: '~7 meses',                detected: '16–21 meses',                      crit: false },
  { dimension: 'Exposición multa',   pitch: 'USD $0',                  detected: 'USD $586.000 (117% del round)',    crit: true },
  { dimension: 'TRL',                pitch: '"Producto validado"',     detected: 'TRL 4 — brecha 12–18 meses',       crit: false },
  { dimension: 'Tesis de escalamiento', pitch: 'Viable',              detected: 'Inválida en condiciones reales',   crit: true },
];

const SEGMENTS = [
  {
    icon: (
      <svg className="w-5 h-5 text-[#0EB5C6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0l9 6 9-6" />
      </svg>
    ),
    target: 'Platanus Ventures · Start-Up Chile',
    pain: 'El cuello de botella del volumen',
    pitch: 'Reciben +1.000 postulaciones. Validus escanea el 100% del batch en minutos, levantando banderas rojas regulatorias y de Unit Economics antes de que su equipo pierda horas en entrevistas.',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#6B5EE6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    target: 'Manutara · VCs Especializados Fintech',
    pain: 'Riesgo regulatorio profundo en Seed/Series A',
    pitch: 'Invierten cheques de $500K. El sistema detectó USD $586.000 de exposición en una fintech tipo — más que el cheque. Eso resuena directamente en el Comité de Inversiones.',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
    target: 'Family Offices Santiago',
    pain: 'Capital disponible, expertise técnico limitado',
    pitch: 'Validus es su Analista Técnico y Legal de Venture Capital automatizado. No firmen un cheque sin correr el perfil de la startup por el motor de Due Diligence.',
  },
];

export function VCDiligence() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0EFF8]">

      {/* ── Navbar ── */}
      <nav className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between px-5 py-3 bg-[#12121A]/90 backdrop-blur-md border border-white/[0.07] rounded-2xl max-w-5xl mx-auto">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-sm font-bold tracking-tight hidden sm:block">Validus</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xs text-[#8B8AA0] hover:text-[#F0EFF8] transition-colors hidden sm:block">
            Volver al inicio
          </Link>
          <Link
            to="/login"
            className="px-4 py-1.5 bg-[#0EB5C6] hover:bg-[#0EB5C6]/80 text-white text-xs font-bold rounded-xl transition-colors"
          >
            Probar gratis
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pt-28 pb-24 space-y-24">

        {/* ── Hero ── */}
        <section className="text-center space-y-6">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#6B5EE6]/10 border border-[#6B5EE6]/20 text-[11px] font-bold text-[#6B5EE6] uppercase tracking-widest">
            Para Fondos · Aceleradoras · Family Offices
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] tracking-tight max-w-4xl mx-auto">
            El motor que detectó{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">
              USD $586.000
            </span>{' '}
            de riesgo regulatorio en{' '}
            <span className="text-[#0EB5C6]">12 segundos</span>
          </h1>

          <p className="text-base sm:text-lg text-[#8B8AA0] max-w-2xl mx-auto leading-relaxed">
            Una fintech chilena estaba levantando USD $500.000 Seed.
            La exposición regulatoria que no estaba en el deck superaba el 117% del capital del round.
            El analista tardó 12 segundos en saberlo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0EB5C6] hover:bg-[#0EB5C6]/80 text-white font-bold rounded-xl transition-colors text-sm"
            >
              Probar con una startup de mi portafolio
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <a
              href="#caso-estudio"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 hover:border-white/20 text-[#8B8AA0] hover:text-[#F0EFF8] font-medium rounded-xl transition-colors text-sm"
            >
              Ver caso de estudio completo
            </a>
          </div>
        </section>

        {/* ── Stats bar ── */}
        <section className="grid grid-cols-3 gap-4">
          {[
            { value: '12s', label: 'Tiempo de análisis completo', color: '#0EB5C6' },
            { value: '7/7', label: 'Alertas adversariales detectadas', color: '#34D399' },
            { value: '117%', label: 'Del round en exposición regulatoria', color: '#EF4444' },
          ].map(s => (
            <div key={s.label} className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5 text-center">
              <p className="text-3xl sm:text-4xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] text-[#8B8AA0] mt-1.5 leading-snug">{s.label}</p>
            </div>
          ))}
        </section>

        {/* ── Caso de estudio ── */}
        <section id="caso-estudio" className="space-y-8">
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-[#8B8AA0] uppercase tracking-widest">Caso de Estudio Certificado · 2026-06-09</span>
            <h2 className="text-2xl sm:text-3xl font-black">Startup Gamma — Fintech B2C Chile · Seed · USD $500K</h2>
            <p className="text-[#8B8AA0] text-sm max-w-2xl">
              Aplicación de pagos digitales B2C, 2.400 usuarios activos, CAC $8.200 CLP vía Meta,
              ticket promedio $15.000 CLP. Pitch deck en orden. Motor de due diligence AnimusPY activado.
            </p>
          </div>

          <div className="space-y-4">
            {ALERTS.map((alert, i) => (
              <div key={i} className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <SeverityBadge level={alert.level} />
                  <span className="text-[11px] text-[#4A495E]">{alert.category}</span>
                </div>
                <p className="font-bold text-[#F0EFF8]">{alert.title}</p>
                <p className="text-sm text-[#8B8AA0] leading-relaxed">{alert.detail}</p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="text-xs font-bold text-red-400">{alert.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Before / After table ── */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-black">Pitch deck vs. realidad</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#12121A]">
                  <th className="text-left px-5 py-3.5 text-[11px] font-bold text-[#8B8AA0] uppercase tracking-wider">Dimensión</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-bold text-[#8B8AA0] uppercase tracking-wider">Lo que decía el deck</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-bold text-[#8B8AA0] uppercase tracking-wider">Lo que detectó Validus</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-[#8B8AA0] text-xs font-medium">{row.dimension}</td>
                    <td className="px-5 py-3.5 text-[#F0EFF8] text-xs">{row.pitch}</td>
                    <td className={`px-5 py-3.5 text-xs font-semibold ${row.crit ? 'text-red-400' : 'text-amber-400'}`}>{row.detected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── How it works for VCs ── */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black">Cómo funciona para tu fondo</h2>
            <p className="text-[#8B8AA0] text-sm">Tres pasos. Sin instalación. Sin integración técnica.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                step: '01',
                title: 'Subes el perfil de la startup',
                body: 'Nombre, industria, etapa, mercado objetivo, modelo de negocio. Sin PDF, sin formularios largos.',
                color: '#0EB5C6',
              },
              {
                step: '02',
                title: 'El motor analiza 33 vectores de riesgo',
                body: 'GraphRAG híbrido: compliance regulatorio chileno, unit economics, marco legal fintech/datos, contexto macro FRED en tiempo real.',
                color: '#6B5EE6',
              },
              {
                step: '03',
                title: 'Recibes el reporte adversarial',
                body: 'Alertas críticas, warnings y contexto macro. Con exposición financiera calculada y preguntas específicas para la reunión de pitch.',
                color: '#34D399',
              },
            ].map(s => (
              <div key={s.step} className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5 space-y-3">
                <span className="text-3xl font-black" style={{ color: s.color }}>{s.step}</span>
                <p className="font-bold text-[#F0EFF8]">{s.title}</p>
                <p className="text-sm text-[#8B8AA0] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Segmented pitch ── */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-black">Diseñado para cada tipo de inversor</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {SEGMENTS.map((seg, i) => (
              <div key={i} className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  {seg.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wider">{seg.target}</p>
                  <p className="text-sm font-bold text-[#F0EFF8] mt-1">{seg.pain}</p>
                </div>
                <p className="text-sm text-[#8B8AA0] leading-relaxed">{seg.pitch}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Caballo de Troya CTA ── */}
        <section className="relative overflow-hidden rounded-3xl border border-[#0EB5C6]/20 bg-gradient-to-br from-[#0EB5C6]/5 via-[#12121A] to-[#6B5EE6]/5 p-8 sm:p-12 text-center space-y-6">
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }} />
          <div className="relative space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0EB5C6]/10 border border-[#0EB5C6]/20 text-[11px] font-bold text-[#0EB5C6] uppercase tracking-widest">
              Oferta sin costo · Sin compromiso
            </span>
            <h2 className="text-2xl sm:text-3xl font-black max-w-2xl mx-auto leading-snug">
              "No me creas. Toma la startup que tengas hoy en el tope de tu funnel."
            </h2>
            <p className="text-[#8B8AA0] text-sm max-w-xl mx-auto leading-relaxed">
              Envíanos su deck o su web. Te devolvemos el reporte de Due Diligence de Validus en 15 minutos sin costo.
              Compáralo con lo que vio tu equipo.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href="mailto:contacto@scouttech.lat?subject=Quiero probar Validus con una startup de mi portafolio&body=Hola, me interesa probar el motor de due diligence con una startup. Adjunto el deck / web:"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0EB5C6] hover:bg-[#0EB5C6]/80 text-white font-bold rounded-xl transition-colors text-sm"
              >
                Enviar startup para análisis gratuito
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 hover:border-white/20 text-[#8B8AA0] hover:text-[#F0EFF8] font-medium rounded-xl transition-colors text-sm"
              >
                Ver planes Enterprise
              </Link>
            </div>
            <p className="text-[11px] text-[#4A495E]">
              contacto@scouttech.lat · Respuesta en menos de 15 minutos en horario hábil
            </p>
          </div>
        </section>

        {/* ── Technical credibility ── */}
        <section className="grid sm:grid-cols-2 gap-4">
          <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5 space-y-3">
            <p className="text-[11px] font-bold text-[#8B8AA0] uppercase tracking-wider">Motor AnimusPY</p>
            <p className="text-sm text-[#F0EFF8] leading-relaxed">
              GraphRAG híbrido: búsqueda semántica vectorial + traversal de grafo de conocimiento.
              33 nodos Familia A (compliance, unit economics, TRL, gobernanza) + Familia B macro en tiempo real vía FRED API.
            </p>
            <div className="flex flex-wrap gap-2">
              {['FastAPI', 'pgvector', 'OpenAI Embeddings', 'Railway'].map(t => (
                <span key={t} className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-[#8B8AA0]">{t}</span>
              ))}
            </div>
          </div>
          <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5 space-y-3">
            <p className="text-[11px] font-bold text-[#8B8AA0] uppercase tracking-wider">Cobertura regulatoria Chile</p>
            <ul className="space-y-1.5">
              {[
                'Ley 21.719 — Protección de Datos Personales',
                'Ley 21.521 — Fintech · Registro CMF',
                'Ley 21.643 — Ley Karin · Ambiente laboral',
                'Corfo Semilla Inicia / Expande · Requisitos',
                'CMF · SFA · Sistema de Finanzas Abiertas',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-[#8B8AA0]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0EB5C6] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo className="w-6 h-6" />
            <span className="text-xs text-[#4A495E]">Validus · ScoutTech · contacto@scouttech.lat</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#4A495E]">
            <Link to="/privacy-policy" className="hover:text-[#8B8AA0] transition-colors">Privacidad</Link>
            <Link to="/pricing" className="hover:text-[#8B8AA0] transition-colors">Precios</Link>
            <Link to="/login" className="hover:text-[#8B8AA0] transition-colors">Acceder</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
