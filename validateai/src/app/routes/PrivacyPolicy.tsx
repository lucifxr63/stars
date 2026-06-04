import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

function Logo({ className = 'w-6 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} aria-label="Validus" role="img">
      <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white"/>
      <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6"/>
      <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6"/>
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

export function PrivacyPolicy() {
  const lastUpdated = '2 de junio de 2026';

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
            <Pill>Ley 21.719</Pill>
            <Pill>GDPR-aligned</Pill>
            <span className="text-xs text-gray-400 dark:text-[#4A495E]">Última actualización: {lastUpdated}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Política de Privacidad
          </h1>
          <p className="text-base text-gray-500 dark:text-[#8B8AA0] max-w-2xl">
            En Validus valoramos tu privacidad. Esta política explica cómo recopilamos, usamos y protegemos tu información personal conforme a la legislación chilena vigente.
          </p>
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-[#12111A] rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-6 sm:p-10">

          <Section title="1. Responsable del tratamiento">
            <p>
              El responsable del tratamiento de tus datos personales es <strong className="text-gray-900 dark:text-[#F0EFF8]">ScoutTech SpA</strong>, empresa constituida conforme a las leyes de la República de Chile, con domicilio en Santiago de Chile.
            </p>
            <p>
              Puedes contactarnos en cualquier momento a través de:{' '}
              <a href="mailto:contacto@validus.scouttech.lat" className="text-[#0EB5C6] hover:underline">
                contacto@validus.scouttech.lat
              </a>
            </p>
          </Section>

          <Section title="2. Datos que recopilamos">
            <p>Recopilamos únicamente los datos necesarios para prestarte el servicio:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Datos de cuenta:</strong> nombre, dirección de correo electrónico y, opcionalmente, foto de perfil (provistos por Google OAuth o registro directo).</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Datos del perfil del fundador:</strong> experiencia, industria, habilidades y LinkedIn URL (opcionales, ingresados por ti voluntariamente).</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Datos de la idea de negocio:</strong> nombre, descripción, mercado objetivo y modelo de negocio que ingresas en el wizard de validación.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Datos de uso:</strong> páginas visitadas, interacciones con la plataforma y eventos de analítica (ver sección 5).</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Datos técnicos:</strong> dirección IP truncada (últimos 8 bits eliminados), tipo de dispositivo y navegador.</li>
            </ul>
            <p className="mt-2">
              <strong className="text-gray-900 dark:text-[#F0EFF8]">No recopilamos</strong> RUT ni documentos de identidad, datos de tarjetas de crédito (procesados exclusivamente por Stripe), ni datos sensibles según el artículo 2 de la Ley 21.719.
            </p>
          </Section>

          <Section title="3. Finalidad del tratamiento">
            <p>Usamos tus datos para las siguientes finalidades:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Crear y gestionar tu cuenta de usuario.</li>
              <li>Ejecutar el análisis de validación de tu idea mediante inteligencia artificial.</li>
              <li>Mejorar la calidad del servicio con datos anonimizados y agregados.</li>
              <li>Enviarte comunicaciones relacionadas con el servicio (cambios de plan, estado de análisis).</li>
              <li>Cumplir con obligaciones legales aplicables en Chile.</li>
            </ul>
          </Section>

          <Section title="4. Base legal del tratamiento">
            <p>
              El tratamiento de tus datos se basa en las siguientes bases legales conforme a la Ley 21.719 de Protección de Datos Personales de Chile:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Consentimiento:</strong> otorgado al crear tu cuenta y aceptar esta política.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Ejecución de contrato:</strong> tratamiento necesario para prestarte el servicio contratado.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Interés legítimo:</strong> para analítica de uso y mejora del servicio, siempre con datos anonimizados.</li>
            </ul>
          </Section>

          <Section title="5. Analítica y cookies">
            <p>
              Utilizamos <strong className="text-gray-900 dark:text-[#F0EFF8]">PostHog</strong> para analítica de producto. PostHog registra eventos de interacción (p. ej. pasos completados en el wizard, funciones usadas) de forma seudonimizada. No vendemos estos datos ni los usamos para publicidad dirigida.
            </p>
            <p>
              Usamos cookies estrictamente necesarias para la autenticación (sesión de Supabase) y de preferencias (tema claro/oscuro). No usamos cookies de seguimiento de terceros para publicidad.
            </p>
            <p>
              Puedes desactivar las cookies no esenciales desde la configuración de tu navegador, aunque esto puede afectar el funcionamiento de la plataforma.
            </p>
          </Section>

          <Section title="6. Inteligencia Artificial y procesamiento de ideas">
            <p>
              Las ideas de negocio que ingresas son procesadas por modelos de IA de <strong className="text-gray-900 dark:text-[#F0EFF8]">Anthropic</strong> (Claude) a través de su API. Anthropic procesa estos datos únicamente para generar la respuesta solicitada y conforme a su propia política de privacidad y acuerdos de uso de la API empresarial.
            </p>
            <p>
              Con tu consentimiento explícito, podemos almacenar una versión <strong className="text-gray-900 dark:text-[#F0EFF8]">anonimizada</strong> de tu idea (sin datos identificatorios) en nuestra base de datos de entrenamiento para mejorar el modelo. Puedes revocar este consentimiento en cualquier momento desde tu perfil.
            </p>
            <p>
              Nunca compartimos tus ideas de negocio con otros usuarios ni con terceros sin tu consentimiento.
            </p>
          </Section>

          <Section title="7. Proveedores de servicios (sub-encargados)">
            <p>Para operar la plataforma utilizamos los siguientes proveedores, todos bajo acuerdos de tratamiento de datos adecuados:</p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-[#F0EFF8]">Proveedor</th>
                    <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-[#F0EFF8]">Uso</th>
                    <th className="text-left py-2 font-semibold text-gray-900 dark:text-[#F0EFF8]">Ubicación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {[
                    ['Supabase', 'Base de datos, autenticación, almacenamiento', 'EE.UU. / UE'],
                    ['Vercel', 'Hosting y CDN del frontend', 'EE.UU. / Global'],
                    ['Anthropic', 'Procesamiento IA (Claude)', 'EE.UU.'],
                    ['Stripe', 'Procesamiento de pagos', 'EE.UU.'],
                    ['PostHog', 'Analítica de producto', 'UE / EE.UU.'],
                    ['Resend', 'Envío de correos transaccionales', 'EE.UU.'],
                  ].map(([provider, use, location]) => (
                    <tr key={provider}>
                      <td className="py-2 pr-4 font-medium text-gray-900 dark:text-[#F0EFF8]">{provider}</td>
                      <td className="py-2 pr-4">{use}</td>
                      <td className="py-2">{location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="8. Transferencias internacionales de datos">
            <p>
              Algunos de nuestros proveedores procesan datos fuera de Chile. En todos los casos exigimos que cuenten con medidas de seguridad equivalentes a las establecidas por la Ley 21.719, incluyendo cláusulas contractuales tipo y certificaciones de cumplimiento.
            </p>
          </Section>

          <Section title="9. Conservación de datos">
            <p>
              Conservamos tus datos mientras mantengas una cuenta activa en la plataforma. Si eliminas tu cuenta, tus datos personales serán eliminados dentro de los <strong className="text-gray-900 dark:text-[#F0EFF8]">30 días hábiles</strong> siguientes a la solicitud, salvo que la ley exija conservarlos por un período mayor.
            </p>
            <p>
              Los datos anonimizados y agregados (sin posibilidad de reidentificación) pueden conservarse indefinidamente para fines estadísticos y de mejora del servicio.
            </p>
          </Section>

          <Section title="10. Tus derechos (ARCO+)">
            <p>
              Conforme a la Ley 21.719, tienes los siguientes derechos sobre tus datos personales:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Acceso:</strong> solicitar una copia de los datos que tenemos sobre ti.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Cancelación / Eliminación:</strong> solicitar que eliminemos tus datos.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Oposición:</strong> oponerte a ciertos tratamientos, como la analítica de uso.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Portabilidad:</strong> recibir tus datos en un formato estructurado y legible por máquina.</li>
              <li><strong className="text-gray-900 dark:text-[#F0EFF8]">Revocación del consentimiento:</strong> retirar tu consentimiento en cualquier momento sin afectar la licitud del tratamiento previo.</li>
            </ul>
            <p>
              Para ejercer cualquiera de estos derechos, escríbenos a{' '}
              <a href="mailto:contacto@validus.scouttech.lat" className="text-[#0EB5C6] hover:underline">
                contacto@validus.scouttech.lat
              </a>{' '}
              indicando tu nombre, el derecho que deseas ejercer y, si aplica, los datos concretos a los que se refiere tu solicitud. Responderemos dentro de los plazos establecidos por la ley.
            </p>
          </Section>

          <Section title="11. Seguridad de los datos">
            <p>
              Implementamos medidas técnicas y organizativas para proteger tus datos, incluyendo:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Cifrado en tránsito (TLS 1.2+) y en reposo.</li>
              <li>Control de acceso basado en roles (RLS) en la base de datos.</li>
              <li>Truncación de IPs (eliminamos los últimos 8 bits antes de almacenar).</li>
              <li>Tokens de sesión con expiración automática.</li>
              <li>Auditoría de accesos a datos sensibles.</li>
            </ul>
            <p>
              En caso de brecha de seguridad que afecte tus datos, te notificaremos dentro del plazo legal aplicable.
            </p>
          </Section>

          <Section title="12. Menores de edad">
            <p>
              Validus está dirigido a personas mayores de 18 años. No recopilamos intencionalmente datos de menores. Si crees que un menor ha proporcionado sus datos, contáctanos para eliminarlos.
            </p>
          </Section>

          <Section title="13. Cambios a esta política">
            <p>
              Podemos actualizar esta política ocasionalmente. Te notificaremos por correo electrónico y mediante un aviso visible en la plataforma si realizamos cambios sustanciales. La fecha de última actualización aparece al inicio de este documento.
            </p>
          </Section>

          <Section title="14. Reclamaciones">
            <p>
              Si consideras que el tratamiento de tus datos no cumple con la normativa vigente, puedes presentar una reclamación ante la{' '}
              <strong className="text-gray-900 dark:text-[#F0EFF8]">Agencia de Protección de Datos Personales de Chile</strong>{' '}
              una vez que ésta esté operativa, o ante los tribunales de justicia competentes.
            </p>
          </Section>

          {/* Footer note */}
          <div className="mt-10 pt-6 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-[#4A495E]">
              Esta política fue redactada conforme a la <strong>Ley 21.719</strong> de Protección de Datos Personales de Chile.
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
          <p className="text-xs text-gray-400 dark:text-[#4A495E]">
            © {new Date().getFullYear()} Validus · Hecho en Chile 🇨🇱
          </p>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xs text-gray-400 dark:text-[#4A495E] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">
              Inicio
            </Link>
            <Link to="/pricing" className="text-xs text-gray-400 dark:text-[#4A495E] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">
              Precios
            </Link>
            <a href="mailto:contacto@validus.scouttech.lat" className="text-xs text-gray-400 dark:text-[#4A495E] hover:text-[#0EB5C6] transition-colors">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
