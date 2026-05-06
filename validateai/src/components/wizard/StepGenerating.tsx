import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier } from '@/hooks/useUserTier';
import { toast } from 'sonner';
import { trackWizardStep, trackValidationCompleted } from '@/hooks/useAnalytics';

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
  const { isPremium } = useUserTier();
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
      if (isPremium || validationMode === 'quick') {
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

  if (isPremium || validationMode === 'quick') {
    return <PremiumTerminal />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
        <div className="text-3xl animate-bounce">🤖</div>
      </div>
      <h2 className="text-xl font-black text-gray-900 dark:text-[#F0EFF8] mb-2">Construyendo tu reporte...</h2>
      <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-8 text-center max-w-sm">
        Nuestra IA está analizando todas las aristas de tu idea. Esto tomará unos segundos.
      </p>

      <div className="w-full space-y-3">
        {tasks.map(task => (
          <div key={task.id} className="flex items-center justify-between p-4 bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl">
            <span className={`text-sm font-semibold transition-colors ${
              task.status === 'pending' ? 'text-gray-400' :
              task.status === 'loading' ? 'text-indigo-600' :
              task.status === 'success' ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {task.label}
            </span>
            <div className="flex items-center bg-gray-50 dark:bg-[#0A0A0F] px-2.5 py-1.5 rounded-full">
              {task.status === 'pending' && <span className="text-xs text-gray-400 font-medium">En espera</span>}
              {task.status === 'loading' && (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mr-1.5" />
                  <span className="text-xs text-indigo-600 font-bold">Generando</span>
                </>
              )}
              {task.status === 'success' && <span className="text-xs text-emerald-600 font-black">✓ Listo</span>}
              {task.status === 'error' && <span className="text-xs text-red-500 font-bold">Error</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
