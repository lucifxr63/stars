import { useState } from 'react';
import { toast } from 'sonner';
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
      const { error: fnError, data: fnData } = await supabase.functions.invoke('anonymize-idea', {
        body: { validation_id: validationId },
      });

      if (fnError || fnData?.error === 'rate_limit') {
        toast.warning('Límite diario alcanzado', {
          description: 'Has alcanzado el límite de 5 análisis diarios. Vuelve mañana o mejora tu plan.',
          duration: 6000,
        });
      }
    } catch {
      // silencioso — no interrumpir el flujo principal si falla la anonimización
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

    // Al activar el consentimiento, anonimizar la validación completada más reciente
    if (consent) {
      try {
        const { data: latest } = await supabase
          .from('validations')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();

        if (latest?.id) {
          await supabase.functions.invoke('anonymize-idea', {
            body: { validation_id: latest.id },
          });
        }
      } catch {
        // silencioso — no interrumpir el flujo si falla
      }
    }
  };

  return { saveIfConsented, updateConsent, saving };
}
