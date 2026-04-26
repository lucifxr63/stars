import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ValidationVersion } from '@/types/validation';

/**
 * Carga todas las versiones de una idea usando la vista `validation_tree`.
 * La vista retorna toda la cadena: raíz → pivote 1 → pivote 2 ...
 */
export function useValidationHistory(validationId: string | undefined) {
  const [versions, setVersions] = useState<ValidationVersion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!validationId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Primero obtenemos el root_id de esta validación (puede ser ella misma si es raíz)
        const { data: selfData } = await supabase
          .from('validations')
          .select('id, parent_id, version')
          .eq('id', validationId)
          .single();

        if (!selfData) return;

        // Calculamos el root buscando hacia arriba
        let rootId = selfData.parent_id ?? selfData.id;
        if (selfData.parent_id) {
          // subir al raíz iterativamente (máximo 10 niveles)
          let current = selfData.parent_id;
          for (let i = 0; i < 10; i++) {
            const { data: parent } = await supabase
              .from('validations')
              .select('id, parent_id')
              .eq('id', current)
              .single();
            if (!parent?.parent_id) { rootId = parent?.id ?? rootId; break; }
            current = parent.parent_id;
          }
        }

        // Traer toda la cadena desde la vista
        const { data } = await supabase
          .from('validation_tree')
          .select('id,idea_name,validation_score,version,pivot_reason,parent_id,created_at,completed_at,status,depth')
          .eq('root_id', rootId)
          .order('depth', { ascending: true })
          .order('created_at', { ascending: true });

        if (!cancelled && data) {
          setVersions(data as ValidationVersion[]);
        }
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [validationId]);

  return { versions, loading };
}

/** Calcula el delta de score entre la versión actual y la anterior */
export function getScoreDelta(versions: ValidationVersion[], currentId: string) {
  const idx = versions.findIndex((v) => v.id === currentId);
  if (idx <= 0) return null;
  const current  = versions[idx].validation_score;
  const previous = versions[idx - 1].validation_score;
  if (current === null || previous === null) return null;
  return current - previous;
}
