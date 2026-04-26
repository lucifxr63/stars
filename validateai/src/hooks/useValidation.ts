import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';

export function useValidation() {
  const store = useValidationStore();

  const createValidation = useCallback(async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('validations')
      .insert({
        user_id: user.id,
        status: 'in_progress',
        current_step: 1,
        idea_name: store.stepIdea.idea_name ?? null,
        idea_description: store.stepIdea.idea_description ?? null,
        idea_industry: store.stepIdea.idea_industry ?? null,
        target_country: store.stepIdea.target_country ?? null,
        target_region: store.stepIdea.target_region ?? null,
        business_model: store.stepIdea.business_model ?? null,
        business_stage: store.stepIdea.business_stage ?? null,
        pricing_range: store.stepIdea.pricing_range ?? null,
        known_competitors: store.stepIdea.known_competitors ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
    store.setValidationId(data.id as string);
    return data.id as string;
  }, [store]);

  const saveStep = useCallback(async (stepData: Record<string, unknown>): Promise<void> => {
    if (!store.validationId) return;
    const { error } = await supabase
      .from('validations')
      .update({ ...stepData, current_step: store.currentStep })
      .eq('id', store.validationId);
    if (error) throw error;
  }, [store.validationId, store.currentStep]);

  const completeValidation = useCallback(async (): Promise<void> => {
    if (!store.validationId) return;
    const { error } = await supabase
      .from('validations')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', store.validationId);
    if (error) throw error;
  }, [store.validationId]);

  return { createValidation, saveStep, completeValidation };
}
