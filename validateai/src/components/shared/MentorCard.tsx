import type { MentorMatch } from '@/types/validation';

interface Props {
  mentor: MentorMatch;
}

const AVAILABILITY_CONFIG = {
  available: { label: 'Disponible', dot: 'bg-green-400', text: 'text-green-700', bg: 'bg-green-50' },
  waitlist:  { label: 'Lista de espera', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
  unavailable:{ label: 'No disponible', dot: 'bg-gray-300', text: 'text-gray-500', bg: 'bg-gray-50' },
};

const EXPERTISE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
];

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="w-12 h-12 rounded-xl object-cover" />;
  }
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  return (
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-indigo-500 flex items-center justify-center shrink-0">
      <span className="text-white font-black text-sm">{initials}</span>
    </div>
  );
}

export function MentorCard({ mentor }: Props) {
  const av = AVAILABILITY_CONFIG[mentor.availability];
  const matchPct = Math.round(mentor.similarity * 100);

  const bookingUrl = mentor.calendly_url ?? mentor.linkedin_url ?? null;
  const bookingLabel = mentor.calendly_url ? 'Agendar sesión' : 'Ver perfil';

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 flex flex-col gap-3 hover:border-teal-200 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar name={mentor.name} photoUrl={mentor.photo_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-gray-900 truncate">{mentor.name}</h4>
            {/* Match badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold shrink-0">
              ✦ {matchPct}% match
            </span>
          </div>
          {/* Disponibilidad */}
          <span className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${av.bg} ${av.text}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${av.dot}`} />
            {av.label}
          </span>
        </div>
      </div>

      {/* Bio */}
      {mentor.bio && (
        <p className="text-xs text-gray-500 leading-snug line-clamp-3">{mentor.bio}</p>
      )}

      {/* Expertise chips */}
      {mentor.expertise?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentor.expertise.slice(0, 4).map((tag, i) => (
            <span
              key={tag}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${EXPERTISE_COLORS[i % EXPERTISE_COLORS.length]}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: precio + CTA */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        {mentor.session_price_clp ? (
          <span className="text-xs text-gray-500">
            <span className="font-bold text-gray-800">
              ${mentor.session_price_clp.toLocaleString('es-CL')}
            </span>
            {' '}CLP / sesión
          </span>
        ) : (
          <span className="text-xs text-gray-400">Precio a consultar</span>
        )}

        {bookingUrl && mentor.availability !== 'unavailable' && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                       bg-teal-500 text-white hover:bg-teal-600 active:scale-[0.98] transition-all"
          >
            {bookingLabel}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
