import { useMentors } from '@/hooks/useMentors';
import { MentorCard } from './MentorCard';
import { Compass, AlertCircle } from 'lucide-react';

interface Props {
  ideaDescription: string | null | undefined;
  founderGaps?: string[];
}

export function MentorRecommendations({ ideaDescription, founderGaps }: Props) {
  const { mentors, loading } = useMentors(ideaDescription);

  // Mocks para testing UI/UX si no hay mentores reales
  const displayMentors = !loading && mentors.length > 0 ? mentors : [
    {
      id: 'mock-1',
      name: '(Ejemplo) María G.',
      similarity: 0.92,
      availability: 'available',
      bio: 'Ex-CTO en startup FinTech. Experta en escalar arquitecturas AWS y construir equipos.',
      expertise: ['CTO', 'FinTech', 'AWS', 'Liderazgo'],
      session_price_clp: 45000,
      calendly_url: '#',
      linkedin_url: '#',
      photo_url: null,
    },
    {
      id: 'mock-2',
      name: '(Ejemplo) Carlos R.',
      similarity: 0.85,
      availability: 'waitlist',
      bio: 'Growth Hacker especializado en B2B SaaS. Ayudó a 3 startups a cruzar el $1M ARR.',
      expertise: ['Growth', 'B2B SaaS', 'Ventas'],
      session_price_clp: 60000,
      calendly_url: '#',
      linkedin_url: '#',
      photo_url: null,
    },
    {
      id: 'mock-3',
      name: '(Ejemplo) Andrea S.',
      similarity: 0.78,
      availability: 'unavailable',
      bio: 'Abogada experta en privacidad y regulación tecnológica en la Alianza del Pacífico.',
      expertise: ['Legal', 'Compliance', 'Fintech Law'],
      session_price_clp: null,
      calendly_url: null,
      linkedin_url: '#',
      photo_url: null,
    }
  ];

  return (
    <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute -left-12 -top-12 w-48 h-48 bg-teal-400/20 dark:bg-teal-500/10 rounded-full blur-[50px] pointer-events-none"></div>

      {/* Header */}
      <div className="relative flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 shadow-inner">
          <Compass className="w-6 h-6 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Mentores recomendados por IA</h3>
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">
            Match semántico basado en tu industria
            {founderGaps && founderGaps.length > 0 && ' y los gaps de tu perfil'}
          </p>
        </div>
      </div>

      {/* Gaps del fundador */}
      {founderGaps && founderGaps.length > 0 && (
        <div className="relative mb-6 bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">Razones del Match (Tus Gaps)</p>
          </div>
          <ul className="space-y-1.5">
            {founderGaps.slice(0, 3).map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#C4C4D4]">
                <span className="text-amber-500 shrink-0 mt-0.5">•</span>
                <span className="leading-snug">{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="relative grid sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 dark:bg-[#0A0A0F] rounded-2xl p-5 border border-gray-100 dark:border-white/5 animate-pulse">
              <div className="flex gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-800" />
                <div className="flex-1 space-y-2 mt-1">
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative grid sm:grid-cols-3 gap-4">
          {displayMentors.map((m: any) => (
            <div key={m.id} className={!mentors.length ? 'opacity-80' : ''}>
              <MentorCard mentor={m} />
            </div>
          ))}
        </div>
      )}

      {/* Nota de transparencia */}
      <div className="relative mt-5 pt-4 border-t border-gray-100 dark:border-white/5 flex justify-center">
        <p className="text-[10px] text-gray-400 dark:text-[#8B8AA0] uppercase tracking-wide font-semibold text-center max-w-lg">
          {mentors.length === 0 && !loading ? '(Modo Demo) No se encontraron mentores reales. Mostrando ejemplos visuales.' : 'Mentores seleccionados automáticamente cruzando el resumen de tu idea con nuestra base de datos de expertos.'}
        </p>
      </div>
    </div>
  );
}
