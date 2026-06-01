import { useEffect, useState } from 'react';

export type IdeaQuality = 'poor' | 'acceptable' | 'good';

// Vocabulario de dolor calibrado para founders latinoamericanos.
// Palabras genéricas de solución (mejorar, optimizar) se ponderan menos
// que palabras de problema concreto (pierden, tarda, cuesta).
const PAIN_KEYWORDS = [
  'costo', 'cuesta', 'caro', 'pierde', 'pierden', 'pérdida',
  'tiempo', 'tarda', 'demora', 'lento', 'horas', 'días',
  'problema', 'falla', 'error', 'frustración', 'difícil',
  'manual', 'ineficiente', 'ineficiencia', 'complejo',
  'reducir', 'automatizar', 'eliminar', 'optimizar', 'mejorar', 'ahorro',
];

function scoreText(text: string): IdeaQuality {
  if (text.length < 80) return 'poor';

  const hasNumber  = /\d/.test(text);
  const lower      = text.toLowerCase();
  const hasKeyword = PAIN_KEYWORDS.some((kw) => lower.includes(kw));

  // Verde: texto largo + número + palabra clave → descripción específica y accionable.
  if (text.length >= 150 && hasNumber && hasKeyword) return 'good';

  // Amarillo: longitud suficiente + al menos una señal semántica.
  if (hasNumber || hasKeyword) return 'acceptable';

  // Texto largo pero sin señales concretas → todavía vago.
  return text.length >= 200 ? 'acceptable' : 'poor';
}

/**
 * Evalúa la calidad semántica de una descripción de idea con debounce.
 * Devuelve 'poor' | 'acceptable' | 'good' basado en longitud, números y keywords de dolor.
 */
export function useIdeaQuality(text: string, delay = 1500): IdeaQuality {
  const [quality, setQuality] = useState<IdeaQuality>('poor');

  useEffect(() => {
    if (!text) { setQuality('poor'); return; }
    const timer = setTimeout(() => setQuality(scoreText(text)), delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  return quality;
}
