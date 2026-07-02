import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useTrainingData } from '@/hooks/useTrainingData';
import { useUserTier } from '@/hooks/useUserTier';
import { useUsage } from '@/hooks/useUsage';
import { AggregateRadarChart } from '@/components/shared/AggregateRadarChart';
import { IdeationTrendLine } from '@/components/shared/IdeationTrendLine';
import { UsageGauge } from '@/components/shared/UsageGauge';
import { summarizeGenerationProgress, type GenerationProgress } from '@/lib/generationProgress';

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
  generation_progress?: GenerationProgress | null;
}

// Estados de presentación derivados de datos reales (validations.status admite
// in_progress | completed | archived | partial | failed — NO existe 'draft').
// El borrador vs. generando se deriva de current_step: el wizard tiene 4 pasos y
// la generación async se dispara en el paso 4 (ver startBackgroundGeneration).
type DisplayState = 'draft' | 'generating' | 'completed' | 'partial' | 'failed' | 'archived';

const WIZARD_STEPS = 4;

function displayStateOf(v: { status: string; current_step: number }): DisplayState {
  switch (v.status) {
    case 'completed': return 'completed';
    case 'partial':   return 'partial';
    case 'failed':    return 'failed';
    case 'archived':  return 'archived';
    case 'in_progress':
    default:
      return v.current_step >= WIZARD_STEPS ? 'generating' : 'draft';
  }
}

interface StateConfig {
  label: string;
  hint: string;                 // descripción corta / acción recomendada
  className: string;            // badge
  hintClassName: string;        // color del hint inline
  viewable: boolean;            // ¿tiene un dossier abrible en /results/:id?
}

const STATE_CONFIG: Record<DisplayState, StateConfig> = {
  draft: {
    label: 'Borrador', hint: 'Continúa donde lo dejaste',
    className: 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20',
    hintClassName: 'text-blue-500 dark:text-blue-400', viewable: false,
  },
  generating: {
    label: 'Generando', hint: 'Generando análisis',
    className: 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20',
    hintClassName: 'text-blue-500 dark:text-blue-400', viewable: false,
  },
  completed: {
    label: 'Completada', hint: 'Lista para revisar',
    className: 'bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20',
    hintClassName: 'text-gray-400 dark:text-gray-500', viewable: true,
  },
  partial: {
    label: 'Parcial', hint: 'Algunas secciones no se generaron',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    hintClassName: 'text-amber-600 dark:text-amber-400', viewable: true,
  },
  failed: {
    label: 'Fallida', hint: 'Requiere reintento o nueva validación',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
    hintClassName: 'text-red-500 dark:text-red-400', viewable: false,
  },
  archived: {
    label: 'Archivada', hint: '',
    className: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
    hintClassName: 'text-gray-400 dark:text-gray-500', viewable: true,
  },
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
  // Fuente única de uso/cuota (server-authoritative). Reemplaza el conteo
  // client-side de validaciones y el TIER_LIMITS local divergentes.
  const { usage, limits } = useUsage(tier);
  const [validations, setValidations] = useState<ValidationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [pivotTarget, setPivotTarget] = useState<ValidationRow | null>(null);
  const [pivotReason, setPivotReason] = useState('');
  const [pivoting, setPivoting] = useState(false);

  // Uso/cuota desde la fuente única (useUsage): análisis del mes vs límite del plan.
  // NO es "validaciones creadas" — esa cadencia la muestran el header y el trend line.
  const analysesUsed = usage?.total ?? 0;
  const tierLimit = limits.total;
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  useEffect(() => {
    const load = async () => {
      // Filtro user_id explícito además de RLS — coherente con /dashboard. Sin él,
      // la policy "Admin can read all validations" haría que un admin viera todas.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('validations')
        .select('id, idea_name, idea_industry, status, validation_score, current_step, created_at, completed_at, parent_id, version, pivot_reason, validation_mode, score_breakdown, generation_progress')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        toast.error('No se pudieron cargar tus validaciones.');
      } else {
        setValidations((data as ValidationRow[]) ?? []);
      }

      // Cargar consentimiento
      const { data: profile } = await supabase.from('profiles').select('training_consent').eq('id', user.id).single();
      if (profile) setConsent(!!profile.training_consent);

      setLoading(false);
    };
    load();
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

  // Agrupación honesta por estado real. "Necesitan atención" (parcial/fallida)
  // se separa de "En progreso" para que un fallo no parezca generando eternamente.
  const needsAttention = validations.filter((v) => v.status === 'partial' || v.status === 'failed');
  const inProgress     = validations.filter((v) => v.status === 'in_progress');
  const completed      = validations.filter((v) => v.status === 'completed');
  const archived       = validations.filter((v) => v.status === 'archived');

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
                <UsageGauge used={analysesUsed} limit={tierLimit} tierLabel={tierLabel} resetAt={usage?.reset_at} />
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

        {/* Necesitan atención — parcial + fallida (primero, para no esconder fallos) */}
        {!loading && needsAttention.length > 0 && (
          <ListSection title="Necesitan atención" dotClass="bg-amber-400" count={needsAttention.length}>
            {needsAttention.map((v) => (
              <ValidationCard key={v.id} v={v} onContinue={handleContinue} />
            ))}
          </ListSection>
        )}

        {/* En progreso — borradores y generaciones activas */}
        {!loading && inProgress.length > 0 && (
          <ListSection title="En progreso" dotClass="bg-blue-400" count={inProgress.length}>
            {inProgress.map((v) => (
              <ValidationCard key={v.id} v={v} onContinue={handleContinue} />
            ))}
          </ListSection>
        )}

        {/* Completadas */}
        {!loading && completed.length > 0 && (
          <ListSection title="Completadas" dotClass="bg-green-400" count={completed.length}>
            {completed.map((v) => (
              <ValidationCard key={v.id} v={v} onContinue={handleContinue} onPivot={setPivotTarget} />
            ))}
          </ListSection>
        )}

        {/* Archivadas */}
        {!loading && archived.length > 0 && (
          <ListSection title="Archivadas" dotClass="bg-gray-400" count={archived.length}>
            {archived.map((v) => (
              <ValidationCard key={v.id} v={v} onContinue={handleContinue} />
            ))}
          </ListSection>
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

function ListSection({
  title,
  dotClass,
  count,
  children,
}: {
  title: string;
  dotClass: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <span className="text-xs text-gray-600 font-medium">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
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
  const state = displayStateOf(v);
  const cfg = STATE_CONFIG[state];

  // Punto 4: para parcial/fallida, deriva "X de Y secciones" desde generation_progress
  // (fiable en estados terminales). Si no hay dato, cae al hint prudente del estado.
  const gen = summarizeGenerationProgress(v.generation_progress);
  let hint = cfg.hint;
  if (state === 'partial' && gen.total > 0) {
    hint = `${gen.completed} de ${gen.total} secciones completadas`;
  } else if (state === 'failed' && gen.total > 0) {
    hint = gen.failed >= gen.total ? 'Ninguna sección se generó' : `${gen.failed} de ${gen.total} secciones fallaron`;
  }

  const openResult = () => navigate(`/results/${v.id}`);
  const cardClickable = cfg.viewable;

  return (
    <div
      onClick={cardClickable ? openResult : undefined}
      className={`group bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-4 sm:p-5
                  shadow-sm hover:shadow-lg hover:border-gray-200 dark:hover:border-white/[0.12]
                  transition-all duration-200 flex items-center gap-4
                  ${cardClickable ? 'cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02]' : ''}`}
    >
      <ScoreBadge score={v.validation_score} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-bold text-gray-900 dark:text-[#F0EFF8] truncate text-sm sm:text-base">
            {v.idea_name ?? 'Sin nombre'}
          </p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.className}`}>
            {cfg.label}
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
          {state === 'draft' && (
            <span className={`ml-2 font-medium ${cfg.hintClassName}`}>· Paso {v.current_step} de {WIZARD_STEPS}</span>
          )}
          {state !== 'draft' && hint && (
            <span className={`ml-2 font-medium ${cfg.hintClassName}`}>· {hint}</span>
          )}
          {v.pivot_reason && (
            <span className="ml-2 text-amber-500/80 truncate hidden sm:inline">· {v.pivot_reason}</span>
          )}
        </p>
      </div>

      <CardActions v={v} state={state} onContinue={onContinue} onPivot={onPivot} navigate={navigate} />
    </div>
  );
}

// Acciones por estado — solo reusan flujos seguros existentes (continuar/reintentar
// vía el wizard, ver resultado, estudio de mercado, pivotar). No inventa retry/export.
function CardActions({
  v,
  state,
  onContinue,
  onPivot,
  navigate,
}: {
  v: ValidationRow;
  state: DisplayState;
  onContinue: (v: ValidationRow) => void;
  onPivot?: (v: ValidationRow) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  // Borrador → continuar el wizard donde quedó.
  if (state === 'draft') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onContinue(v); }}
        className="px-4 py-2 bg-teal-500 text-white text-xs font-bold rounded-xl cursor-pointer
                   hover:bg-teal-600 active:scale-[0.97] transition-all shrink-0 shadow-sm shadow-teal-500/25"
      >
        Continuar →
      </button>
    );
  }

  // Generando → sin acción destructiva; el estado se refleja en el badge/hint.
  if (state === 'generating') {
    return (
      <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-blue-500 dark:text-blue-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Generando…
      </span>
    );
  }

  // Fallida → reintentar reanudando el wizard (mismo flujo seguro que "Continuar").
  if (state === 'failed') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onContinue(v); }}
        className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl cursor-pointer
                   hover:bg-red-600 active:scale-[0.97] transition-all shrink-0 shadow-sm shadow-red-500/25"
      >
        Reintentar →
      </button>
    );
  }

  // Completada / Parcial / Archivada → card clickable a /results/:id + acciones extra.
  return (
    <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {state === 'completed' && (
        <button
          onClick={() => navigate(`/market/${v.id}`)}
          title="Ver estudio de mercado"
          className="px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20
                     rounded-xl hover:bg-blue-500/20 transition-colors duration-150 cursor-pointer flex items-center gap-1"
        >
          <BarChart2 className="w-3 h-3" />
          Mercado
        </button>
      )}
      {state === 'partial' && (
        <button
          onClick={() => navigate(`/results/${v.id}`)}
          className="px-3 py-1.5 text-xs font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20
                     rounded-xl hover:bg-amber-500/20 transition-colors duration-150 cursor-pointer"
        >
          Ver resultado
        </button>
      )}
      {onPivot && state === 'completed' && (
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
  );
}
