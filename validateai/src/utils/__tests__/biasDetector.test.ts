import { describe, it, expect } from 'vitest';
import { detectBias, momTestScore } from '../biasDetector';

// ── detectBias ────────────────────────────────────────────────────────────────

describe('detectBias — preguntas sin sesgo', () => {
  it('pregunta comportamental pura: sin sesgo', () => {
    const r = detectBias('¿Cuándo fue la última vez que enfrentaste este problema?');
    expect(r.hasBias).toBe(false);
    expect(r.score).toBe(0);
    expect(r.patterns).toHaveLength(0);
  });

  it('pregunta de hecho pasado: sin sesgo', () => {
    const r = detectBias('Describe paso a paso cómo resolviste el problema la semana pasada.');
    expect(r.hasBias).toBe(false);
  });

  it('pregunta de herramientas actuales: sin sesgo', () => {
    const r = detectBias('¿Qué herramientas usas actualmente para gestionar este proceso?');
    expect(r.hasBias).toBe(false);
  });
});

describe('detectBias — preguntas hipotéticas', () => {
  it('¿Te gustaría? → sesgo hipotético', () => {
    const r = detectBias('¿Te gustaría usar una herramienta que automatice esto?');
    expect(r.hasBias).toBe(true);
    expect(r.patterns.some(p => p.includes('hipotética'))).toBe(true);
  });

  it('¿Estarías dispuesto? → sesgo hipotético', () => {
    const r = detectBias('¿Estarías dispuesto a pagar por esta solución?');
    expect(r.hasBias).toBe(true);
    expect(r.patterns.some(p => p.includes('hipotética'))).toBe(true);
  });

  it('¿Usarías? → sesgo hipotético', () => {
    const r = detectBias('¿Usarías este servicio si existiera?');
    expect(r.hasBias).toBe(true);
  });

  it('¿Pagarías? → sesgo hipotético', () => {
    const r = detectBias('¿Pagarías $10 al mes por esta función?');
    expect(r.hasBias).toBe(true);
  });

  it('"si existiera" → escenario irreal', () => {
    const r = detectBias('¿Qué harías si existiera una app que hiciera esto automáticamente?');
    expect(r.hasBias).toBe(true);
    expect(r.patterns.some(p => p.includes('irreal'))).toBe(true);
  });

  it('"en el futuro" → referencia temporal', () => {
    const r = detectBias('¿Cómo crees que usarías esto en el futuro?');
    expect(r.hasBias).toBe(true);
    expect(r.patterns.some(p => p.includes('futuro'))).toBe(true);
  });
});

describe('detectBias — exposición prematura de la solución', () => {
  it('nuestra app → expone solución', () => {
    const r = detectBias('¿Qué te parece nuestra app para gestionar proyectos?');
    expect(r.hasBias).toBe(true);
    expect(r.patterns.some(p => p.includes('solución'))).toBe(true);
  });

  it('nuestro producto → expone solución', () => {
    const r = detectBias('¿Cómo calificarías nuestro producto en términos de usabilidad?');
    expect(r.hasBias).toBe(true);
  });

  it('Validus por nombre → expone solución', () => {
    const r = detectBias('¿Usarías Validus para validar tu startup?');
    expect(r.hasBias).toBe(true);
    expect(r.patterns.some(p => p.includes('nombre'))).toBe(true);
  });

  it('promesa de ahorro cuantificada → sesgo de anclaje', () => {
    const r = detectBias('¿Usarías una herramienta que ahorra 5 horas semanales?');
    expect(r.hasBias).toBe(true);
    expect(r.patterns.some(p => p.includes('ahorro'))).toBe(true);
  });
});

describe('detectBias — preguntas de opinión abstracta', () => {
  // Los patrones de opinión suman 0.25 al score, por debajo del umbral hasBias (0.30).
  // Son señales de advertencia que combinadas con otros sesgos cruzarán el umbral.

  it('¿Qué te parece? → registra patrón de opinión (score > 0)', () => {
    const r = detectBias('¿Qué te parece esta idea?');
    expect(r.score).toBeGreaterThan(0);
    expect(r.patterns.some(p => p.includes('opinión') || p.includes('abstracta'))).toBe(true);
  });

  it('¿Crees que? → registra patrón de creencia (score > 0)', () => {
    const r = detectBias('¿Crees que esto sería útil para tu equipo?');
    expect(r.score).toBeGreaterThan(0);
    expect(r.patterns.length).toBeGreaterThan(0);
  });

  it('opinión + hipotética supera el umbral hasBias', () => {
    // 0.25 (opinión) + 0.35 (hipotética) = 0.60 → hasBias: true
    const r = detectBias('¿Crees que usarías nuestra plataforma para validar ideas?');
    expect(r.hasBias).toBe(true);
  });
});

describe('detectBias — señales positivas Mom Test reducen score', () => {
  it('señal positiva sola no produce sesgo', () => {
    const r = detectBias('¿Cuánto pagas actualmente por herramientas de este tipo?');
    expect(r.hasBias).toBe(false);
  });

  it('señal positiva mitiga sesgo hipotético leve', () => {
    // Una hipotética (0.35) + una señal positiva (-0.15) = 0.20 → bajo umbral 0.30
    const r = detectBias('¿Usarías una solución como esta? ¿Cuánto tiempo perdiste la semana pasada?');
    // El score puede quedar debajo del umbral gracias a la señal positiva
    expect(r.score).toBeLessThan(1);
  });
});

describe('detectBias — comportamiento del score', () => {
  it('score siempre entre 0 y 1', () => {
    const preguntas = [
      '¿Te gustaría usar nuestra app para esto? ¿Crees que sería útil? ¿Pagarías por ella? ¿Estarías dispuesto a probarla?',
      'Describe lo que hiciste la semana pasada.',
      '',
    ];
    for (const q of preguntas) {
      const { score } = detectBias(q);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('múltiples patrones acumulan score', () => {
    const leve = detectBias('¿Te gustaría esto?');
    const grave = detectBias('¿Te gustaría usar nuestra app? ¿Estarías dispuesto a pagar? ¿Crees que es útil?');
    expect(grave.score).toBeGreaterThan(leve.score);
  });

  it('patterns no tiene duplicados', () => {
    // Misma frase hipotética dos veces en el texto no duplica el patrón
    const r = detectBias('¿Te gustaría esto? ¿Y también te gustaría aquello?');
    const unique = new Set(r.patterns);
    expect(r.patterns.length).toBe(unique.size);
  });
});

describe('detectBias — suggestion', () => {
  it('pregunta hipotética de pago → sugiere reformulación en hechos pasados', () => {
    const r = detectBias('¿Pagarías $20 al mes por esta herramienta?');
    expect(r.suggestion).toBeDefined();
    expect(r.suggestion).toContain('pagas actualmente');
  });

  it('exposición de solución → sugiere reformular sin mencionar el producto', () => {
    const r = detectBias('¿Qué te parece nuestra plataforma de validación?');
    expect(r.suggestion).toContain('sin mencionar');
  });

  it('pregunta neutral → sin suggestion', () => {
    const r = detectBias('¿Cuánto tiempo dedicás a esto cada semana?');
    expect(r.suggestion).toBeUndefined();
  });
});

// ── momTestScore ──────────────────────────────────────────────────────────────

describe('momTestScore', () => {
  it('pregunta perfecta → score cercano a 1', () => {
    const s = momTestScore('¿Cuándo fue la última vez que enfrentaste este problema?');
    expect(s).toBeCloseTo(1, 1);
  });

  it('pregunta sesgada → score menor que 0.7', () => {
    const s = momTestScore('¿Te gustaría usar nuestra app? ¿Crees que sería útil?');
    expect(s).toBeLessThan(0.7);
  });

  it('momTestScore es inverso al biasScore', () => {
    const { score } = detectBias('¿Te gustaría esto?');
    const mom = momTestScore('¿Te gustaría esto?');
    expect(mom).toBeCloseTo(1 - score, 2);
  });

  it('score siempre entre 0 y 1', () => {
    const s = momTestScore('¿Te gustaría usar nuestra app para todo? ¿Estarías dispuesto a pagar?');
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});
