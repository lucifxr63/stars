interface FlowSelectorProps {
  value: 'quick' | 'detailed'
  onChange: (mode: 'quick' | 'detailed') => void
}

const OPTIONS = [
  {
    id: 'quick' as const,
    icon: '⚡',
    title: 'Análisis rápido',
    time: '5 min',
    desc: 'Solo describe tu idea. La IA infiere el resto.',
    bullets: ['1 formulario corto', 'Resultado inmediato', 'Score + análisis esencial'],
  },
  {
    id: 'detailed' as const,
    icon: '🔍',
    title: 'Análisis completo',
    time: '10 min',
    desc: 'Más contexto, más profundidad en el resultado.',
    bullets: ['3 pasos guiados', 'Perfil de mercado y fundador', 'Análisis founder fit incluido'],
  },
]

export function FlowSelector({ value, onChange }: FlowSelectorProps) {
  return (
    <div className="mb-8">
      <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-3">¿Cómo quieres validar tu idea?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all duration-200
              ${value === opt.id
                ? 'border-[#7C6FF7] bg-[#7C6FF7]/10'
                : 'border-gray-200 dark:border-white/8 hover:border-white/20 bg-white dark:bg-white/5'
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{opt.icon}</span>
              <span className="text-xs text-gray-500 dark:text-[#8B8AA0] bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                {opt.time}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-1">{opt.title}</p>
            <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-3">{opt.desc}</p>
            <ul className="space-y-1">
              {opt.bullets.map((b) => (
                <li key={b} className="text-xs text-gray-500 dark:text-[#8B8AA0] flex items-center gap-1.5">
                  <span className={value === opt.id ? 'text-[#7C6FF7]' : 'text-gray-500 dark:text-[#8B8AA0]'}>
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  )
}
