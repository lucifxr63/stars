import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type PromptType =
  | 'questions' | 'customer_analysis' | 'value_prop' | 'mvp_generation' | 'summary'
  | 'competitive_analysis' | 'market_sizing' | 'risk_analysis' | 'unit_economics'
  | 'founder_fit' | 'market_signals'
  | 'validation_kit' | 'landing_generator' | 'interview_script' | 'tech_viability'
  | 'first_100_customers' | 'revenue_models' | 'risk_checklist' | 'pitch_letter';

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  function cancelAI() {
    abortControllerRef.current?.abort();
    setLoading(false);
  }

  async function callAI<T = unknown>(
    validationId: string,
    step: number,
    promptType: PromptType,
    context: Record<string, unknown>
  ): Promise<T | null> {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

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
          signal: abortControllerRef.current.signal,
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
      setLoading(false);
    }
  }

  return { callAI, cancelAI, loading, error };
}
