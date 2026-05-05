import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type PromptType =
  | 'questions' | 'customer_analysis' | 'value_prop' | 'mvp_generation' | 'summary'
  | 'competitive_analysis' | 'market_sizing' | 'risk_analysis' | 'unit_economics'
  | 'founder_fit' | 'market_signals'
  | 'validation_kit' | 'landing_generator' | 'interview_script' | 'tech_viability'
  | 'first_100_customers' | 'revenue_models' | 'risk_checklist' | 'pitch_letter'
  | 'governance_assessment' | 'fundraising_roadmap'
  | 'playbook_analysis';

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track all active controllers so concurrent Promise.all calls all get aborted on unmount/cancel
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

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-validate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ validation_id: validationId, step, prompt_type: promptType, context }),
          signal: controller.signal,
        }
      );

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
