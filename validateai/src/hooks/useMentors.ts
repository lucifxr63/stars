import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { MentorMatch } from '@/types/validation';

/**
 * Matching semántico de mentores vía pgvector.
 * Llama a la edge function `match-mentors` que genera un embedding de la idea
 * y ejecuta el RPC `match_mentors` con similitud coseno.
 * Cae back a los primeros 3 disponibles si los embeddings no están seedeados.
 */
export function useMentors(
  ideaDescription: string | null | undefined,
  founderGaps?: string[],
) {
  const [mentors, setMentors] = useState<MentorMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const gapsKey = founderGaps?.join(',') ?? '';

  useEffect(() => {
    if (!ideaDescription?.trim()) return;

    let cancelled = false;
    setLoading(true);

    supabase.functions
      .invoke('match-mentors', {
        body: { ideaDescription, founderGaps: founderGaps ?? [] },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data) && data.length > 0) {
          setMentors(data as MentorMatch[]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaDescription, gapsKey]);

  return { mentors, loading };
}
