import { useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook para guardar datos de entrenamiento anonimizados.
 * Solo se ejecuta si el usuario ha dado consentimiento.
 */
export function useTrainingData() {
  const [saving, setSaving] = useState(false);

  const saveIfConsented = async (validationId: string) => {
    if (!validationId) return;
    setSaving(true);

    try {
      // Verificar consentimiento del usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('training_consent')
        .eq('id', user.id)
        .single();

      if (!profile?.training_consent) return;

      // Llamar a la edge function de anonimización
      await supabase.functions.invoke('anonymize-idea', {
        body: { validation_id: validationId },
      });
    } catch {
      // silencioso — no interrumpir el flujo si falla
    } finally {
      setSaving(false);
    }
  };

  const updateConsent = async (consent: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        training_consent: consent,
        training_consent_at: consent ? new Date().toISOString() : null,
      })
      .eq('id', user.id);
  };

  return { saveIfConsented, updateConsent, saving };
}
