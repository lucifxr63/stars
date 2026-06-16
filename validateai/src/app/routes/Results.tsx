import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useTrainingData } from '@/hooks/useTrainingData';
import { useUserTier } from '@/hooks/useUserTier';
import { AggregateRadarChart } from '@/components/shared/AggregateRadarChart';
import { IdeationTrendLine } from '@/components/shared/IdeationTrendLine';
import { UsageGauge } from '@/components/shared/UsageGauge';

const TIER_LIMITS: Record<string, number> = {
  free: 5, basic: 20, pro: 50, premium: 200,
};

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
  score_breakdown?: Record<string, unknown> | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed:   { label: 'Completada',  className: 'bg-green-500/10 text-green-500 border border-green-500/20' },
  in_progress: { label: 'En progreso', className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20'   },
  archived:    { label: 'Archivada',   className: 'bg-gray-500/10 text-gray-400 border border-gray-500/20'   },
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
    ? 'bg-green-500 border-green-400/30 shadow-lg shadow-green-500/20'
    : isMid
    ? 'bg-amber-500 border-amber-400/30 shadow-lg shadow-amber-500/20'
    : 'bg-red-500 border-red-400/30 shadow-lg shadow-red-500/20';

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
  const { tier } = useUserTier();
  const [validations, setValidations] = useState<ValidationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [pivotTarget, setPivotTarget] = useState<ValidationRow | null>(null);
  const [pivotReason, setPivotReason] = useState('');
  const [pivoting, setPivoting] = useState(false);

  // Métricas del gauge calculadas sobre los últimos 30 días
  const usedThisCycle = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return validations.filter((v) => new Date(v.created_at) >= cutoff).length;
  }, [validations]);

  const tierLimit = TIER_LIMITS[tier] ?? 5;
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('validations')
        .select('id, idea_name, idea_industry, status, validation_score, current_step, created_at, completed_at, parent_id, version, pivot_reason, validation_mode, score_breakdown')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        toast.error('No se pudieron cargar tus validaciones.');
      } else {
        setValidations((data as ValidationRow[]) ?? []);
      }

      // Cargar consentimiento
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
    store.reset();
    store.setValidationId(v.id);
    store.setStep(v.current_step);
    if (v.validation_mode) store.setValidationMode(v.validation_mode);
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
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
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

        {/* ── Dashboard analítico Bento Box ─────────────────────────────── */}
        {loading ? (
          /* Skeleton */
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_172px] gap-3 mb-8">
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 animate-pulse h-64" />
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 animate-pulse h-64" />
            <div className="sm:col-span-2 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 animate-pulse h-40" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_172px] gap-3 mb-8">
            {/* Radar — portafolio promedio (siempre visible, muestra empty state si no hay datos) */}
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400 dark:text-[#8B8AA0] uppercase tracking-widest">
                  Perfil de fundador
                </p>
                <BarChart2 className="w-3.5 h-3.5 text-gray-300 dark:text-white/20" />
              </div>
              <div className="flex-1 min-h-[220px]">
                <AggregateRadarChart validations={validations} />
              </div>
            </div>

            {/* Gauge — consumo de cuota */}
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold text-gray-400 dark:text-[#8B8AA0] uppercase tracking-widest">
                Cuota mensual
              </p>
              <div className="flex-1 flex items-center justify-center">
                <UsageGauge used={usedThisCycle} limit={tierLimit} tierLabel={tierLabel} />
              </div>
            </div>

            {/* Trend Line — cadencia de ideación */}
            <div className="sm:col-span-2 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold text-gray-400 dark:text-[#8B8AA0] uppercase tracking-widest">
                Actividad de ideación
              </p>
              <div className="h-40">
                <IdeationTrendLine validations={validations} />
              </div>
            </div>
          </div>
        )}

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
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">En progreso</p>
              <span className="text-xs text-gray-600 font-medium">{inProgress.length}</span>
            </div>
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
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Completadas</p>
              <span className="text-xs text-gray-600 font-medium">{completed.length}</span>
            </div>
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
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
              </svg>
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
      className={`group bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-4 sm:p-5
                  shadow-sm hover:shadow-lg hover:border-gray-200 dark:hover:border-white/[0.12]
                  transition-all duration-200 flex items-center gap-4
                  ${v.status === 'completed' ? 'cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02]' : ''}`}
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
            <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded-full border border-yellow-500/20 font-semibold">
              Rápido
            </span>
          )}
          {v.parent_id && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Pivot v{v.version ?? 2}
            </span>
          )}
          {v.idea_industry && (
            <span className="text-xs text-gray-400 dark:text-gray-500 capitalize hidden sm:inline">{v.idea_industry}</span>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(v.created_at).toLocaleDateString('es-CL', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
          {v.status === 'in_progress' && (
            <span className="ml-2 text-blue-400 font-medium">· Paso {v.current_step} de 6</span>
          )}
          {v.pivot_reason && (
            <span className="ml-2 text-amber-500/80 truncate hidden sm:inline">· {v.pivot_reason}</span>
          )}
        </p>
      </div>

      {v.status === 'in_progress' ? (
        <button
          onClick={(e) => { e.stopPropagation(); onContinue(v); }}
          className="px-4 py-2 bg-teal-500 text-white text-xs font-bold rounded-xl cursor-pointer
                     hover:bg-teal-600 active:scale-[0.97] transition-all shrink-0
                     shadow-sm shadow-teal-500/25"
        >
          Continuar →
        </button>
      ) : (
        <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/market/${v.id}`)}
            title="Ver estudio de mercado"
            className="px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20
                       rounded-xl hover:bg-blue-500/20 transition-colors duration-150 cursor-pointer flex items-center gap-1"
          >
            <BarChart2 className="w-3 h-3" />
            Mercado
          </button>
          {onPivot && (
            <button
              onClick={() => onPivot(v)}
              title="Pivotar esta idea"
              className="px-3 py-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20
                         rounded-xl hover:bg-amber-500/20 transition-colors duration-150 cursor-pointer"
            >
              Pivotar
            </button>
          )}
          <svg className="w-4 h-4 text-gray-400 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}
