import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier } from '@/hooks/useUserTier';
import { useUsage } from '@/hooks/useUsage';
import { UsageBar } from '@/components/shared/UsageBar';
import { MarketSignalsWidget } from '@/components/dashboard/MarketSignalsWidget';
import { GenerationStatusWidget } from '@/components/dashboard/GenerationStatusWidget';
import { TrustSourcesPanel } from '@/components/dashboard/TrustSourcesPanel';
import { PilotProgramCard } from '@/components/dashboard/PilotProgramCard';
import { trackEvent } from '@/lib/analytics';
import { summarizeGenerationProgress, type GenerationProgress } from '@/lib/generationProgress';

interface ValidationRow {
  id: string;
  idea_name: string | null;
  idea_industry: string | null;
  validation_score: number | null;
  status: string;
  current_step: number | null;
  validation_mode: 'quick' | 'detailed' | null;
  created_at: string;
  generation_progress: GenerationProgress | null;
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completada',
  in_progress: 'En progreso',
  partial: 'Parcial',
  failed: 'Falló',
  archived: 'Archivada',
};

// Color del estado para la lista (coherente con Fase 15: partial/failed).
const STATUS_COLOR: Record<string, string> = {
  completed: 'text-emerald-600 dark:text-emerald-400',
  in_progress: 'text-[#0EB5C6] dark:text-[#38D5E3]',
  partial: 'text-amber-600 dark:text-amber-400',
  failed: 'text-red-500 dark:text-red-400',
  archived: 'text-gray-400 dark:text-[#afaebb]',
};

const WIZARD_STEPS = 4;

function scoreBg(score: number | null): string {
  if (score == null) return 'bg-gray-100 dark:bg-white/[0.06] text-gray-400';
  if (score >= 70) return 'bg-green-500 text-white';
  if (score >= 40) return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function titleOf(v: ValidationRow | null): string {
  const name = v?.idea_name?.trim();
  return name && name.length > 0 ? name : 'Validación sin título';
}

// ── Trust por validación (Punto 4) ──────────────────────────────────────────
// Señal HONESTA de profundidad/confianza derivada SOLO de datos ya persistidos
// (validation_mode). No fabrica un score de confianza — solo comunica el rigor del
// análisis. `detailed` = mayor profundidad; `quick` = orientativo; null = sin señal.
interface TrustChip { label: string; tint: string; dot: string; title: string; }
const TRUST_BY_MODE: Record<'quick' | 'detailed', TrustChip> = {
  detailed: {
    label: 'Detallado',
    tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
    title: 'Análisis en profundidad: más secciones y fuentes. Aun así es orientativo — valida lo crítico antes de decidir.',
  },
  quick: {
    label: 'Rápido',
    tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
    title: 'Análisis rápido y orientativo. Para mayor rigor, corre una validación detallada.',
  },
};
function trustChipOf(v: ValidationRow | null): TrustChip | null {
  const mode = v?.validation_mode;
  return mode ? TRUST_BY_MODE[mode] : null;
}

// Chip compacto de confianza/profundidad. Reutilizado en snapshot y lista.
function TrustBadge({ chip }: { chip: TrustChip }) {
  return (
    <span
      title={chip.title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold leading-none ${chip.tint}`}
    >
      <span className={`w-1 h-1 rounded-full ${chip.dot}`} aria-hidden="true" />
      {chip.label}
    </span>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const reset = useValidationStore((s) => s.reset);
  const setValidationId = useValidationStore((s) => s.setValidationId);
  const setStep = useValidationStore((s) => s.setStep);
  const setValidationMode = useValidationStore((s) => s.setValidationMode);
  const { tier } = useUserTier();
  // Uso/cuota desde la fuente única (useUsage), idéntico al Sidebar.
  const { usage, limits, remaining } = useUsage(tier);
  const isUnlimited = tier === 'pro' || tier === 'premium' || tier === 'admin';
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const [userName, setUserName] = useState('');
  const [all, setAll] = useState<ValidationRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch puro (sin setState) para que el setState viva en `.then` (lint-clean,
  // mismo patrón que Admin.tsx). Reutilizable: se aplica en el montaje y de nuevo
  // cuando el GenerationStatusWidget detecta que una generación terminó (Punto 6).
  const fetchDashboard = useCallback(async (): Promise<{
    userName: string; rows: ValidationRow[]; count: number; avgScore: number | null;
  } | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return null;

      const meta = user.user_metadata;
      const name = meta?.full_name ?? meta?.name ?? user.email?.split('@')[0] ?? '';

      // Una sola query: filtra user_id explícito (además de RLS — la policy
      // "Admin can read all validations" haría que un admin viera todas). De aquí
      // se derivan lista reciente, última validación, conteos por estado y promedio.
      const { data, count } = await supabase
        .from('validations')
        .select('id, idea_name, idea_industry, validation_score, status, current_step, validation_mode, created_at, generation_progress', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      const rows = (data as ValidationRow[]) ?? [];
      const scored = rows.filter((r) => r.validation_score != null);
      const avg = scored.length > 0
        ? Math.round(scored.reduce((acc, r) => acc + (r.validation_score ?? 0), 0) / scored.length)
        : null;
      return { userName: name, rows, count: count ?? rows.length, avgScore: avg };
    } catch (err) {
      console.warn('[Dashboard] load error:', err);
      return null;
    }
  }, []);

  // Aplica el resultado del fetch. No toca `loading` salvo apagarlo → el refresh
  // post-generación no parpadea (skeletons solo en el montaje inicial).
  const applyDashboard = useCallback((d: Awaited<ReturnType<typeof fetchDashboard>>) => {
    if (d) {
      setUserName(d.userName);
      setAll(d.rows);
      setTotalCount(d.count);
      setAvgScore(d.avgScore);
    }
    setLoading(false);
  }, []);

  const refreshDashboard = useCallback(() => { fetchDashboard().then(applyDashboard); }, [fetchDashboard, applyDashboard]);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard().then((d) => { if (!cancelled) applyDashboard(d); });
    return () => { cancelled = true; };
  }, [fetchDashboard, applyDashboard]);

  const firstName = userName.split(' ')[0];
  const recent = all.slice(0, 5);
  const latest = all[0] ?? null;

  // Conteos por estado (salud del workspace), derivados de datos reales.
  const counts = useMemo(() => ({
    completed:  all.filter((v) => v.status === 'completed').length,
    inProgress: all.filter((v) => v.status === 'in_progress').length,
    partial:    all.filter((v) => v.status === 'partial').length,
    failed:     all.filter((v) => v.status === 'failed').length,
    archived:   all.filter((v) => v.status === 'archived').length,
  }), [all]);

  // ── Analítica PII-safe (allowlist: tier/has_validations/latest_status/total/source/target) ──
  const viewedRef = useRef(false);
  useEffect(() => {
    if (loading || viewedRef.current) return;
    viewedRef.current = true;
    trackEvent('dashboard_viewed', {
      tier,
      has_validations: all.length > 0,
      latest_status: latest?.status ?? 'none',
      total_validations: totalCount,
    });
  }, [loading, tier, all.length, latest?.status, totalCount]);

  const trackNext = (target: string) =>
    trackEvent('dashboard_next_step_clicked', {
      tier, latest_status: latest?.status ?? 'none', total_validations: totalCount, source: 'dashboard_hero', target,
    });

  // Acciones seguras (reusan el mismo flujo que /results): nueva, ver, reanudar wizard.
  const goNew = () => { trackNext('new_validation'); reset(); navigate('/validate'); };
  const goView = (id: string) => { trackNext('view_result'); navigate(`/results/${id}`); };
  const resume = (v: ValidationRow) => {
    trackNext('resume');
    reset();
    setValidationId(v.id);
    setStep(v.current_step ?? 1);
    if (v.validation_mode) setValidationMode(v.validation_mode);
    navigate('/validate');
  };

  // ── Próximo paso recomendado (derivado del estado de la última validación) ──
  interface NextStep {
    title: string;
    subtitle: string;
    primary: { label: string; onClick: () => void };
    secondary?: { label: string; onClick: () => void };
  }
  const newValidation = { label: 'Nueva validación', onClick: goNew };

  let nextStep: NextStep;
  if (!latest) {
    nextStep = {
      title: 'Crea tu primera validación',
      subtitle: 'Valida tu próxima idea con IA en menos de 10 minutos.',
      primary: { label: 'Generar nueva validación →', onClick: goNew },
    };
  } else if (latest.status === 'completed') {
    nextStep = {
      title: 'Revisa tu último resultado',
      subtitle: `“${titleOf(latest)}” está lista para revisar.`,
      primary: { label: 'Ver resultado →', onClick: () => goView(latest.id) },
      secondary: newValidation,
    };
  } else if (latest.status === 'partial') {
    const s = summarizeGenerationProgress(latest.generation_progress);
    const subtitle = s.total > 0
      ? `${s.completed} de ${s.total} secciones se generaron — puedes revisar el resultado parcial.`
      : 'Algunas secciones de tu última validación no se generaron.';
    nextStep = {
      title: 'Revisa las secciones incompletas',
      subtitle,
      primary: { label: 'Ver resultado parcial →', onClick: () => goView(latest.id) },
      secondary: newValidation,
    };
  } else if (latest.status === 'failed') {
    nextStep = {
      title: 'Tu última validación requiere atención',
      subtitle: 'La generación falló. Puedes reintentar o empezar de nuevo.',
      primary: { label: 'Reintentar o revisar →', onClick: () => resume(latest) },
      secondary: newValidation,
    };
  } else if (latest.status === 'in_progress') {
    const generating = (latest.current_step ?? 0) >= WIZARD_STEPS;
    nextStep = generating
      ? {
          title: 'Tu análisis se está generando',
          subtitle: 'Te avisamos apenas termine — puedes seguir explorando.',
          primary: newValidation,
        }
      : {
          title: 'Continúa tu validación en curso',
          subtitle: `Retoma “${titleOf(latest)}” donde la dejaste.`,
          primary: { label: 'Continuar →', onClick: () => resume(latest) },
          secondary: newValidation,
        };
  } else {
    // archived u otros: sugerir una nueva validación.
    nextStep = {
      title: 'Genera una nueva validación',
      subtitle: 'Valida tu próxima idea con IA en minutos.',
      primary: { label: 'Generar nueva validación →', onClick: goNew },
    };
  }

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

      {/* Estado de generación en curso (redirect asíncrono del wizard).
          Al terminar una generación, refresca los datos del dashboard (Punto 6). */}
      <GenerationStatusWidget onFinished={refreshDashboard} />

      {/* ── Próximo paso recomendado (hero dinámico) ─────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0EB5C6] to-[#5B52C5] rounded-2xl p-6 mb-6">
        <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1.5">
              {loading ? 'Cargando…' : 'Próximo paso'}
            </p>
            <h2 className="text-lg font-bold text-white mb-1">{nextStep.title}</h2>
            <p className="text-[#E7E1FF] text-sm leading-relaxed">{nextStep.subtitle}</p>
          </div>
          <div className="shrink-0 flex flex-col gap-2 w-full sm:w-auto">
            <button
              onClick={nextStep.primary.onClick}
              className="px-6 py-3 bg-white text-[#0EB5C6] font-bold rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all text-sm shadow-lg whitespace-nowrap"
            >
              {nextStep.primary.label}
            </button>
            {nextStep.secondary && (
              <button
                onClick={nextStep.secondary.onClick}
                className="px-6 py-2 text-white/90 font-semibold rounded-xl border border-white/30 hover:bg-white/10 transition-all text-xs whitespace-nowrap"
              >
                {nextStep.secondary.label}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Última validación (snapshot clickable) ───────────────────────────── */}
      {!loading && latest && (
        <Link
          to={`/results/${latest.id}`}
          onClick={() =>
            trackEvent('dashboard_latest_validation_clicked', {
              tier, latest_status: latest.status, total_validations: totalCount, source: 'dashboard',
            })
          }
          className="flex items-center gap-4 px-4 py-4 mb-6 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] hover:border-[#0EB5C6]/40 transition-all group"
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${scoreBg(latest.validation_score)}`}>
            {latest.validation_score ?? '—'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#8B8AA0] mb-0.5">
              Última validación
            </p>
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] truncate group-hover:text-[#0EB5C6] transition-colors">
                {titleOf(latest)}
              </p>
              {trustChipOf(latest) && <TrustBadge chip={trustChipOf(latest)!} />}
            </div>
            <p className="text-xs mt-0.5 truncate">
              {latest.idea_industry && (
                <span className="text-gray-400 dark:text-[#afaebb]">{latest.idea_industry} · </span>
              )}
              <span className={`font-medium ${STATUS_COLOR[latest.status] ?? 'text-gray-400 dark:text-[#afaebb]'}`}>
                {STATUS_LABEL[latest.status] ?? latest.status}
              </span>
              <span className="text-gray-400 dark:text-[#afaebb]"> · {formatDate(latest.created_at)}</span>
            </p>
          </div>
          <svg className="w-4 h-4 text-gray-300 dark:text-white/20 group-hover:text-[#0EB5C6] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Ideas analizadas', value: loading ? '—' : String(totalCount) },
          { label: 'Score promedio', value: loading ? '—' : avgScore != null ? `${avgScore} pts` : '—' },
          { label: 'Plan activo', value: tierLabel },
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

      {/* ── Salud del workspace: conteos por estado (link a gestión) ─────────── */}
      {!loading && totalCount > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Estado de tus validaciones</p>
            <Link to="/results" className="text-xs text-[#0EB5C6] hover:underline font-medium">Gestionar →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatePill label="Completadas" count={counts.completed} tint="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" />
            <StatePill label="En progreso" count={counts.inProgress} tint="bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20" />
            <StatePill label="Parciales" count={counts.partial} tint="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" />
            <StatePill label="Fallidas" count={counts.failed} tint="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" />
            {counts.archived > 0 && (
              <StatePill label="Archivadas" count={counts.archived} tint="bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20" />
            )}
          </div>
        </div>
      )}

      {/* Uso del plan — misma fuente que el Sidebar (useUsage), sin saturar */}
      <div className="mb-6">
        <UsageBar
          used={usage?.total ?? 0}
          limit={limits.total}
          remaining={remaining}
          resetAt={usage?.reset_at}
          unlimited={isUnlimited}
          tierLabel={tierLabel}
          variant="card"
        >
          {!isUnlimited && remaining <= 1 && (
            <Link
              to="/pricing"
              className="block mt-2.5 text-center text-xs font-bold text-[#0EB5C6] hover:underline"
            >
              Mejorar plan →
            </Link>
          )}
        </UsageBar>
      </div>

      {/* Widget secundario: Inteligencia de Mercado (Animus) */}
      <div className="mb-8">
        <MarketSignalsWidget />
      </div>

      {/* Confianza y fuentes — Trust Layer a nivel Command Center (Punto 5) */}
      <div className="mb-8">
        <TrustSourcesPanel />
      </div>

      {/* Programa de pilotos — superficie del founder (Punto 6, frontend-only) */}
      <div className="mb-8">
        <PilotProgramCard tier={tier} source="dashboard" />
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
              onClick={goNew}
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
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] truncate group-hover:text-[#0EB5C6] transition-colors">
                      {titleOf(v)}
                    </p>
                    {trustChipOf(v) && <TrustBadge chip={trustChipOf(v)!} />}
                  </div>
                  <p className="text-xs mt-0.5 truncate">
                    {v.idea_industry && (
                      <span className="text-gray-400 dark:text-[#afaebb]">{v.idea_industry} · </span>
                    )}
                    <span className={`font-medium ${STATUS_COLOR[v.status] ?? 'text-gray-400 dark:text-[#afaebb]'}`}>
                      {STATUS_LABEL[v.status] ?? v.status}
                    </span>
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

// Pill de conteo por estado — link a /results (gestión). Se atenúa si count = 0.
function StatePill({ label, count, tint }: { label: string; count: number; tint: string }) {
  const dim = count === 0 ? 'opacity-45' : '';
  return (
    <Link
      to="/results"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all hover:scale-[1.03] ${tint} ${dim}`}
    >
      <span className="tabular-nums font-black">{count}</span>
      <span>{label}</span>
    </Link>
  );
}
