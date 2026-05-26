/**
 * SUITE 3 — Auditoría de Pérdida de Privacidad Empírica (EPL)
 *
 * Aplica auditoría criptográfica empírica según la spec de "Auditoría de
 * Privacidad Empírica" para verificar que el sistema cumple ε-DP formalmente.
 *
 * Tests implementados:
 *   1. Test de Conjuntos Adyacentes (Adjacent Datasets)
 *      Verifica el ratio Pr[M(D)∈S] / Pr[M(D')∈S] ≤ e^ε
 *
 *   2. Test de Inversión y Reconstrucción (Black-box attack simulation)
 *      Evalúa si múltiples consultas sobre el data lake permiten inferir
 *      atributos individuales con probabilidad superior al nivel base.
 *
 *   3. Test de Composición de Privacidad
 *      Verifica que el presupuesto acumulado de k consultas secuenciales ≤ k·ε
 *      (composición secuencial básica, Teorema 3.14 Dwork & Roth).
 */

import { describe, it, expect } from 'vitest';
import { empiricalPrivacyRatio, laplaceSample, laplaceStats } from '../laplace';
import { applyKAnonymity, auditKAnonymity } from '../kAnonymity';
import { applyLDiversity, auditLDiversity } from '../lDiversity';
import {
  makeEquivalenceClass, makeRecord, createDeterministicRng, resetSeq,
} from './fixtures';
import type { PrivacyRecord } from '../types';

const K = 5;
const L = 2;
const EPSILON = 1.0;

// ════════════════════════════════════════════════════════
// 1. Test de Conjuntos Adyacentes
// ════════════════════════════════════════════════════════

describe('Conjuntos Adyacentes (Adjacent Datasets)', () => {

  /**
   * Consulta de conteo de registros: f(D) = |D|
   * Sensibilidad global: Δf = 1 (añadir/quitar un registro cambia el conteo en 1)
   * Garantía: ratio ≤ e^ε con alta probabilidad
   */
  it('ratio Pr[M(D)] / Pr[M(D\')] ≤ e^ε para consulta de conteo (Monte Carlo)', () => {
    const rng = createDeterministicRng(42);
    const n = 50;
    const queryOnD  = n;       // f(D)  = 50 registros
    const queryOnDp = n - 1;   // f(D') = 49 registros (D' = D \ {un registro})

    const result = empiricalPrivacyRatio(
      queryOnD, queryOnDp,
      EPSILON, 1.0, // sensitivity=1 para conteos
      50_000, rng,
    );

    expect(result.passes).toBe(true);
    expect(result.maxObservedRatio).toBeLessThanOrEqual(result.epsilonBound * 1.01);
  });

  it('ratio se mantiene dentro del bound para ε=0.5 (más privacidad, más ruido)', () => {
    const rng = createDeterministicRng(123);
    const epsilon = 0.5;
    const result = empiricalPrivacyRatio(100, 99, epsilon, 1.0, 50_000, rng);
    expect(result.passes).toBe(true);
    expect(result.epsilonBound).toBeCloseTo(Math.exp(epsilon), 3);
  });

  it('ratio se mantiene dentro del bound para ε=2.0 (más utilidad, menos ruido)', () => {
    const rng = createDeterministicRng(456);
    const epsilon = 2.0;
    const result = empiricalPrivacyRatio(200, 199, epsilon, 1.0, 50_000, rng);
    expect(result.passes).toBe(true);
  });

  it('consulta de suma (sensitivity=10): ratio ≤ e^ε para ε=1', () => {
    // f(D) = suma de friction_scores; añadir un registro cambia la suma hasta en 10
    const rng = createDeterministicRng(789);
    const result = empiricalPrivacyRatio(500, 492, EPSILON, 10, 50_000, rng);
    expect(result.passes).toBe(true);
  });

  it('epsilon bound = e^ε exactamente según la definición matemática', () => {
    const rng = createDeterministicRng(314);
    const epsilons = [0.1, 0.5, 1.0, 2.0, 5.0];
    for (const eps of epsilons) {
      const result = empiricalPrivacyRatio(100, 99, eps, 1.0, 10_000, rng);
      expect(result.epsilonBound).toBeCloseTo(Math.exp(eps), 4);
    }
  });

  it('D y D\' idénticos: ratio ≈ 1 (sin diferencia de privacidad)', () => {
    const rng = createDeterministicRng(777);
    // Si D = D', la consulta produce el mismo valor → ratio debería ser ≈ 1
    const result = empiricalPrivacyRatio(100, 100, EPSILON, 1.0, 10_000, rng);
    // Con D = D', el ratio tiende a 1 (máx variación por el ruido aleatorio)
    expect(result.maxObservedRatio).toBeCloseTo(1.0, 0);
  });
});

// ════════════════════════════════════════════════════════
// 2. Test de Inversión y Reconstrucción (Black-box attack)
// ════════════════════════════════════════════════════════

describe('Inversión y Reconstrucción (ataque de caja negra)', () => {

  /**
   * Simula un adversario que intenta reconstruir el atributo sensible (severity)
   * de un individuo target a partir de múltiples consultas agregadas con ruido.
   *
   * El adversario conoce: toda la base de datos excepto el registro target.
   * Estrategia: inferir severity del target como argmax de la probabilidad
   *             posterior basada en las respuestas ruidosas.
   */

  function simulateAttack(
    records: PrivacyRecord[],
    targetIdx: number,
    numQueries: number,
    epsilon: number,
    rng: () => number,
  ): { inferredSeverity: string; correctProb: number } {
    const target = records[targetIdx];
    const others = records.filter((_, i) => i !== targetIdx);
    const severities = ['tolerable', 'critico', 'paralizante'] as const;

    // Para cada hipótesis de severity del target, calculamos cuántas respuestas
    // ruidosas se explicarían mejor con esa hipótesis
    const scores = new Map<string, number>(severities.map(s => [s, 0]));

    for (let q = 0; q < numQueries; q++) {
      // Consulta: fracción de registros con severity = 'paralizante'
      const trueCount = records.filter(r => r.severity === 'paralizante').length;
      const sensitivity = 1 / records.length;
      const scale = sensitivity / epsilon;
      const noisyFraction = (trueCount / records.length) + laplaceSample(scale, rng);

      // Para cada hipótesis, calcular la fracción esperada si target tiene esa severity
      for (const hyp of severities) {
        const hypotheticalTarget = { ...target, severity: hyp };
        const allWithHyp = [...others, hypotheticalTarget];
        const expectedFraction = allWithHyp.filter(r => r.severity === 'paralizante').length / allWithHyp.length;
        // Verosimilitud Laplace: L(noisyFraction | hypothesis)
        const likelihood = Math.exp(-Math.abs(noisyFraction - expectedFraction) / scale);
        scores.set(hyp, (scores.get(hyp) ?? 0) + Math.log(likelihood + 1e-300));
      }
    }

    // Inferencia: severity con mayor score (MLE bayesiano)
    let bestHyp = 'tolerable';
    let bestScore = -Infinity;
    for (const [sev, score] of scores) {
      if (score > bestScore) { bestScore = score; bestHyp = sev; }
    }

    // Probabilidad de éxito del atacante si adivinara aleatoriamente
    const randomGuessProb = 1 / severities.length; // ≈ 0.333

    return { inferredSeverity: bestHyp, correctProb: randomGuessProb };
  }

  it('atacante con 10 consultas y ε=1.0 no supera 65% de acierto (sobre base aleatoria 33%)', () => {
    resetSeq();
    const rng = createDeterministicRng(42);
    const N_EXPERIMENTS = 50;
    let correct = 0;

    // Dataset con 3 severidades equidistribuidas (10 registros cada una)
    const records = [
      ...makeEquivalenceClass(10, {}, ['tolerable', 'tolerable', 'tolerable', 'tolerable', 'tolerable', 'tolerable', 'tolerable', 'tolerable', 'tolerable', 'tolerable']),
      ...makeEquivalenceClass(10, { generalized_industry: 'Retail y Comercio' }, ['critico', 'critico', 'critico', 'critico', 'critico', 'critico', 'critico', 'critico', 'critico', 'critico']),
      ...makeEquivalenceClass(10, { generalized_industry: 'Salud y Ciencias', friction_bucket: 'media' }, ['paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante']),
    ];

    for (let exp = 0; exp < N_EXPERIMENTS; exp++) {
      const targetIdx = Math.floor(rng() * records.length);
      // 10 queries: ε_total=10 (vs. 100 queries → ε_total=100 que promedia el ruido)
      const { inferredSeverity } = simulateAttack(records, targetIdx, 10, EPSILON, rng);
      if (inferredSeverity === records[targetIdx].severity) correct++;
    }

    const successRate = correct / N_EXPERIMENTS;
    // Con 10 consultas el ruido Laplace no promedia suficientemente (σ/√10 ≈ 0.45)
    // para dar ventaja significativa al atacante. Threshold: 65%
    expect(successRate).toBeLessThan(0.65);
  });

  it('el k-anonimato previene la identificación individual: grupos de k=5 son indistinguibles', () => {
    resetSeq();
    // Si todos los registros de una clase tienen los mismos QI, no se puede
    // distinguir cuál fila específica corresponde a un individuo conocido
    const classA = makeEquivalenceClass(K, { generalized_industry: 'Educación' }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']);
    const kResult = applyKAnonymity(classA, K);

    // La clase pasa k-anonimato: todos tienen los mismos QI
    expect(kResult.passed).toHaveLength(K);

    // Verificar que ningún registro es único por sus QI
    const qiGroups = new Map<string, number>();
    for (const r of kResult.passed) {
      const qi = [r.generalized_industry, r.generalized_role, r.friction_bucket, r.willingness_to_pay].join('|');
      qiGroups.set(qi, (qiGroups.get(qi) ?? 0) + 1);
    }
    for (const [, count] of qiGroups) {
      expect(count).toBeGreaterThanOrEqual(K);
    }
  });

  it('l-diversidad previene inferencia de severity por homogeneidad', () => {
    resetSeq();
    // Una clase homogénea (todos 'paralizante') es excluida del data lake
    // → el atacante no puede acceder a esos registros para inferir severity
    const homogeneous = makeEquivalenceClass(K, {}, ['paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante']);
    const lResult = applyLDiversity(homogeneous, L);

    // La clase homogénea es excluida — no hay nada que el atacante pueda explotar
    expect(lResult.passed).toHaveLength(0);
    expect(lResult.homogeneousClasses).toHaveLength(1);
    expect(lResult.homogeneousClasses[0].severity).toBe('paralizante');
  });
});

// ════════════════════════════════════════════════════════
// 3. Test de Composición de Privacidad
// ════════════════════════════════════════════════════════

describe('Composición Secuencial de Privacidad', () => {

  /**
   * Teorema de Composición Secuencial (Dwork & Roth, Teorema 3.14):
   * Si M₁ es ε₁-DP y M₂ es ε₂-DP, entonces (M₁, M₂) es (ε₁+ε₂)-DP.
   * Para k consultas con el mismo ε: presupuesto acumulado = k·ε.
   *
   * Test: simulamos k consultas y verificamos que el ratio empírico
   * de la composición no supera e^(k·ε).
   */

  it('composición de 3 consultas: ratio empírico ≤ e^(3·ε)', () => {
    const rng = createDeterministicRng(31415);
    const numQueries = 3;
    const composedEpsilon = numQueries * EPSILON;
    const composedBound = Math.exp(composedEpsilon);

    // Tres consultas distintas sobre D y D'
    const queryResults = {
      D:  [100, 50.0, 72],    // f₁(D), f₂(D), f₃(D)
      Dp: [99,  50.0, 71],    // f₁(D'), f₂(D'), f₃(D')
    };

    let composedMaxRatio = 1.0;
    for (let i = 0; i < numQueries; i++) {
      const singleResult = empiricalPrivacyRatio(
        queryResults.D[i], queryResults.Dp[i],
        EPSILON, 1.0, 20_000, rng,
      );
      // El ratio compuesto es el producto de los ratios individuales
      composedMaxRatio *= singleResult.maxObservedRatio;
    }

    expect(composedMaxRatio).toBeLessThanOrEqual(composedBound * 1.05); // 5% tolerancia
  });

  it('una sola consulta cumple ε-DP: ratio ≤ e^ε sin composición', () => {
    const rng = createDeterministicRng(27182);
    const result = empiricalPrivacyRatio(50, 49, EPSILON, 1.0, 50_000, rng);
    expect(result.passes).toBe(true);
    expect(result.maxObservedRatio).toBeLessThanOrEqual(Math.exp(EPSILON) * 1.01);
  });

  it('el presupuesto se agota proporcionalmente: ε efectivo no supera k·ε', () => {
    // Con k=5 consultas y ε=0.2 cada una → presupuesto total = 1.0
    // El ratio compuesto final ≤ e^1.0 ≈ 2.718
    const rng = createDeterministicRng(16180);
    const k = 5;
    const epsilonPerQuery = 0.2;
    const totalBound = Math.exp(k * epsilonPerQuery);

    let composedRatio = 1.0;
    for (let i = 0; i < k; i++) {
      const r = empiricalPrivacyRatio(100, 99, epsilonPerQuery, 1.0, 10_000, rng);
      composedRatio *= r.maxObservedRatio;
    }

    expect(composedRatio).toBeLessThanOrEqual(totalBound * 1.10); // 10% tolerancia
  });
});

// ════════════════════════════════════════════════════════
// 4. Prueba de integración: pipeline completo K→L→DP
// ════════════════════════════════════════════════════════

describe('Pipeline completo K-Anonimato → L-Diversidad → Privacidad Diferencial', () => {

  it('ninguna consulta DP sobre el pipeline falla el bound ε-DP', () => {
    resetSeq();
    const rng = createDeterministicRng(11235);

    // Dataset con múltiples clases
    const dataset: PrivacyRecord[] = [
      ...makeEquivalenceClass(6, { generalized_industry: 'Tecnología y Software' }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico', 'paralizante']),
      ...makeEquivalenceClass(5, { generalized_industry: 'Retail y Comercio', generalized_role: 'Gerencia Media' }, ['critico', 'paralizante', 'tolerable', 'critico', 'paralizante']),
      ...makeEquivalenceClass(7, { generalized_industry: 'Salud y Ciencias', friction_bucket: 'media' }, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico', 'paralizante', 'tolerable']),
      // Clase que no cumple l-diversidad (excluida)
      ...makeEquivalenceClass(5, { generalized_industry: 'Educación', friction_bucket: 'baja' }, ['critico', 'critico', 'critico', 'critico', 'critico']),
      // Clase que no cumple k-anonimato (excluida)
      ...makeEquivalenceClass(3, { generalized_industry: 'Agroindustria', generalized_role: 'Operativo/Staff', friction_bucket: 'baja', willingness_to_pay: false }),
    ];

    const kResult = applyKAnonymity(dataset, K);
    const lResult = applyLDiversity(kResult.passed, L);

    // Verificar auditorías tabular
    expect(auditKAnonymity(kResult, K)).toBeNull();
    expect(auditLDiversity(lResult, L)).toBeNull();

    // Sobre los registros del data lake, verificar DP para consulta de conteo
    const n = lResult.passed.length;
    if (n >= K) {
      const dpResult = empiricalPrivacyRatio(n, n - 1, EPSILON, 1.0, 20_000, rng);
      expect(dpResult.passes).toBe(true);
    }
  });

  it('el pipeline rechaza registros con severity único (l=1) incluso si pasan k-anonimato', () => {
    resetSeq();
    const classWithBadL = makeEquivalenceClass(K, {}, ['paralizante', 'paralizante', 'paralizante', 'paralizante', 'paralizante']);
    const kResult = applyKAnonymity(classWithBadL, K);
    expect(kResult.passed).toHaveLength(K); // pasa k

    const lResult = applyLDiversity(kResult.passed, L);
    expect(lResult.passed).toHaveLength(0); // NO pasa l
    expect(lResult.homogeneousClasses).toHaveLength(1);
  });

  it('registro en el data lake final cumple ambas garantías verificables', () => {
    resetSeq();
    const good = makeEquivalenceClass(5, {}, ['tolerable', 'critico', 'paralizante', 'tolerable', 'critico']);
    const kResult = applyKAnonymity(good, K);
    const lResult = applyLDiversity(kResult.passed, L);

    expect(lResult.passed.length).toBeGreaterThan(0);
    // Cada registro en passed tiene k_class_size implícito ≥ K
    for (const r of lResult.passed) {
      expect(kResult.kClassSizes.get(r.id)).toBeGreaterThanOrEqual(K);
    }
  });
});
