import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier } from '@/hooks/useUserTier';
import { toast } from 'sonner';
import { trackWizardStep, trackValidationCompleted } from '@/hooks/useAnalytics';
import { Skeleton } from '@/components/ui/skeleton';

type GenerationStatus = 'pending' | 'loading' | 'success' | 'error';

interface GenerationTask {
  id: string;
  label: string;
  status: GenerationStatus;
  type: 'summary' | 'market_sizing' | 'competitive_analysis' | 'risk_analysis' | 'unit_economics' | 'founder_fit' | 'market_signals';
}

// ── Terminal Hacker UI (Premium) ──────────────────────────────────────────────

const PREMIUM_STEPS = [
  { label: 'Iniciando motor de validación premium...',   delay: 0 },
  { label: 'Conectando con fuentes de datos externas...', delay: 900 },
  { label: 'Escaneando conversaciones en r/entrepreneur...', delay: 2000 },
  { label: 'Analizando r/SaaS y comunidades afines...', delay: 3100 },
  { label: 'Consultando tendencias de búsqueda globales...', delay: 4200 },
  { label: 'Calculando trayectoria de demanda...', delay: 5100 },
  { label: 'Sintetizando evidencia con IA...', delay: 6200 },
  { label: 'Generando resumen ejecutivo...', delay: 7400 },
] as const;

function PremiumTerminal() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    const timers = PREMIUM_STEPS.map((s, i) =>
      setTimeout(() => setVisibleLines((prev) => [...prev, i]), s.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="w-16 h-16 rounded-full bg-[#7C6FF7]/10 border border-[#7C6FF7]/30 flex items-center justify-center mb-6">
        <div className="w-8 h-8 border-2 border-[#7C6FF7]/40 border-t-[#7C6FF7] rounded-full animate-spin" />
      </div>

      <h2 className="text-xl font-black text-gray-900 dark:text-[#F0EFF8] mb-1">
        Análisis Premium en curso
      </h2>
      <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-8 text-center max-w-sm">
        Agentes de datos recopilando señales de mercado en tiempo real.
      </p>

      <div className="w-full font-mono text-xs bg-[#0A0A0F] border border-white/8 rounded-2xl p-5 space-y-1.5 min-h-[200px]">
        {PREMIUM_STEPS.map((s, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 transition-all duration-300 ${
              visibleLines.includes(i) ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="text-[#7C6FF7] shrink-0">›</span>
            <span className="text-emerald-400">{s.label}</span>
            {visibleLines.includes(i) && i === visibleLines[visibleLines.length - 1] && (
              <span className="inline-block w-2 h-3 bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StepGenerating() {
  const navigate = useNavigate();
  const { validationId, setValidationId, stepIdea, stepMarket, stepFounder, validationMode,
          setPremiumResult, setAgentLogId } = useValidationStore();
  const { isPro: isPremium } = useUserTier();
  const [tasks, setTasks] = useState<GenerationTask[]>([
    { id: 'summary', label: 'Evaluando viabilidad e idea...', status: 'pending', type: 'summary' },
    { id: 'market', label: 'Calculando tamaño de mercado...', status: 'pending', type: 'market_sizing' },
    { id: 'competitors', label: 'Mapeando competencia...', status: 'pending', type: 'competitive_analysis' },
  ]);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startGeneration();
  }, []);

  const updateTaskStatus = (taskId: string, status: GenerationStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
  };

  const startGeneration = async () => {
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
              validation_mode: 'quick',
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
          },
        );

        if (!res.ok) throw new Error(`premium-validate error: ${res.status}`);
        const premiumData = await res.json();

        setAgentLogId(premiumData.log_id);
        setPremiumResult({
          executive_summary: premiumData.executive_summary,
          reddit_status: premiumData.reddit_status,
          trends_status: premiumData.trends_status,
          agents: premiumData.agents,
          errors: premiumData.errors,
        });

        trackWizardStep(4, 'Generación', 'quick');
        toast.success('Análisis Premium completado');
        navigate(`/results/${currentId}`);
        return;
      }
      // ── Fin rama Premium ─────────────────────────────────────────────────────

      // Guard: si el row ya está completado no gastar tokens, solo redirigir
      if (validationId) {
        const { data: existing } = await supabase
          .from('validations')
          .select('id, status')
          .eq('id', validationId)
          .single();
        if (existing?.status === 'completed') {
          navigate(`/results/${existing.id}`, { replace: true });
          return;
        }
      }

      let context: any = {};
      if (validationMode === 'detailed') {
        context = {
          ...stepIdea,
          ...stepMarket,
          founder_context: stepFounder,
          tech_level: stepFounder?.tech_level ?? null,
        };
      } else {
        const inferRes = await supabase.functions.invoke('ai-validate', {
          body: {
            prompt_type: 'customer_analysis',
            context: { stepIdea },
          },
        });
        const inferred = inferRes.data;
        context = {
          ...stepIdea,
          customer_segment: inferred?.customer_segment ?? '',
          target_country: 'Chile',
          target_region: '',
          business_model: inferred?.business_model ?? '',
          pricing_range: '',
          founder_context: null,
        };
      }

      // Guard: idea_name e idea_industry son obligatorios
      if (!context.idea_name || !context.idea_industry) {
        toast.error('Completa el nombre e industria de tu idea antes de continuar.');
        return;
      }

      // 1. Guardar o crear la validación inicial
      let currentId = validationId;
      if (!currentId) {
        const { data, error } = await supabase.from('validations').insert({
          user_id: session.user.id,
          status: 'in_progress',
          current_step: 4,
          validation_mode: validationMode,
          ...context,
        }).select('id').single();
        if (error || !data?.id) throw error ?? new Error('No id returned');
        currentId = data.id as string;
        setValidationId(currentId);
      } else {
        await supabase.from('validations').update({
          ...context,
          validation_mode: validationMode,
          current_step: 4,
        }).eq('id', currentId);
      }

      // 2. Disparar generación por bloques paralelamente
      // Marcamos todas como 'loading'
      setTasks(prev => prev.map(t => ({ ...t, status: 'loading' })));

      const runAI = async (task: GenerationTask) => {
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-validate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ validation_id: currentId, step: 4, prompt_type: task.type, context }),
          });

          if (!res.ok) throw new Error('Failed');
          // La Edge Function persiste los resultados directamente en la DB
          await res.json();
          updateTaskStatus(task.id, 'success');
        } catch {
          updateTaskStatus(task.id, 'error');
        }
      };

      await Promise.allSettled(tasks.map(runAI));
      
      // Update completeness
      await supabase.from('validations').update({ status: 'completed' }).eq('id', currentId);

      const summaryTask = tasks.find((t) => t.type === 'summary');
      trackWizardStep(4, 'Generación', 'detailed');
      if (summaryTask?.status === 'success') {
        // score viene del store (setted vía setSummary) — no disponible aquí, usar 0 como fallback
        trackValidationCompleted(currentId!, 0, context.idea_industry as string ?? '', 'free');
      }

      toast.success('Análisis completado');
      navigate(`/results/${currentId}`);

    } catch (error) {
      console.error(error);
      toast.error('Ocurrió un error al iniciar la generación.');
    }
  };

  const completedCount = tasks.filter(t => t.status === 'success' || t.status === 'error').length;
  const progressPct = Math.round((completedCount / tasks.length) * 100);

  const TASK_DESCRIPTIONS: Record<string, string> = {
    summary:              'Analizando viabilidad con criterios de inversor VC',
    market_sizing:        'Estimando TAM/SAM/SOM con datos del mercado objetivo',
    competitive_analysis: 'Mapeando competidores e identificando gaps de mercado',
    risk_analysis:        'Evaluando riesgos de mercado, técnicos y regulatorios',
    unit_economics:       'Calculando CAC, LTV y métricas financieras clave',
    founder_fit:          'Evaluando fit fundador-mercado y Unfair Advantage',
  };

  if (isPremium) {
    return <PremiumTerminal />;
  }

  return (
    <div className="flex flex-col py-8 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-gray-900 dark:text-[#F0EFF8] mb-1">
          Validando tu idea con criterios VC
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8B8AA0] max-w-sm mx-auto leading-relaxed">
          Nuestros agentes analizan viabilidad, mercado y competencia en paralelo.
        </p>
      </div>

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
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${
              task.status === 'success'
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
              <p className={`text-sm font-semibold leading-tight ${
                task.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' :
                task.status === 'loading' ? 'text-indigo-700 dark:text-indigo-300' :
                task.status === 'error'   ? 'text-red-600 dark:text-red-400' :
                'text-gray-400 dark:text-[#4A495E]'
              }`}>
                {task.label}
              </p>
              {task.status === 'loading' && TASK_DESCRIPTIONS[task.type] && (
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 leading-tight">
                  {TASK_DESCRIPTIONS[task.type]}
                </p>
              )}
            </div>

            {/* Badge */}
            <div className="shrink-0">
              {task.status === 'pending' && <span className="text-xs text-gray-300 dark:text-[#4A495E] font-medium">En espera</span>}
              {task.status === 'loading' && <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">Analizando...</span>}
              {task.status === 'success' && <span className="text-xs text-emerald-600 font-black">Listo</span>}
              {task.status === 'error'   && <span className="text-xs text-red-500 font-bold">Parcial</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Preview skeleton del reporte final */}
      {progressPct < 100 && (
        <div className="space-y-2 opacity-40">
          <p className="text-xs font-medium text-gray-400 dark:text-[#4A495E] uppercase tracking-wide">Vista previa del reporte</p>
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
