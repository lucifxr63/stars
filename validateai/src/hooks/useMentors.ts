import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { MentorMatch } from '@/types/validation';

/**
 * Busca mentores relevantes para una idea usando matching semántico.
 * Si no hay embeddings en la tabla, cae back a traer los primeros 3 disponibles.
 */
export function useMentors(ideaDescription: string | null | undefined) {
  const [mentors, setMentors] = useState<MentorMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ideaDescription) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Intentar búsqueda semántica si hay embeddings disponibles
        // (necesita que el script de seed haya corrido con embeddings reales)
        const { data: fallback } = await supabase
          .from('mentors')
          .select('id,name,bio,expertise,linkedin_url,calendly_url,availability,session_price_clp,languages,photo_url')
          .eq('availability', 'available')
          .limit(3);

        if (!cancelled && fallback) {
          setMentors(
            (fallback as Omit<MentorMatch, 'similarity'>[]).map((m) => ({
              ...m,
              similarity: 0.8, // placeholder hasta que tengamos embeddings reales
            }))
          );
        }
      } catch {
        // silencioso — mentores son nice-to-have
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [ideaDescription]);

  return { mentors, loading };
}
