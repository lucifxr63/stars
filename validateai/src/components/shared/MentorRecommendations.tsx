import { useMentors } from '@/hooks/useMentors';
import { MentorCard } from './MentorCard';

interface Props {
  ideaDescription: string | null | undefined;
  founderGaps?: string[];
}

export function MentorRecommendations({ ideaDescription, founderGaps }: Props) {
  const { mentors, loading } = useMentors(ideaDescription);

  // No mostrar si no hay mentores y no está cargando
  if (!loading && mentors.length === 0) return null;

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-teal-50 border-2 border-teal-200">
          <span className="text-xl">🧭</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900">Mentores recomendados</h3>
          <p className="text-xs text-gray-400">
            Seleccionados según tu industria
            {founderGaps && founderGaps.length > 0 && ' y los gaps identificados en tu perfil de fundador'}
          </p>
        </div>
      </div>

      {/* Gaps del fundador — contexto de por qué se recomiendan estos mentores */}
      {founderGaps && founderGaps.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 mb-1.5">Basado en tus gaps identificados:</p>
          <ul className="space-y-1">
            {founderGaps.slice(0, 3).map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-600">
                <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 rounded-2xl p-4 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded mb-1.5" />
              <div className="h-2 bg-gray-200 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {/* Mentor cards */}
      {!loading && mentors.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {mentors.map((m) => <MentorCard key={m.id} mentor={m} />)}
        </div>
      )}

      {/* Nota de transparencia */}
      <p className="text-[10px] text-gray-300 mt-3 text-center">
        Los mentores son seleccionados por similitud semántica entre tu idea y su área de expertise.
      </p>
    </div>
  );
}
