import { useEffect, useState, useRef } from 'react';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier, type UserTier } from '@/hooks/useUserTier';
import { toast } from 'sonner';
import { trackWizardStep } from '@/hooks/useAnalytics';
import { trackTelemetryEvent } from '@/lib/telemetry';
import { startBackgroundGeneration } from '@/lib/generationService';
import { Skeleton } from '@/components/ui/skeleton';

type GenerationStatus = 'pending' | 'loading' | 'success' | 'error';

interface GenerationTask {
  id: string;
  label: string;
  status: GenerationStatus;
  type: 'summary' | 'summary_quick' | 'market_sizing' | 'competitive_analysis' | 'risk_analysis' | 'unit_economics' | 'founder_fit' | 'market_signals';
}

// ── Tier-based task chunking ──────────────────────────────────────────────────
// free:    1 call  — score + feedback + breakdown (summary only)
// basic:   2 calls — + competitive analysis
// pro:     3 calls — + market sizing (expensive: uses web_search)
// premium: separate premium-validate flow (handled below)

const TASK_DEFINITIONS: Record<string, Omit<GenerationTask, 'status'>[]> = {
  free: [
    { id: 'summary', label: 'Evaluando viabilidad e idea...', type: 'summary' },
  ],
  basic: [
    { id: 'summary', label: 'Evaluando viabilidad e idea...', type: 'summary' },
    { id: 'competitors', label: 'Mapeando competencia...', type: 'competitive_analysis' },
  ],
  pro: [
    { id: 'summary', label: 'Evaluando viabilidad e idea...', type: 'summary' },
    { id: 'market', label: 'Calculando tamaño de mercado...', type: 'market_sizing' },
    { id: 'competitors', label: 'Mapeando competencia...', type: 'competitive_analysis' },
  ],
  premium: [
    { id: 'summary', label: 'Evaluando viabilidad e idea...', type: 'summary' },
    { id: 'market', label: 'Calculando tamaño de mercado...', type: 'market_sizing' },
    { id: 'competitors', label: 'Mapeando competencia...', type: 'competitive_analysis' },
  ],
};

function getTasksForTier(tier: UserTier, mode?: string): GenerationTask[] {
  if (mode === 'quick') {
    return [{ id: 'summary', label: 'Procesando viabilidad inicial...', type: 'summary_quick', status: 'pending' }];
  }
  const defs = TASK_DEFINITIONS[tier] ?? TASK_DEFINITIONS.free;
  return defs.map(d => ({ ...d, status: 'pending' as const }));
}

// ── Terminal Premium Paramétrica (Sprint P-D) ─────────────────────────────────
// Los mensajes se ciclan dinámicamente con setInterval hasta que el servidor
// responde. Sin timers fijos — la terminal no termina su animación antes que
// el análisis (Reddit + SerpAPI + Claude Sonnet puede tomar 20-45 segundos).

const PREMIUM_CYCLING_MESSAGES = [
  'Iniciando motor de inteligencia de mercado premium...',
  'Autenticando con Reddit API — buscando señales de la comunidad...',
  'Escaneando conversaciones en r/entrepreneur, r/SaaS y r/startups...',
  'Filtrando discusiones con más de 5 puntos de relevancia...',
  'Extrayendo sentimiento y frustración del mercado objetivo...',
  'Consultando Google Trends — últimos 12 meses de demanda...',
  'Calculando trayectoria de búsqueda y queries en auge...',
  'Cruzando ICP declarado con señales externas detectadas...',
  'Enviando contexto de 9 dimensiones a Claude Sonnet...',
  'Sintetizando evidencia de mercado con criterios VC implacables...',
  'Analizando coherencia entre tracción y tamaño de mercado...',
  'Validando modelo de negocio contra señales de comunidad...',
  'Redactando Executive Summary investor-ready...',
  'Procesando señales de demanda en tiempo real...',
  'Preparando reporte con estándares de due diligence...',
] as const;

const MAX_VISIBLE_LINES = 8; // altura máxima de la terminal

function PremiumTerminal() {
  const [lines, setLines] = useState<string[]>([PREMIUM_CYCLING_MESSAGES[0]]);

  useEffect(() => {
    let idx = 1;
    const interval = setInterval(() => {
      const msg = PREMIUM_CYCLING_MESSAGES[idx % PREMIUM_CYCLING_MESSAGES.length];
      setLines((prev) => {
        const next = [...prev, msg];
        return next.length > MAX_VISIBLE_LINES ? next.slice(-MAX_VISIBLE_LINES) : next;
      });
      idx++;
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="w-16 h-16 rounded-full bg-[#0EB5C6]/10 border border-[#0EB5C6]/30 flex items-center justify-center mb-6">
        <div className="w-8 h-8 border-2 border-[#0EB5C6]/40 border-t-[#0EB5C6] rounded-full animate-spin" />
      </div>

      <h2 className="text-xl font-black text-gray-900 dark:text-[#F0EFF8] mb-1">
        Análisis Premium en curso
      </h2>
      <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-8 text-center max-w-sm">
        Orquestando Reddit, Google Trends y Claude Sonnet en paralelo.
        Esto puede tomar entre 20 y 45 segundos.
      </p>

      <div className="w-full font-mono text-xs bg-[#0A0A0F] border border-white/8 rounded-2xl p-5 space-y-1.5 min-h-[200px]">
        {lines.map((line, i) => {
          const isLast = i === lines.length - 1;
          return (
            <div key={`${i}-${line}`} className="flex items-start gap-2 animate-in fade-in duration-300">
              <span className="text-[#0EB5C6] shrink-0">›</span>
              <span className={isLast ? 'text-amber-400' : 'text-emerald-400'}>{line}</span>
              {isLast && (
                <span className="inline-block w-2 h-3 bg-amber-400 animate-pulse ml-0.5 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-[#afaebb] text-center mt-4">
        No cierres esta pestaña. El análisis continúa en segundo plano.
      </p>
    </div>
  );
}

// ── Micro-feedback (The Mom Test) ─────────────────────────────────────────────

const MF_KEY = STORAGE_KEYS.mfGenerating.to;

const MICRO_OPTIONS = [
  { label: 'Con Excel / Sheets', value: 'Con Excel o Sheets' },
  { label: 'Hablando con clientes', value: 'Hablando con potenciales clientes' },
  { label: 'No las validaba', value: 'No validaba ideas antes' },
  { label: 'Otras herramientas', value: 'Con otras herramientas digitales' },
] as const;

function MicroFeedbackPanel({ tier }: { tier: string }) {
  const [visible, setVisible] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(MF_KEY)) return;
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const handleAnswer = (value: string) => {
    setAnswered(true);
    localStorage.setItem(MF_KEY, '1');
    trackTelemetryEvent({
      event_name: 'micro_feedback',
      context: {
        tier: (tier ?? 'free') as 'free' | 'basic' | 'pro' | 'premium',
        action_taken: value,
      },
    });
  };

  if (!visible) return null;

  return (
    <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl space-y-3">
      {!answered ? (
        <>
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            Mientras esperamos — ¿cómo validabas ideas antes de usar esta herramienta?
          </p>
          <div className="flex flex-wrap gap-2">
            {MICRO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleAnswer(opt.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#12121A] border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-800/30 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">
          ¡Gracias! Tu respuesta mejora Validus.
        </p>
      )}
    </div>
  );
}

// ── Radar mini-preview (Opción C aprobada por Mesa Directiva 01-Jun-2026) ────
// Muestra las 5 dimensiones de score "calculándose" durante la generación.
// No inventa números — solo anima el estado de carga para retener al usuario.

const SCORE_DIMENSIONS = [
  { key: 'problem', label: 'Problema', icon: '🔍', weight: 25 },
  { key: 'market', label: 'Mercado', icon: '📊', weight: 20 },
  { key: 'competition', label: 'Competencia', icon: '⚔️', weight: 15 },
  { key: 'solution', label: 'Solución', icon: '💡', weight: 25 },
  { key: 'execution', label: 'Ejecución', icon: '⚡', weight: 15 },
] as const;

function RadarPreview({ visible }: { visible: boolean }) {
  const [scanLine, setScanLine] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setScanLine(prev => (prev + 1) % SCORE_DIMENSIONS.length);
    }, 900);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="rounded-2xl border border-[#0EB5C6]/20 bg-[#0EB5C6]/4 dark:bg-[#0EB5C6]/5 p-5 space-y-3">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="relative w-5 h-5 shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-[#0EB5C6]/30 border-t-[#0EB5C6] animate-spin" />
        </div>
        <p className="text-sm font-bold text-[#0EB5C6] dark:text-[#38D5E3] tracking-wide">
          Calculando dimensiones...
        </p>
        <span className="ml-auto text-[10px] font-semibold text-[#0EB5C6]/60 tabular-nums">5/5</span>
      </div>

      <div className="space-y-2">
        {SCORE_DIMENSIONS.map((dim, i) => {
          const isActive = i === scanLine;
          const isScanned = i < scanLine;
          return (
            <div key={dim.key} className="flex items-center gap-2.5">
              <span className="text-sm w-5 text-center shrink-0">{dim.icon}</span>
              <span className={`text-xs font-medium w-20 shrink-0 transition-colors ${isActive ? 'text-[#0EB5C6] dark:text-[#38D5E3]' : 'text-gray-500 dark:text-[#8B8AA0]'
                }`}>
                {dim.label}
              </span>
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isActive
                    ? 'bg-[#0EB5C6] animate-pulse'
                    : isScanned
                      ? 'bg-[#0EB5C6]/40'
                      : 'bg-transparent'
                    }`}
                  style={{ width: isActive ? '65%' : isScanned ? `${30 + i * 8}%` : '0%' }}
                />
              </div>
              <span className={`text-[10px] font-bold w-8 text-right shrink-0 transition-colors ${isActive ? 'text-[#0EB5C6]' : 'text-gray-300 dark:text-white/15'
                }`}>
                {dim.weight}%
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 dark:text-[#afaebb] text-center pt-1">
        La IA está evaluando cada dimensión con criterios VC. Esto toma entre 8–15 segundos.
      </p>
    </div>
  );
}

// ── QuickTerminal: animación 5-8s para el flujo rápido con Claude Haiku ───────

const QUICK_STEPS = [
  { label: 'Iniciando análisis de viabilidad...', delay: 0 },
  { label: 'Evaluando claridad del problema declarado...', delay: 750 },
  { label: 'Cruzando ICP con modelo de negocio...', delay: 1600 },
  { label: 'Analizando coherencia de la solución...', delay: 2550 },
  { label: 'Calculando puntaje Problema + Solución...', delay: 3500 },
  { label: 'Marcando dimensiones sin datos suficientes...', delay: 4500 },
  { label: 'Generando veredicto inicial y próximos pasos...', delay: 5600 },
] as const;

function QuickTerminal() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    const timers = QUICK_STEPS.map((s, i) =>
      setTimeout(() => setVisibleLines((prev) => [...prev, i]), s.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="w-12 h-12 rounded-full bg-[#0EB5C6]/10 border border-[#0EB5C6]/30 flex items-center justify-center mb-5">
        <div className="w-6 h-6 border-2 border-[#0EB5C6]/30 border-t-[#0EB5C6] rounded-full animate-spin" />
      </div>

      <h2 className="text-lg font-black text-gray-900 dark:text-[#F0EFF8] mb-0.5">
        Procesando viabilidad inicial
      </h2>
      <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-6 text-center max-w-xs">
        Claude Haiku evalúa tu Problema y Solución. Listo en segundos.
      </p>

      <div className="w-full font-mono text-xs bg-[#0A0A0F] border border-white/8 rounded-2xl p-4 space-y-1.5 min-h-[160px]">
        {QUICK_STEPS.map((s, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 transition-all duration-200 ${visibleLines.includes(i) ? 'opacity-100' : 'opacity-0'
              }`}
          >
            <span className="text-[#0EB5C6] shrink-0">›</span>
            <span className={visibleLines.includes(i) && i === visibleLines[visibleLines.length - 1]
              ? 'text-amber-400'
              : 'text-emerald-400'
            }>
              {s.label}
            </span>
            {visibleLines.includes(i) && i === visibleLines[visibleLines.length - 1] && (
              <span className="inline-block w-1.5 h-3 bg-amber-400 animate-pulse ml-0.5" />
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 dark:text-[#afaebb] text-center mt-4">
        Análisis de superficie — completa el flujo Detallado para desbloquear todas las dimensiones.
      </p>
    </div>
  );
}

// ── Tier label pill ───────────────────────────────────────────────────────────

const TIER_LABELS: Record<UserTier, { label: string; cls: string }> = {
  free: { label: 'Validación Base', cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  basic: { label: 'Validación Básica', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  pro: { label: 'Validación Completa', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  premium: { label: 'Validación Premium', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  admin: { label: 'Validación Admin', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
};

// ── Main component ────────────────────────────────────────────────────────────

export function StepGenerating() {
  const navigate = useNavigate();
  const { validationId, setValidationId, stepIdea, stepMarket, stepFounder, stepIdeaQuick,
    validationMode, setPremiumResult, setAgentLogId } = useValidationStore();
  const { isPro: isPremium, tier, loading: tierLoading } = useUserTier();

  // Tasks start empty — populated once tier is known to avoid running with wrong tier
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const startedRef = useRef(false);

  // Wait for tier to load, then start generation exactly once
  useEffect(() => {
    if (tierLoading) return;
    if (startedRef.current) return;
    startedRef.current = true;

    // Initialize tasks for this tier before starting
    setTasks(getTasksForTier(tier, useValidationStore.getState().validationMode));
    startGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierLoading]);

  const updateTaskStatus = (taskId: string, status: GenerationStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  };

  // Reintenta una tarea específica sin re-ejecutar las que ya completaron.
  // Incluye retry_task en el payload para que el backend pueda loguear el reintento
  // y potencialmente optimizar el pipeline en el futuro.
  const handleRetryTask = async (task: GenerationTask) => {
    const currentId = useValidationStore.getState().validationId;
    if (!currentId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { stepIdea, stepMarket, stepFounder } = useValidationStore.getState();
    const context = {
      ...stepIdea,
      ...stepMarket,
      founder_context: stepFounder,
      // Fix B: exponer los campos del fundador también al nivel raíz para que
      // buildMarketContext / founder_fit los lean (no quedan solo anidados).
      team_composition: stepFounder?.team_composition ?? null,
      tech_level: stepFounder?.tech_level ?? null,
      traction_status: stepFounder?.traction_status ?? null,
    };

    updateTaskStatus(task.id, 'loading');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          validation_id: currentId,
          step: 4,
          prompt_type: task.type,
          context,
          retry_task: task.id,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      await res.json();
      await supabase.rpc('merge_generation_progress', { p_id: currentId, p_key: task.id, p_status: 'success' });
      updateTaskStatus(task.id, 'success');
      // Si todas las tasks ya están completas, marcar la validación y navegar.
      const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, status: 'success' as const } : t);
      if (updatedTasks.every(t => t.status === 'success')) {
        await supabase.from('validations').update({ status: 'completed' }).eq('id', currentId);
        useValidationStore.getState().reset();
        navigate(`/results/${currentId}`);
      }
    } catch {
      await supabase.rpc('merge_generation_progress', { p_id: currentId, p_key: task.id, p_status: 'error' });
      updateTaskStatus(task.id, 'error');
      toast.error(`No se pudo reintentar "${task.label}". Intenta de nuevo.`);
    }
  };

  const startGeneration = async () => {
    // Read validationMode from the store at execution time, not from the closure,
    // to avoid stale-closure bugs when the user switches flows before reaching this step.
    const currentMode = useValidationStore.getState().validationMode;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // ── Rama Premium ────────────────────────────────────────────────────────
      if (isPremium) {
        if (!stepIdea.idea_name || !stepIdea.idea_industry) {
          toast.error('Completa el nombre e industria de tu idea antes de continuar.');
          return;
        }

        let currentId = validationId;
        if (!currentId) {
          const { data, error } = await supabase
            .from('validations')
            .insert({
              user_id: session.user.id,
              status: 'in_progress',
              current_step: 4,
              validation_mode: 'premium',
              idea_name: stepIdea.idea_name,
              idea_description: stepIdea.idea_description,
              idea_industry: stepIdea.idea_industry,
            })
            .select('id')
            .single();
          if (error || !data?.id) throw error ?? new Error('No id returned');
          currentId = data.id as string;
          setValidationId(currentId);
        }

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/premium-validate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              validation_id: currentId,
              idea_description: stepIdea.idea_description ?? stepIdea.idea_name,
            }),
            // Red de seguridad: el análisis premium (Reddit + SerpAPI + Sonnet) puede
            // tomar 20-45s. Timeout duro de 60s para que la terminal nunca quede en
            // carga infinita si el backend cuelga o se demora más de lo esperado.
            signal: AbortSignal.timeout(60_000),
          },
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({})) as { error?: string };
          if (errBody?.error?.includes('premium_limit_exceeded')) {
            toast.error('Alcanzaste el límite de 999 análisis premium este mes. Tu cuota se renueva el próximo ciclo.');
            return;
          }
          throw new Error(`premium-validate error: ${res.status}`);
        }
        const premiumData = await res.json();

        setAgentLogId(premiumData.log_id);
        setPremiumResult({
          executive_summary: premiumData.executive_summary,
          reddit_status: premiumData.reddit_status,
          trends_status: premiumData.trends_status,
          agents: premiumData.agents,
          errors: premiumData.errors,
        });

        trackWizardStep(4, 'Generación', 'premium');
        toast.success('Análisis Premium completado');
        useValidationStore.getState().reset();
        navigate(`/results/${currentId}`);
        return;
      }
      // ── Fin rama Premium ─────────────────────────────────────────────────────

      // ── Rama no-premium (quick / detailed): fire-and-forget + redirect ────────
      // El backend ya persiste progreso (generation_progress + status). Disparamos
      // el job en background y redirigimos YA al Dashboard, donde el
      // GenerationStatusWidget muestra el avance. El fundador explora el ecosistema
      // (Bralidus) mientras Claude trabaja — sin bloqueo síncrono del frontend.
      let context: any = {};
      if (currentMode === 'detailed') {
        context = {
          ...stepIdea,
          ...stepMarket,
          founder_context: stepFounder,
          // Fix B: exponer los campos del fundador al nivel raíz para founder_fit.
          team_composition: stepFounder?.team_composition ?? null,
          tech_level: stepFounder?.tech_level ?? null,
          traction_status: stepFounder?.traction_status ?? null,
        };
      } else {
        // Flujo rápido: usar directamente los campos capturados en StepIdeaQuick.
        context = {
          idea_name: stepIdeaQuick.idea_name ?? stepIdea.idea_name,
          idea_description: stepIdeaQuick.idea_description ?? stepIdea.idea_description,
          idea_industry: stepIdeaQuick.idea_industry ?? stepIdea.idea_industry,
          quick_icp: stepIdeaQuick.quick_icp ?? '',
          business_model: stepIdeaQuick.business_model ?? '',
          validation_mode: 'quick',
        };
      }

      if (!context.idea_name || !context.idea_industry) {
        toast.error('Completa el nombre e industria de tu idea antes de continuar.');
        return;
      }

      const job = await startBackgroundGeneration({
        tier,
        mode: currentMode === 'quick' ? 'quick' : 'detailed',
        validationId,
        context,
      });

      trackWizardStep(4, 'Generación', currentMode);
      useValidationStore.getState().reset();

      // Reanudación sin tasks pendientes → saltar directo al resultado.
      if (job.status === 'completed') {
        navigate(`/results/${job.validationId}`, { replace: true });
        return;
      }

      toast.success('Tu validación se está generando. Te llevamos a tu panel.');
      navigate('/dashboard', { replace: true });
      return;

    } catch (error) {
      console.error(error);
      // Fallback UX premium: si el fetch abortó por timeout (60s) o el backend falló,
      // NO dejamos la terminal en carga infinita. El job premium ya quedó persistido
      // como in_progress server-side, así que avisamos y mandamos al Dashboard, donde
      // el GenerationStatusWidget retoma el seguimiento.
      const isTimeout = error instanceof DOMException &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      if (isPremium && isTimeout) {
        toast.info(
          'El análisis profundo está tomando más de lo esperado. Revisa tu Dashboard en unos minutos — te avisaremos al terminar.',
          { duration: 8000 },
        );
        useValidationStore.getState().reset();
        navigate('/dashboard', { replace: true });
        return;
      }
      toast.error('Ocurrió un error al iniciar la generación.');
    }
  };

  const completedCount = tasks.filter(t => t.status === 'success' || t.status === 'error').length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const TASK_DESCRIPTIONS: Record<string, string> = {
    summary: 'Analizando viabilidad con criterios de inversor VC',
    summary_quick: 'Evaluando Problema y Solución con Claude Haiku',
    market_sizing: 'Estimando TAM/SAM/SOM con datos del mercado objetivo',
    competitive_analysis: 'Mapeando competidores e identificando gaps de mercado',
    risk_analysis: 'Evaluando riesgos de mercado, técnicos y regulatorios',
    unit_economics: 'Calculando CAC, LTV y métricas financieras clave',
    founder_fit: 'Evaluando fit fundador-mercado y Unfair Advantage',
  };

  if (isPremium) {
    return <PremiumTerminal />;
  }

  if (validationMode === 'quick') {
    return <QuickTerminal />;
  }

  // Loading tier — show minimal spinner before starting
  if (tierLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm text-gray-400 dark:text-[#8B8AA0]">Preparando análisis...</p>
      </div>
    );
  }

  const tierLabel = TIER_LABELS[tier] ?? TIER_LABELS.free;

  return (
    <div className="flex flex-col py-8 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-xl font-black text-gray-900 dark:text-[#F0EFF8]">
            Validando tu idea con criterios VC
          </h2>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tierLabel.cls}`}>
            {tierLabel.label}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-[#8B8AA0] max-w-sm mx-auto leading-relaxed">
          {tasks.length === 1
            ? 'Analizando viabilidad y generando tu veredicto.'
            : 'Nuestros agentes analizan viabilidad, mercado y competencia en paralelo.'}
        </p>
      </div>

      {/* Radar mini-preview — visible durante la generación */}
      <RadarPreview visible={progressPct < 100} />

      {/* Barra de progreso global */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-gray-500 dark:text-[#8B8AA0]">Progreso del análisis</span>
          <span className="text-indigo-600 dark:text-indigo-400 tabular-nums">{progressPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-2.5">
        {tasks.map(task => (
          <div
            key={task.id}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${task.status === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30'
              : task.status === 'loading'
                ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/30'
                : task.status === 'error'
                  ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
                  : 'bg-white dark:bg-[#12121A] border-gray-100 dark:border-white/5'
              }`}
          >
            {/* Status icon */}
            <div className="shrink-0">
              {task.status === 'pending' && (
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/20" />
                </div>
              )}
              {task.status === 'loading' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-800/30 flex items-center justify-center">
                  <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              )}
              {task.status === 'success' && (
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-800/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {task.status === 'error' && (
                <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-800/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
            </div>

            {/* Label + description */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-tight ${task.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' :
                task.status === 'loading' ? 'text-indigo-700 dark:text-indigo-300' :
                  task.status === 'error' ? 'text-red-600 dark:text-red-400' :
                    'text-gray-400 dark:text-[#afaebb]'
                }`}>
                {task.label}
              </p>
              {task.status === 'loading' && TASK_DESCRIPTIONS[task.type] && (
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 leading-tight">
                  {TASK_DESCRIPTIONS[task.type]}
                </p>
              )}
            </div>

            {/* Badge / Retry */}
            <div className="shrink-0">
              {task.status === 'pending' && <span className="text-xs text-gray-300 dark:text-[#afaebb] font-medium">En espera</span>}
              {task.status === 'loading' && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">Analizando...</span>}
              {task.status === 'success' && <span className="text-xs text-emerald-600 font-black">Listo</span>}
              {task.status === 'error' && (
                <button
                  onClick={() => handleRetryTask(task)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reintentar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade CTA for free/basic */}
      {(tier === 'free' || tier === 'basic') && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/15">
          <svg className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-purple-300 leading-relaxed">
              {tier === 'free'
                ? 'Plan Pro incluye análisis de mercado (TAM/SAM/SOM) y mapeo competitivo.'
                : 'Plan Pro incluye análisis de mercado completo (TAM/SAM/SOM).'}
            </p>
          </div>
          <a
            href="/pricing"
            className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/20 hover:bg-purple-500/25 transition-colors"
          >
            Ver planes
          </a>
        </div>
      )}

      {/* Micro-feedback The Mom Test */}
      <MicroFeedbackPanel tier={tier ?? 'free'} />

      {/* Preview skeleton del reporte final */}
      {progressPct < 100 && (
        <div className="space-y-2 opacity-40">
          <p className="text-xs font-medium text-gray-400 dark:text-[#afaebb] uppercase tracking-wide">Vista previa del reporte</p>
          <div className="p-4 bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5 rounded-2xl space-y-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
