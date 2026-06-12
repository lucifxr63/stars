// Detector de sesgo de validación basado en "The Mom Test" (Rob Fitzpatrick)
// Detecta preguntas hipotéticas, sugestivas y que presentan la solución prematuramente.
// Implementa el "supervisor metodológico" descrito en VALIDUS_CLIENTES.MD.

import type { BiasDetectionResult } from '@/types/survey';

// ── Patrones de lenguaje hipotético/condicional ───────────
const HYPOTHETICAL_PATTERNS = [
  { re: /¿\s*te\s+gustar[íi]a/i,       label: 'Pregunta hipotética ("¿Te gustaría...")' },
  { re: /¿\s*estar[íi]as\s+dispuesto/i, label: 'Pregunta hipotética ("¿Estarías dispuesto...")' },
  { re: /¿\s*usar[íi]as/i,              label: 'Pregunta hipotética ("¿Usarías...")' },
  { re: /¿\s*comprar[íi]as/i,           label: 'Pregunta hipotética ("¿Comprarías...")' },
  { re: /¿\s*considerar[íi]as/i,        label: 'Pregunta hipotética ("¿Considerarías...")' },
  { re: /¿\s*pagar[íi]as/i,             label: 'Pregunta hipotética ("¿Pagarías...")' },
  { re: /¿\s*implementar[íi]as/i,       label: 'Pregunta hipotética ("¿Implementarías...")' },
  { re: /¿\s*te\s+interesar[íi]a/i,     label: 'Pregunta hipotética ("¿Te interesaría...")' },
  { re: /\bsi\s+existiera\b/i,           label: 'Escenario irreal ("si existiera")' },
  { re: /\bsi\s+tuvieras\b/i,            label: 'Escenario irreal ("si tuvieras")' },
  { re: /en\s+el\s+futuro/i,             label: 'Referencia al futuro (evitar en validación)' },
  { re: /\ba\s+futuro\b/i,               label: 'Referencia al futuro (evitar en validación)' },
];

// ── Patrones que presentan la solución prematuramente ─────
const SOLUTION_EXPOSURE_PATTERNS = [
  { re: /nuestra\s+(app|aplicaci[oó]n|plataforma|soluci[oó]n|herramienta|producto)/i, label: 'Presenta la solución propia ("nuestra app/plataforma...")' },
  { re: /nuestro\s+(producto|sistema|servicio|software)/i,                            label: 'Presenta la solución propia ("nuestro producto/sistema...")' },
  { re: /nuestra\s+idea/i,                                                             label: 'Presenta la idea propia ("nuestra idea...")' },
  { re: /\bValidus\b/i,                                                             label: 'Menciona el producto por nombre' },
  { re: /ahorra\s+\d+/i,                                                               label: 'Promesa de ahorro cuantificada (sesgo de anclaje)' },
  { re: /automatizar[áa]\s/i,                                                           label: 'Promesa de automatización (ancla expectativas)' },
];

// ── Patrones de preguntas de opinión abstracta ────────────
const OPINION_PATTERNS = [
  { re: /¿\s*qu[eé]\s+te\s+parece/i,      label: 'Solicita opinión abstracta ("¿Qué te parece?")' },
  { re: /¿\s*(es|ser[íi]a)\s+[uú]til/i,   label: 'Solicita juicio de utilidad abstracta' },
  { re: /¿\s*crees\s+que/i,               label: 'Solicita creencia/opinión ("¿Crees que?")' },
  { re: /¿\s*consideras\s+que/i,          label: 'Solicita opinión ("¿Consideras que?")' },
  { re: /¿\s*(te\s+)?gusta/i,             label: 'Solicita preferencia subjetiva ("¿(Te) gusta?")' },
];

// ── Señales positivas del Mom Test ────────────────────────
// Su presencia reduce el sesgo calculado
const MOM_TEST_POSITIVE = [
  /cu[aá]ndo\s+fue\s+la\s+[uú]ltima\s+vez/i,
  /describ[ei]\s+(el\s+)?paso\s+a\s+paso/i,
  /actualmente/i,
  /la\s+semana\s+pasada/i,
  /el\s+mes\s+pasado/i,
  /[cuá]nto\s+(tiempo|dinero)\s+(perdiste|gastaste|inviertes)/i,
  /qu[eé]\s+herramientas\s+(usas|utilizas)/i,
  /cu[aá]nto\s+pagas/i,
  /nombra\s+los/i,
  /muéstrame/i,
];

export function detectBias(questionText: string): BiasDetectionResult {
  const patterns: string[] = [];
  let biasScore = 0;

  for (const p of HYPOTHETICAL_PATTERNS) {
    if (p.re.test(questionText)) {
      patterns.push(p.label);
      biasScore += 0.35;
    }
  }

  for (const p of SOLUTION_EXPOSURE_PATTERNS) {
    if (p.re.test(questionText)) {
      patterns.push(p.label);
      biasScore += 0.4;
    }
  }

  for (const p of OPINION_PATTERNS) {
    if (p.re.test(questionText)) {
      patterns.push(p.label);
      biasScore += 0.25;
    }
  }

  // Señales positivas reducen el sesgo
  for (const re of MOM_TEST_POSITIVE) {
    if (re.test(questionText)) biasScore -= 0.15;
  }

  const score = Math.max(0, Math.min(1, biasScore));
  const hasBias = score >= 0.3;

  return {
    hasBias,
    score,
    patterns: [...new Set(patterns)],
    suggestion: hasBias ? buildSuggestion(questionText, patterns) : undefined,
  };
}

// Genera una sugerencia concreta de reformulación
function buildSuggestion(text: string, detectedPatterns: string[]): string {
  const isHypothetical = detectedPatterns.some(p => p.includes('hipotética'));
  const exposesSolution = detectedPatterns.some(p => p.includes('solución'));
  const isOpinion = detectedPatterns.some(p => p.includes('opinión') || p.includes('abstracta') || p.includes('juicio'));

  if (exposesSolution) {
    return 'Reformula sin mencionar tu producto. Ej: "Describe cómo resuelves actualmente este problema paso a paso."';
  }
  if (isHypothetical && text.toLowerCase().includes('pagar')) {
    return 'Reformula en hechos pasados. Ej: "¿Qué herramientas pagas actualmente para esto y cuánto te cuestan al mes?"';
  }
  if (isHypothetical) {
    return 'Reformula en pasado. Ej: "Describe la última vez que enfrentaste este problema. ¿Qué hiciste exactamente?"';
  }
  if (isOpinion) {
    return 'Reformula para explorar comportamientos. Ej: "Nombra los 3 desafíos que más tiempo o dinero te consumen actualmente."';
  }
  return 'Reformula la pregunta para hablar de hechos pasados del encuestado, no de hipótesis o tu solución.';
}

// Convierte bias score a puntuación Mom Test (invertido, para mostrar en UI)
export function momTestScore(questionText: string): number {
  const { score } = detectBias(questionText);
  return parseFloat((1 - score).toFixed(2));
}
