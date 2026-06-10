import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier } from '@/hooks/useUserTier';

interface RecentValidation {
  id: string;
  idea_name: string | null;
  idea_industry: string | null;
  validation_score: number | null;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completada',
  in_progress: 'En progreso',
  archived: 'Archivada',
};

function scoreBg(score: number | null): string {
  if (score == null) return 'bg-gray-100 dark:bg-white/[0.06] text-gray-400';
  if (score >= 70) return 'bg-green-500 text-white';
  if (score >= 40) return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export function Dashboard() {
  const navigate = useNavigate();
  const reset = useValidationStore((s) => s.reset);
  const { tier } = useUserTier();
  const [userName, setUserName] = useState('');
  const [recent, setRecent] = useState<RecentValidation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const meta = user.user_metadata;
      setUserName(meta?.full_name ?? meta?.name ?? user.email?.split('@')[0] ?? '');

      const { data } = await supabase
        .from('validations')
        .select('id, idea_name, idea_industry, validation_score, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const rows = (data as RecentValidation[]) ?? [];
      setRecent(rows);
      setTotalCount(rows.length);

      const scored = rows.filter((r) => r.validation_score != null);
      if (scored.length > 0) {
        const sum = scored.reduce((acc, r) => acc + (r.validation_score ?? 0), 0);
        setAvgScore(Math.round(sum / scored.length));
      }

      setLoading(false);
    }
    load();
  }, []);

  const firstName = userName.split(' ')[0];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-10">
      {/* Saludo */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">
          Hola, {firstName || 'Founder'} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mt-1">
          Bienvenido a tu panel de validación de ideas.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          {
            label: 'Ideas analizadas',
            value: loading ? '—' : String(totalCount),
          },
          {
            label: 'Score promedio',
            value: loading ? '—' : avgScore != null ? `${avgScore} pts` : '—',
          },
          {
            label: 'Plan activo',
            value: tier.charAt(0).toUpperCase() + tier.slice(1),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-4 py-4"
          >
            <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-1 leading-tight">{stat.label}</p>
            <p className="text-xl font-black text-gray-900 dark:text-[#F0EFF8] tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* CTA principal */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0EB5C6] to-[#5B52C5] rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="flex-1 relative">
          <h2 className="text-lg font-bold text-white mb-1">Generar nueva validación</h2>
          <p className="text-[#C4B5FD] text-sm leading-relaxed">
            Valida tu próxima idea con IA en menos de 10 minutos.
          </p>
        </div>
        <button
          onClick={() => { reset(); navigate('/validate'); }}
          className="shrink-0 px-6 py-3 bg-white text-[#0EB5C6] font-bold rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all text-sm shadow-lg relative"
        >
          Comenzar →
        </button>
      </div>

      {/* Últimas validaciones */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">
            Últimas validaciones
          </h2>
          <Link to="/results" className="text-xs text-[#0EB5C6] hover:underline font-medium">
            Ver todas →
          </Link>
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[68px] bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && recent.length === 0 && (
          <div className="text-center py-14 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06]">
            <div className="w-12 h-12 rounded-2xl bg-[#0EB5C6]/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#0EB5C6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-1">
              Todavía no has validado ninguna idea
            </p>
            <p className="text-xs text-gray-400 dark:text-[#8B8AA0] mb-5">
              El proceso completo toma menos de 15 minutos.
            </p>
            <button
              onClick={() => { reset(); navigate('/validate'); }}
              className="px-5 py-2.5 bg-[#0EB5C6] text-white text-sm font-semibold rounded-xl hover:bg-[#6B5EE6] transition-colors"
            >
              Validar mi primera idea
            </button>
          </div>
        )}

        {!loading && recent.length > 0 && (
          <div className="space-y-2">
            {recent.map((v) => (
              <Link
                key={v.id}
                to={`/results/${v.id}`}
                className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] hover:border-[#0EB5C6]/30 dark:hover:border-[#0EB5C6]/30 transition-all group"
              >
                {/* Score badge */}
                <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 text-xs font-black ${scoreBg(v.validation_score)}`}>
                  {v.validation_score ?? '—'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] truncate group-hover:text-[#0EB5C6] transition-colors">
                    {v.idea_name ?? 'Sin nombre'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-[#afaebb] mt-0.5 truncate">
                    {[v.idea_industry, STATUS_LABEL[v.status]].filter(Boolean).join(' · ')}
                  </p>
                </div>

                {/* Date + arrow */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400 dark:text-[#afaebb] hidden sm:block">
                    {formatDate(v.created_at)}
                  </span>
                  <svg className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-[#0EB5C6] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
