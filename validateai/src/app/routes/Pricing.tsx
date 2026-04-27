import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: 'Gratis',
    features: ['3 validaciones/mes', 'Score de viabilidad', 'Análisis básico'],
    cta: 'Tu plan actual',
    disabled: true,
    highlight: false,
  },
  {
    name: 'Basic',
    price: '$9.990 CLP/mes',
    features: ['10 validaciones/mes', 'Análisis competitivo', 'Market sizing', 'PDF export'],
    cta: 'Próximamente',
    disabled: true,
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$24.990 CLP/mes',
    features: [
      'Ilimitadas',
      'Todo Basic +',
      'Entregables completos',
      'Estudio de mercado Chile',
      'Mentores',
    ],
    cta: 'Próximamente',
    disabled: true,
    highlight: true,
  },
]

export function Pricing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] text-gray-900 dark:text-[#F0EFF8]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-[#8B8AA0] hover:text-gray-900 dark:text-[#F0EFF8] mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">Planes ValidateAI</h1>
          <p className="text-gray-500 dark:text-[#8B8AA0]">
            Próximamente. Por ahora todos los planes están en acceso anticipado gratuito.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col transition-all
                ${plan.highlight
                  ? 'border-2 border-[#7C6FF7] bg-[#7C6FF7]/5'
                  : 'border border-gray-200 dark:border-white/8'}`}
            >
              {plan.highlight && (
                <span className="text-xs font-semibold text-[#7C6FF7] bg-[#7C6FF7]/10
                                  px-2 py-0.5 rounded-full w-fit mb-3">
                  Popular
                </span>
              )}
              <h2 className="text-lg font-semibold mb-1">{plan.name}</h2>
              <p className="text-2xl font-bold mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-gray-500 dark:text-[#8B8AA0] flex items-center gap-2">
                    <span className="text-[#7C6FF7]">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={plan.disabled}
                className="w-full py-2 rounded-xl bg-[#7C6FF7]/20 text-[#7C6FF7] text-sm font-medium
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-[#8B8AA0] mt-8">
          ¿Tienes preguntas? Escríbenos a{' '}
          <a
            href="mailto:lucianoalonso2000@gmail.com"
            className="text-[#7C6FF7] hover:underline"
          >
            lucianoalonso2000@gmail.com
          </a>
        </p>
      </div>
    </div>
  )
}
