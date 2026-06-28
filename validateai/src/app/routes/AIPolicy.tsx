import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

function Logo({ className = 'w-6 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} aria-label="Validus" role="img">
      <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white" />
      <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6" />
      <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-gray-900 dark:text-[#F0EFF8] mb-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
        {title}
      </h2>
      <div className="space-y-3 text-sm text-gray-600 dark:text-[#8B8AA0] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0EB5C6]/10 text-[#0EB5C6] text-xs font-medium border border-[#0EB5C6]/20">
      {children}
    </span>
  );
}

export function AIPolicy() {
  const lastUpdated = '28 de junio de 2026';

  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] text-gray-900 dark:text-[#F0EFF8]">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-black/[0.05] dark:border-white/[0.06] bg-[#F8F7FF]/80 dark:bg-[#0A0A0F]/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <Logo className="w-5 h-7" />
            <span className="font-heading text-sm font-bold text-gray-900 dark:text-[#F0EFF8] group-hover:text-[#0EB5C6] transition-colors">
              Validus
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/"
              className="text-xs text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Pill>IA responsable</Pill>
            <Pill>Trazabilidad</Pill>
            <span className="text-xs text-gray-400 dark:text-[#afaebb]">Última actualización: {lastUpdated}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Política de Uso de IA
          </h1>
          <p className="text-base text-gray-500 dark:text-[#8B8AA0] max-w-2xl">
            Validus usa inteligencia artificial para estructurar evidencia y acelerar decisiones, no para reemplazar tu criterio. Esta política explica cómo funciona, qué puedes esperar y cuáles son sus límites.
          </p>
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-[#12111A] rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-6 sm:p-10">

          <Section title="1. Propósito de esta política">
            <p>
              Queremos que entiendas con claridad cómo Validus utiliza inteligencia artificial, qué tan confiables son sus resultados y qué responsabilidad mantienes tú como usuario. La transparencia es parte central de nuestra propuesta de valor.
            </p>
          </Section>

          <Section title="2. Cómo Validus usa la IA">
            <p>
              Validus combina la información que ingresas con modelos de lenguaje de gran escala (principalmente <strong className="text-gray-900 dark:text-[#F0EFF8]">Claude, de Anthropic</strong>) y, según el plan, con datos de fuentes externas. La IA estructura, analiza y resume esa información para producir un score, recomendaciones y entregables.
            </p>
            <p>
              El objetivo es <strong className="text-gray-900 dark:text-[#F0EFF8]">estructurar evidencia para mejores decisiones</strong>, no entregar verdades absolutas.
            </p>
          </Section>

          <Section title="3. Dato, inferencia y supuesto: tres cosas distintas">
            <p>Para interpretar correctamente un análisis, distingue entre:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Dato que tú entregas:</strong> la descripción de tu idea, mercado y modelo de negocio. Su calidad determina la calidad del análisis.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Dato de fuentes externas:</strong> señales de mercado, tendencias o referencias provenientes de terceros, cuando están disponibles e integradas.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Inferencia de la IA:</strong> conclusiones y recomendaciones que el modelo deriva a partir de lo anterior. Son interpretaciones, no hechos verificados.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Supuesto:</strong> cuando falta información, la IA puede asumir condiciones razonables. Los supuestos deben tratarse como hipótesis a validar.</li>
            </ul>
          </Section>

          <Section title="4. Limitaciones y posibilidad de error">
            <p>
              Los modelos de IA pueden cometer errores, generar afirmaciones imprecisas o "alucinar" información que parece plausible pero no es exacta. Validus aplica controles para reducir estos riesgos, pero <strong className="text-gray-900 dark:text-[#F0EFF8]">no puede garantizar que todos los resultados sean correctos o completos</strong>.
            </p>
            <p>
              Trata cada resultado como un punto de partida que debes contrastar antes de actuar, especialmente en decisiones de inversión, legales o financieras.
            </p>
          </Section>

          <Section title="5. Fuentes, supuestos y nivel de confianza">
            <p>
              Buscamos mostrar, siempre que sea posible, de dónde proviene la información y con qué nivel de certeza se entrega. Nuestro objetivo de producto es una capa de trazabilidad que distinga claramente la evidencia real de la inferencia, e indique supuestos y nivel de confianza por sección.
            </p>
            <p>
              Esta capacidad se irá ampliando de forma progresiva en la plataforma.
            </p>
          </Section>

          <Section title="6. Datos demo o simulados">
            <p>
              Cuando una fuente externa no está disponible, o cuando exploras el producto, algunas secciones pueden mostrar <strong className="text-gray-900 dark:text-[#F0EFF8]">datos de ejemplo, demostrativos o simulados</strong>. Estos contenidos se etiquetan de forma explícita y <strong className="text-gray-900 dark:text-[#F0EFF8]">no representan evidencia real de mercado</strong>. No tomes decisiones con base en ellos.
            </p>
          </Section>

          <Section title="7. Supervisión humana: tú decides">
            <p>
              Validus no reemplaza el juicio humano. Eres tú quien toma las decisiones finales sobre tu negocio. La plataforma es una herramienta de apoyo que organiza información y ofrece perspectivas; la responsabilidad de validar y decidir es siempre tuya.
            </p>
          </Section>

          <Section title="8. No es asesoría profesional">
            <p>
              Ningún resultado generado por IA en Validus constituye asesoría legal, financiera, contable, tributaria ni de inversión. Para esas materias, consulta a un profesional habilitado e independiente. (Ver también nuestros{' '}
              <Link to="/terms" className="text-[#0EB5C6] hover:underline">Términos y Condiciones</Link>.)
            </p>
          </Section>

          <Section title="9. Uso responsable y prohibido">
            <p>Al usar las funciones de IA de Validus, te comprometes a no:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Presentar resultados generados por IA como hechos verificados ante terceros sin la debida validación.</li>
              <li>Usar la plataforma para generar contenido engañoso, fraudulento o que infrinja derechos de terceros.</li>
              <li>Ingresar datos personales sensibles de terceros sin autorización.</li>
            </ul>
          </Section>

          <Section title="10. Privacidad y entrenamiento de modelos">
            <p>
              El procesamiento de tus ideas por modelos de IA y el uso opcional de datos anonimizados para mejorar el servicio se detallan en nuestra{' '}
              <Link to="/privacy-policy" className="text-[#0EB5C6] hover:underline">Política de Privacidad</Link>. Nunca compartimos tus ideas con otros usuarios y puedes revocar tu consentimiento de entrenamiento en cualquier momento.
            </p>
          </Section>

          <Section title="11. Cambios a esta política">
            <p>
              Actualizaremos esta política a medida que evolucionen nuestras capacidades de IA y trazabilidad. Notificaremos los cambios sustanciales mediante un aviso visible en la plataforma. La fecha de última actualización aparece al inicio de este documento.
            </p>
          </Section>

          <Section title="12. Contacto">
            <p>
              Para consultas sobre el uso de IA en Validus, escríbenos a{' '}
              <a href="mailto:contacto@validus.scouttech.lat" className="text-[#0EB5C6] hover:underline">
                contacto@validus.scouttech.lat
              </a>.
            </p>
          </Section>

          {/* Footer note */}
          <div className="mt-10 pt-6 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-[#afaebb]">
              IA con trazabilidad, no solo respuestas. Tú mantienes el control de la decisión.
            </p>
            <a
              href="mailto:contacto@validus.scouttech.lat"
              className="text-xs text-[#0EB5C6] hover:underline whitespace-nowrap"
            >
              ¿Preguntas? Contáctanos →
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/[0.05] dark:border-white/[0.06] py-8 mt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400 dark:text-[#afaebb]">
            © {new Date().getFullYear()} Validus · Hecho en Chile 🇨🇱
          </p>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="text-xs text-gray-400 dark:text-[#afaebb] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">
              Privacidad
            </Link>
            <Link to="/terms" className="text-xs text-gray-400 dark:text-[#afaebb] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">
              Términos
            </Link>
            <a href="mailto:contacto@validus.scouttech.lat" className="text-xs text-gray-400 dark:text-[#afaebb] hover:text-[#0EB5C6] transition-colors">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
