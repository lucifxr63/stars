import { Link } from 'react-router-dom';
import type { ValidationVersion } from '@/types/validation';

interface Props {
  versions: ValidationVersion[];
  currentId: string;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-300">–</span>;
  const color =
    score >= 70 ? 'bg-green-100 text-green-700'
    : score >= 40 ? 'bg-amber-100 text-amber-700'
    :               'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-sm ${color}`}>
      {score}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const positive = delta > 0;
  const neutral  = delta === 0;
  return (
    <span className={`text-xs font-bold ${neutral ? 'text-gray-400' : positive ? 'text-green-600' : 'text-red-500'}`}>
      {neutral ? '=' : positive ? `+${delta}` : delta}
    </span>
  );
}

export function VersionTimeline({ versions, currentId }: Props) {
  if (versions.length === 0) return null;

  return (
    <div className="space-y-3">
      {versions.map((v, idx) => {
        const prev  = idx > 0 ? versions[idx - 1] : null;
        const delta = prev?.validation_score != null && v.validation_score != null
          ? v.validation_score - prev.validation_score
          : null;
        const isCurrent = v.id === currentId;
        const isCompleted = !!v.completed_at;

        return (
          <div key={v.id} className="flex items-start gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mt-1 shrink-0 border-2 ${
                isCurrent ? 'bg-teal-500 border-teal-500' : isCompleted ? 'bg-gray-300 border-gray-300' : 'bg-white dark:bg-[#12121A] border-gray-300'
              }`} />
              {idx < versions.length - 1 && (
                <div className="w-0.5 h-full min-h-[2rem] bg-gray-100 dark:bg-white/5 mt-1" />
              )}
            </div>

            {/* Card */}
            <div className={`flex-1 rounded-2xl border-2 p-3 transition-all ${
              isCurrent ? 'border-teal-300 bg-teal-50' : 'border-gray-100 bg-white dark:bg-[#12121A] hover:border-gray-200 dark:border-white/10'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Versión badge */}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isCurrent ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-500 dark:text-[#8B8AA0]'
                    }`}>
                      v{v.version}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-teal-600">Actual</span>
                    )}
                    {!isCompleted && !isCurrent && (
                      <span className="text-[10px] text-gray-400">En progreso</span>
                    )}
                  </div>

                  {/* Nombre de la idea */}
                  <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFF8] truncate">
                    {v.idea_name ?? 'Sin nombre'}
                  </p>

                  {/* Razón del pivote */}
                  {v.pivot_reason && (
                    <p className="text-xs text-gray-400 mt-1 leading-snug line-clamp-2 italic">
                      "{v.pivot_reason}"
                    </p>
                  )}

                  {/* Fecha */}
                  <p className="text-[10px] text-gray-300 mt-1">
                    {new Date(v.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* Score + delta */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <ScoreBadge score={v.validation_score} />
                  <DeltaBadge delta={delta} />
                </div>
              </div>

              {/* Link al reporte completo (si no es el actual) */}
              {!isCurrent && isCompleted && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5">
                  <Link
                    to={`/results/${v.id}`}
                    className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    Ver reporte completo
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
