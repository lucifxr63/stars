interface Props {
  title: string;
  description: string;
  requiredTier: 'basic' | 'pro' | 'premium';
  /** Hint que aparece en el tooltip sobre qué contendría esta sección */
  hint?: string;
}

const TIER_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  basic:   { label: 'Basic',   color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  pro:     { label: 'Pro',     color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  premium: { label: 'Premium', color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200'  },
};

export function LockedSection({ title, description, requiredTier, hint }: Props) {
  const tc = TIER_LABELS[requiredTier] ?? TIER_LABELS.pro;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
      {/* Contenido difuminado */}
      <div className="filter blur-[3px] pointer-events-none select-none p-5 opacity-50" aria-hidden="true">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="h-16 bg-gray-200 rounded-xl" />
          <div className="h-16 bg-gray-200 rounded-xl" />
          <div className="h-16 bg-gray-200 rounded-xl" />
          <div className="h-16 bg-gray-200 rounded-xl" />
        </div>
      </div>

      {/* Overlay de bloqueo */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-white/70 backdrop-blur-[1px]">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${tc.bg} border-2 ${tc.border}`}>
          <svg className={`w-6 h-6 ${tc.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-500 mb-3 max-w-xs leading-snug">{description}</p>

        {hint && (
          <p className="text-xs text-gray-400 italic mb-4 max-w-xs leading-snug">"{hint}"</p>
        )}

        <a
          href="/pricing"
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all
            ${tc.bg} ${tc.color} ${tc.border} border-2 hover:opacity-80 active:scale-[0.98]`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
          </svg>
          Desbloquear con plan {tc.label}
        </a>
      </div>
    </div>
  );
}
