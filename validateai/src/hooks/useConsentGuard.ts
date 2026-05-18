import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ConsentStatus = 'loading' | 'accepted' | 'required';

/**
 * Hook que verifica si el usuario autenticado ya tiene un registro
 * de consentimiento válido (flagged = true) en consent_logs.
 *
 * Retorna:
 *  - 'loading'   → consulta en progreso
 *  - 'accepted'  → ya dio consentimiento, nada que hacer
 *  - 'required'  → debe ver y aceptar el modal
 */
export function useConsentGuard(userId: string | null | undefined): ConsentStatus {
  const [status, setStatus] = useState<ConsentStatus>('loading');

  useEffect(() => {
    if (!userId) {
      setStatus('loading');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('consent_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('flagged', true)
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          // Si la tabla aún no existe en el entorno (pre-migración), no bloquear
          console.warn('[consent-guard] Error al verificar consentimiento:', error.message);
          setStatus('accepted');
          return;
        }

        setStatus(data ? 'accepted' : 'required');
      } catch (err) {
        if (!cancelled) {
          console.warn('[consent-guard] Error inesperado:', err);
          setStatus('accepted'); // fail-open en errores de red temporales
        }
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return status;
}
