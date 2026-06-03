import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type PromptType =
  | 'questions' | 'customer_analysis' | 'value_prop' | 'mvp_generation' | 'summary'
  | 'competitive_analysis' | 'market_sizing' | 'risk_analysis' | 'unit_economics'
  | 'founder_fit' | 'market_signals'
  | 'validation_kit' | 'landing_generator' | 'interview_script' | 'tech_viability'
  | 'first_100_customers' | 'revenue_models' | 'risk_checklist' | 'pitch_letter'
  | 'governance_assessment' | 'fundraising_roadmap'
  | 'playbook_analysis'
  | 'pitch_deck'
  | 'lean_roadmap'
  | 'financial_projection'
  | 'compliance_roadmap';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());

  useEffect(() => {
    return () => {
      activeControllersRef.current.forEach((c) => c.abort());
      activeControllersRef.current.clear();
    };
  }, []);

  function cancelAI() {
    activeControllersRef.current.forEach((c) => c.abort());
    activeControllersRef.current.clear();
    setLoading(false);
  }

  async function callAI<T = unknown>(
    validationId: string,
    step: number,
    promptType: PromptType,
    context: Record<string, unknown>
  ): Promise<T | null> {
    const controller = new AbortController();
    activeControllersRef.current.add(controller);

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-validate`;
      const options: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ validation_id: validationId, step, prompt_type: promptType, context }),
        signal: controller.signal,
      };

      let res = await fetch(url, options);

      if (res.status === 429) {
        const errBody = await res.clone().json().catch(() => ({} as Record<string, unknown>));
        const errCode = errBody.error as string | undefined;

        // Errores de tier o límite mensual — no tiene sentido reintentar
        if (errCode === 'tier_blocked' || errCode === 'rate_limit_tier') {
          toast.error('Tu plan no incluye este análisis. Actualiza para continuar.', { duration: 6000 });
          return null;
        }
        if (errCode === 'monthly_limit' || errCode === 'rate_limit_monthly') {
          const used  = errBody.used  as number | undefined;
          const limit = errBody.limit as number | undefined;
          const info  = used != null && limit != null ? ` (${used}/${limit})` : '';
          toast.error(
            `Límite mensual alcanzado${info}. Se renueva el 1° del mes.`,
            { duration: 8000 },
          );
          return null;
        }
        if (errCode === 'expensive_limit' || errCode === 'rate_limit_expensive') {
          const used  = errBody.used  as number | undefined;
          const limit = errBody.limit as number | undefined;
          const info  = used != null && limit != null ? ` (${used}/${limit})` : '';
          toast.error(
            `Límite de análisis de mercado alcanzado${info}. Actualiza tu plan para más.`,
            { duration: 8000 },
          );
          return null;
        }

        // Rate limit genérico de Anthropic — retry con backoff
        const retryAfter = res.headers.get('Retry-After');
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 3000;
        toast.info(`Límite de solicitudes. Reintentando en ${Math.round(waitMs / 1000)}s…`, { duration: waitMs });
        await sleep(waitMs, controller.signal);
        res = await fetch(url, options);
      }

      if (res.status === 429) {
        toast.error('Demasiadas solicitudes a la IA. Espera unos segundos antes de continuar.');
        return null;
      }

      if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
      return await res.json() as T;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Análisis cancelado por el usuario');
        return null;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      activeControllersRef.current.delete(controller);
      if (activeControllersRef.current.size === 0) setLoading(false);
    }
  }

  return { callAI, cancelAI, loading, error };
}
