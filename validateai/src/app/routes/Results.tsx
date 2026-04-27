import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useTrainingData } from '@/hooks/useTrainingData';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface ValidationRow {
  id: string;
  idea_name: string | null;
  idea_industry: string | null;
  status: string;
  validation_score: number | null;
  current_step: number;
  created_at: string;
  completed_at: string | null;
  parent_id: string | null;
  version: number | null;
  pivot_reason: string | null;
  validation_mode?: 'quick' | 'detailed';
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completada', className: 'bg-green-100 text-green-700 border border-green-200' },
  in_progress: { label: 'En progreso', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  archived: { label: 'Archivada', className: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 flex flex-col items-center justify-center shrink-0">
        <span className="text-xs text-gray-400 text-center leading-tight font-medium">—</span>
      </div>
    );
  }
  const isGood = score >= 70;
  const isMid = score >= 40;
  const colorClass = isGood
    ? 'bg-green-500 border-green-600/20'
    : isMid
    ? 'bg-amber-500 border-amber-600/20'
    : 'bg-red-500 border-red-600/20';

  return (
    <div className={`w-14 h-14 rounded-2xl border-2 ${colorClass} flex flex-col items-center justify-center shrink-0`}>
      <span className="text-white font-black text-xl leading-none">{score}</span>
      <span className="text-white/70 text-xs font-medium">pts</span>
    </div>
  );
}

export function Results() {
  const navigate = useNavigate();
  const store = useValidationStore();
  const { updateConsent } = useTrainingData();
  const [validations, setValidations] = useState<ValidationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [pivotTarget, setPivotTarget] = useState<ValidationRow | null>(null);
  const [pivotReason, setPivotReason] = useState('');
  const [pivoting, setPivoting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('validations')
        .select('id, idea_name, idea_industry, status, validation_score, current_step, created_at, completed_at, parent_id, version, pivot_reason, validation_mode')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        toast.error('No se pudieron cargar tus validaciones.');
      } else {
        setValidations((data as ValidationRow[]) ?? []);
      }

      // Cargar consentimiento
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('training_consent').eq('id', user.id).single();
        if (profile) setConsent(!!profile.training_consent);
      }

      setLoading(false);
    };
    fetch();
  }, []);

  const handleConsentToggle = async (val: boolean) => {
    setConsent(val);
    await updateConsent(val);
    if (val) toast.success('¡Gracias por contribuir al ecosistema!');
  };

  const handleContinue = (v: ValidationRow) => {
    store.setValidationId(v.id);
    store.setStep(v.current_step);
    navigate('/validate');
  };

  const handlePivot = async () => {
    if (!pivotTarget || !pivotReason.trim()) return;
    setPivoting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const nextVersion = (pivotTarget.version ?? 1) + 1;
      const { data: newRow, error } = await supabase.from('validations').insert({
        user_id: user.id,
        status: 'in_progress',
        current_step: 1,
        parent_id: pivotTarget.id,
        version: nextVersion,
        pivot_reason: pivotReason.trim(),
      }).select('id, current_step').single();
      if (error || !newRow) { toast.error('No se pudo crear el pivot.'); return; }
      store.reset();
      store.setValidationId(newRow.id);
      store.setStep(1);
      navigate('/validate');
    } finally {
      setPivoting(false);
      setPivotTarget(null);
      setPivotReason('');
    }
  };

  const completed = validations.filter((v) => v.status === 'completed');
  const inProgress = validations.filter((v) => v.status !== 'completed');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">
      <Header />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">Mis validaciones</h1>
            <p className="text-sm text-gray-400 mt-1">
              {loading ? '...' : `${validations.length} idea${validations.length !== 1 ? 's' : ''} analizada${validations.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            to="/validate"
            onClick={() => store.reset()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-500 text-white font-semibold
                       rounded-xl hover:bg-teal-600 active:scale-[0.98] transition-all shadow-sm
                       shadow-teal-500/25 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva validación
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && validations.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-[#F0EFF8] mb-2">Todavía no has validado ninguna idea</h3>
            <p className="text-gray-400 text-sm mb-6">Empieza ahora — el proceso toma solo 15 minutos.</p>
            <Link
              to="/validate"
              onClick={() => store.reset()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-white font-semibold
                         rounded-xl hover:bg-teal-600 transition shadow-sm shadow-teal-500/25"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Validar mi primera idea
            </Link>
          </div>
        )}

        {/* In progress */}
        {!loading && inProgress.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">En progreso</p>
            <div className="space-y-2">
              {inProgress.map((v) => (
                <ValidationCard key={v.id} v={v} onContinue={handleContinue} />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {!loading && completed.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Completadas</p>
            <div className="space-y-2">
              {completed.map((v) => (
                <ValidationCard key={v.id} v={v} onContinue={handleContinue} onPivot={setPivotTarget} />
              ))}
            </div>
          </div>
        )}

        {/* Dataset Consent Widget */}
        {!loading && (
          <div className="mt-12 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <span className="text-xl">🧠</span>
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">Mejora el ecosistema</h3>
                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed max-w-lg">
                    Permite que tus validaciones se anonimicen automáticamente para entrenar nuestros modelos enfocados en LATAM.
                    Toda información personal, marcas y datos sensibles se borran antes de guardarse.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input type="checkbox" className="sr-only peer" checked={consent} onChange={(e) => handleConsentToggle(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-[#12121A] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />

      {/* Pivot Modal */}
      {pivotTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#12121A] rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-black text-gray-900 dark:text-[#F0EFF8] text-lg mb-1">Pivotar idea</h3>
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-5">
              Vas a crear una nueva validación basada en <strong>{pivotTarget.idea_name ?? 'esta idea'}</strong>.
              Describe brevemente por qué pivotás.
            </p>
            <textarea
              value={pivotReason}
              onChange={(e) => setPivotReason(e.target.value)}
              placeholder="Ej: El segmento B2C no funciona, vamos a B2B con restaurantes..."
              rows={3}
              className="w-full border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setPivotTarget(null); setPivotReason(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#C4C4D4] font-semibold rounded-xl hover:bg-gray-50 dark:bg-[#0A0A0F] transition text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handlePivot}
                disabled={!pivotReason.trim() || pivoting}
                className="flex-1 px-4 py-2.5 bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-600 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pivoting ? 'Creando...' : 'Pivotar →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationCard({
  v,
  onContinue,
  onPivot,
}: {
  v: ValidationRow;
  onContinue: (v: ValidationRow) => void;
  onPivot?: (v: ValidationRow) => void;
}) {
  const navigate = useNavigate();
  const status = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.in_progress;

  const handleClick = () => {
    if (v.status === 'completed') navigate(`/results/${v.id}`);
  };

  return (
    <div
      onClick={v.status === 'completed' ? handleClick : undefined}
      className={`bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 sm:p-5 shadow-sm
                  hover:shadow-md hover:border-gray-200 dark:border-white/10 transition-all duration-150 flex items-center gap-4
                  ${v.status === 'completed' ? 'cursor-pointer hover:bg-gray-50 dark:bg-[#0A0A0F]/50' : ''}`}
    >
      <ScoreBadge score={v.validation_score} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-bold text-gray-900 dark:text-[#F0EFF8] truncate text-sm sm:text-base">
            {v.idea_name ?? 'Sin nombre'}
          </p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${status.className}`}>
            {status.label}
          </span>
          {v.validation_mode === 'quick' && (
            <span className="text-[10px] bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded-full border border-yellow-500/20">
              ⚡ Rápido
            </span>
          )}
          {v.parent_id && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 border border-amber-200">
              Pivot v{v.version ?? 2}
            </span>
          )}
          {v.idea_industry && (
            <span className="text-xs text-gray-400 capitalize hidden sm:inline">{v.idea_industry}</span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {new Date(v.created_at).toLocaleDateString('es-CL', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
          {v.status === 'in_progress' && (
            <span className="ml-2 text-blue-500 font-medium">· Paso {v.current_step} de 6</span>
          )}
          {v.pivot_reason && (
            <span className="ml-2 text-amber-600 truncate hidden sm:inline">· {v.pivot_reason}</span>
          )}
        </p>
      </div>

      {v.status === 'in_progress' ? (
        <button
          onClick={(e) => { e.stopPropagation(); onContinue(v); }}
          className="px-4 py-2 bg-teal-500 text-white text-xs font-bold rounded-xl
                     hover:bg-teal-600 active:scale-[0.97] transition-all shrink-0
                     shadow-sm shadow-teal-500/20"
        >
          Continuar →
        </button>
      ) : (
        <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/market/${v.id}`)}
            title="Ver estudio de mercado"
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200
                       rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-1"
          >
            <BarChart2 className="w-3 h-3" />
            Mercado
          </button>
          {onPivot && (
            <button
              onClick={() => onPivot(v)}
              title="Pivotar esta idea"
              className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200
                         rounded-xl hover:bg-amber-100 transition-colors"
            >
              Pivotar
            </button>
          )}
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
