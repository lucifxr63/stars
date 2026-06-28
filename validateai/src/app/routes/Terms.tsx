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

export function Terms() {
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
            <Pill>Chile</Pill>
            <Pill>Análisis asistido por IA</Pill>
            <span className="text-xs text-gray-400 dark:text-[#afaebb]">Última actualización: {lastUpdated}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Términos y Condiciones
          </h1>
          <p className="text-base text-gray-500 dark:text-[#8B8AA0] max-w-2xl">
            Estos términos regulan el uso de Validus. Al crear una cuenta o usar la plataforma, aceptas estas condiciones. Léelas con atención: explican qué es y qué no es el servicio.
          </p>
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-[#12111A] rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-6 sm:p-10">

          <Section title="1. Aceptación de los términos">
            <p>
              Validus es un servicio operado por <strong className="text-gray-900 dark:text-[#F0EFF8]">ScoutTech SpA</strong> ("Scouttech", "nosotros"), empresa constituida conforme a las leyes de la República de Chile. Al acceder o utilizar la plataforma, declaras haber leído, entendido y aceptado estos Términos y Condiciones, así como la{' '}
              <Link to="/privacy-policy" className="text-[#0EB5C6] hover:underline">Política de Privacidad</Link>{' '}y la{' '}
              <Link to="/ai-policy" className="text-[#0EB5C6] hover:underline">Política de Uso de IA</Link>.
            </p>
            <p>Si no estás de acuerdo con estos términos, no debes utilizar el servicio.</p>
          </Section>

          <Section title="2. Descripción del servicio">
            <p>
              Validus es una plataforma de <strong className="text-gray-900 dark:text-[#F0EFF8]">análisis asistido por inteligencia artificial</strong> orientada a ayudar a fundadores, startups y equipos de innovación a estructurar, validar y preparar sus ideas de negocio antes de tomar decisiones estratégicas o levantar inversión.
            </p>
            <p>
              El servicio genera, a partir de la información que ingresas, un score de validación, análisis de mercado, competencia, unit economics, perfil de cliente, recomendaciones y otros entregables, según el plan contratado.
            </p>
          </Section>

          <Section title="3. Naturaleza del servicio y ausencia de asesoría profesional">
            <p>
              <strong className="text-gray-900 dark:text-[#F0EFF8]">Validus entrega análisis y recomendaciones de carácter informativo y orientativo.</strong> Los resultados <strong className="text-gray-900 dark:text-[#F0EFF8]">no constituyen asesoría legal, financiera, contable, tributaria ni de inversión</strong>, ni reemplazan el criterio de un profesional habilitado.
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Eres responsable de validar de forma independiente la información antes de tomar cualquier decisión.</li>
              <li>Algunos resultados pueden basarse en supuestos, inferencias o en los datos que tú mismo proporcionas, y pueden contener errores o imprecisiones.</li>
              <li>Validus no verifica de forma exhaustiva la veracidad de los datos que ingresas.</li>
            </ul>
            <p>
              Para decisiones legales, financieras o de inversión relevantes, debes consultar a un asesor profesional independiente.
            </p>
          </Section>

          <Section title="4. Datos demo o simulados">
            <p>
              En ciertas secciones, y cuando una fuente externa de datos no esté disponible o estés explorando el producto, Validus puede mostrar <strong className="text-gray-900 dark:text-[#F0EFF8]">datos de ejemplo, demostrativos o simulados</strong>. Estos contenidos se identifican explícitamente como tales y <strong className="text-gray-900 dark:text-[#F0EFF8]">no representan evidencia real de mercado</strong>. No debes tomar decisiones basándote en datos etiquetados como demo o simulados.
            </p>
          </Section>

          <Section title="5. Sin garantía de resultados">
            <p>
              Validus es una herramienta de apoyo a la decisión. <strong className="text-gray-900 dark:text-[#F0EFF8]">No garantizamos</strong> que el uso de la plataforma resulte en el levantamiento de inversión, la aprobación por aceleradoras o fondos, el éxito comercial de tu startup, ni la obtención de cualquier resultado de negocio específico.
            </p>
            <p>
              El score y los análisis reflejan una evaluación estructurada, no una predicción garantizada del desempeño futuro.
            </p>
          </Section>

          <Section title="6. Cuentas de usuario">
            <p>
              Para usar el servicio debes crear una cuenta con información veraz y mantenerla actualizada. Eres responsable de la confidencialidad de tus credenciales y de toda actividad realizada bajo tu cuenta. Debes ser mayor de 18 años.
            </p>
            <p>
              Notifícanos de inmediato ante cualquier uso no autorizado de tu cuenta.
            </p>
          </Section>

          <Section title="7. Planes, pagos y suscripciones">
            <p>
              Validus ofrece un plan gratuito y planes pagos (por ejemplo, Basic, Pro y Premium) con distintas funcionalidades y límites de uso. Los precios y características vigentes se publican en la{' '}
              <Link to="/pricing" className="text-[#0EB5C6] hover:underline">página de precios</Link>.
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Los pagos se procesan a través de proveedores externos de pago; Validus no almacena los datos completos de tu medio de pago.</li>
              <li>Las suscripciones pueden renovarse según el ciclo contratado, y puedes cancelarlas conforme a las condiciones indicadas al momento de la compra.</li>
              <li>Podemos modificar precios y planes notificándolo con antelación razonable.</li>
            </ul>
          </Section>

          <Section title="8. Uso aceptable">
            <p>Te comprometes a no utilizar Validus para:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Actividades ilegales, fraudulentas o que infrinjan derechos de terceros.</li>
              <li>Ingresar datos de terceros sin autorización o información que no tengas derecho a usar.</li>
              <li>Intentar vulnerar la seguridad de la plataforma, realizar ingeniería inversa, scraping masivo o sobrecargar el servicio.</li>
              <li>Revender o redistribuir el servicio sin autorización expresa.</li>
            </ul>
          </Section>

          <Section title="9. Propiedad intelectual">
            <p>
              <strong className="text-gray-900 dark:text-[#F0EFF8]">Tu contenido es tuyo.</strong> Conservas la titularidad de las ideas de negocio y la información que ingresas. Nos otorgas una licencia limitada para procesar ese contenido con el único fin de prestarte el servicio.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-[#F0EFF8]">La plataforma es nuestra.</strong> El software, la marca Validus, el diseño, la metodología de scoring y los demás elementos de la plataforma son propiedad de ScoutTech SpA y están protegidos por la legislación de propiedad intelectual aplicable.
            </p>
          </Section>

          <Section title="10. Disponibilidad y limitación de responsabilidad">
            <p>
              El servicio se ofrece "tal cual" y "según disponibilidad". No garantizamos que esté libre de interrupciones o errores. En la máxima medida permitida por la ley, ScoutTech SpA no será responsable por daños indirectos, lucro cesante, pérdida de oportunidades de negocio ni por decisiones tomadas con base en los resultados de la plataforma.
            </p>
          </Section>

          <Section title="11. Suspensión y terminación">
            <p>
              Puedes dejar de usar el servicio y eliminar tu cuenta en cualquier momento. Podemos suspender o terminar el acceso ante incumplimientos de estos términos, notificándolo cuando sea posible. Las disposiciones que por su naturaleza deban subsistir (propiedad intelectual, limitación de responsabilidad) seguirán vigentes tras la terminación.
            </p>
          </Section>

          <Section title="12. Cambios a estos términos">
            <p>
              Podemos actualizar estos Términos y Condiciones ocasionalmente. Notificaremos los cambios sustanciales mediante un aviso visible en la plataforma o por correo electrónico. El uso continuado del servicio tras la entrada en vigor de los cambios implica su aceptación.
            </p>
          </Section>

          <Section title="13. Ley aplicable y jurisdicción">
            <p>
              Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los tribunales competentes de Santiago de Chile, sin perjuicio de los derechos que la ley reconoce a los consumidores.
            </p>
          </Section>

          <Section title="14. Contacto">
            <p>
              Para consultas sobre estos términos, escríbenos a{' '}
              <a href="mailto:contacto@validus.scouttech.lat" className="text-[#0EB5C6] hover:underline">
                contacto@validus.scouttech.lat
              </a>.
            </p>
          </Section>

          {/* Footer note */}
          <div className="mt-10 pt-6 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-[#afaebb]">
              Documento informativo. No sustituye asesoría legal profesional.
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
            <Link to="/ai-policy" className="text-xs text-gray-400 dark:text-[#afaebb] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">
              Uso de IA
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
