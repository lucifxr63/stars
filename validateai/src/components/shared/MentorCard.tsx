import type { MentorMatch } from '@/types/validation';
import { ExternalLink, Calendar } from 'lucide-react';

interface Props {
  mentor: MentorMatch;
}

const AVAILABILITY_CONFIG = {
  available: { label: 'Disponible', dot: 'bg-green-500 animate-pulse', text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20' },
  waitlist:  { label: 'Lista de espera', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
  unavailable:{ label: 'No disponible', dot: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10' },
};

const EXPERTISE_COLORS = [
  'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20',
  'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
  'bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-500/20',
];

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="w-12 h-12 rounded-xl object-cover shadow-sm" />;
  }
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  return (
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm border border-white/20">
      <span className="text-white font-black text-sm">{initials}</span>
    </div>
  );
}

export function MentorCard({ mentor }: Props) {
  const av = AVAILABILITY_CONFIG[mentor.availability as keyof typeof AVAILABILITY_CONFIG] || AVAILABILITY_CONFIG.unavailable;
  const matchPct = Math.round(mentor.similarity * 100);

  const bookingUrl = mentor.calendly_url ?? mentor.linkedin_url ?? null;
  const isCalendly = !!mentor.calendly_url;

  return (
    <div className="bg-white dark:bg-[#1A1A24] border border-gray-100 dark:border-white/5 rounded-2xl p-5 flex flex-col h-full hover:shadow-md transition-all group hover:border-teal-200 dark:hover:border-teal-500/30">
      {/* Header */}
      <div className="flex items-start gap-4 mb-3">
        <Avatar name={mentor.name} photoUrl={mentor.photo_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] truncate">{mentor.name}</h4>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 text-[10px] font-black tracking-wider uppercase border border-teal-200 dark:border-teal-500/20 shrink-0">
              {matchPct}% Match
            </span>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-md border ${av.bg} ${av.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${av.dot}`} />
            {av.label}
          </span>
        </div>
      </div>

      {/* Bio */}
      {mentor.bio && (
        <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-4 line-clamp-3 flex-1">{mentor.bio}</p>
      )}

      {/* Expertise chips */}
      {mentor.expertise?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5 mt-auto">
          {mentor.expertise.slice(0, 3).map((tag, i) => (
            <span
              key={tag}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${EXPERTISE_COLORS[i % EXPERTISE_COLORS.length]}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: precio + CTA */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 dark:text-[#8B8AA0] uppercase tracking-wider mb-0.5">Tarifa referencial</span>
          {mentor.session_price_clp ? (
            <span className="text-xs font-black text-gray-900 dark:text-[#F0EFF8]">
              ${mentor.session_price_clp.toLocaleString('es-CL')} <span className="text-gray-400 font-medium">CLP</span>
            </span>
          ) : (
            <span className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0]">A consultar</span>
          )}
        </div>

        {bookingUrl && mentor.availability !== 'unavailable' && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white dark:hover:bg-teal-500 dark:hover:text-white flex items-center justify-center transition-colors border border-teal-200 dark:border-teal-500/20 group-hover:border-transparent"
            title={isCalendly ? 'Agendar sesión' : 'Ver perfil'}
          >
            {isCalendly ? <Calendar className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
          </a>
        )}
      </div>
    </div>
  );
}
