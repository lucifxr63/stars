import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { toast } from 'sonner';

type GenerationStatus = 'pending' | 'loading' | 'success' | 'error';

interface GenerationTask {
  id: string;
  label: string;
  status: GenerationStatus;
  type: 'summary' | 'market_sizing' | 'competitive_analysis' | 'risk_analysis' | 'unit_economics' | 'founder_fit' | 'market_signals';
}

export function StepGenerating() {
  const navigate = useNavigate();
  const { validationId, setValidationId, stepIdea, stepMarket, stepFounder, validationMode } = useValidationStore();
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
          const result = await res.json();
          
          // Guardar resultado en DB
          const updates: Record<string, any> = {};
          if (task.type === 'summary') {
            updates.summary_json = result;
            updates.validation_score = result.score;
            updates.ai_feedback = result.feedback;
            updates.score_breakdown = result.score_breakdown;
          } else {
            updates[task.type] = result;
          }
          await supabase.from('validations').update(updates).eq('id', currentId);
          updateTaskStatus(task.id, 'success');
        } catch {
          updateTaskStatus(task.id, 'error');
        }
      };

      await Promise.allSettled(tasks.map(runAI));
      
      // Update completeness
      await supabase.from('validations').update({ status: 'completed' }).eq('id', currentId);
      toast.success('Análisis completado');
      
      // Redirect
      navigate(`/results/${currentId}`);

    } catch (error) {
      console.error(error);
      toast.error('Ocurrió un error al iniciar la generación.');
    }
  };

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
