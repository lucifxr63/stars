/**
 * SUITE 2 — Mecanismo Estocástico
 * Tests estadísticos del Mecanismo de Laplace y la inmunidad al post-procesamiento.
 *
 * Las pruebas de igualdad estricta (toBe) fallarían por la naturaleza probabilística
 * del mecanismo. Esta suite usa tests de propiedades estadísticas:
 *   - Distribución empírica vs. distribución teórica (varianza, media, CDF)
 *   - Inmunidad al post-procesamiento (clamping ocurre DESPUÉS del ruido)
 *   - Bounds de la escala b = sensitivity / ε
 */

import { describe, it, expect } from 'vitest';
import { laplaceSample, addLaplaceNoise, laplaceStats } from '../laplace';
import { createDeterministicRng } from './fixtures';

// Tolerancias para tests estadísticos (con N=10_000 muestras)
const N = 10_000;
const MEAN_TOLERANCE    = 0.05;  // media empírica dentro de ±0.05 de 0
const VARIANCE_RELATIVE = 0.08;  // varianza empírica dentro de ±8% de la teórica
const KS_CRITICAL       = 1.628; // valor crítico de Kolmogorov-Smirnov α=0.01

// ── Helpers estadísticos ─────────────────────────────────

function computeMean(samples: number[]): number {
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

function computeVariance(samples: number[]): number {
  const mean = computeMean(samples);
  return samples.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (samples.length - 1);
}

/** Test de Kolmogorov-Smirnov para distribución de Laplace */
function ksStatistic(samples: number[], scale: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  let maxDiff = 0;
  for (let i = 0; i < n; i++) {
    // CDF teórica: F(x) = 0.5 + 0.5·sign(x)·(1 - e^(-|x|/b))
    const cdfTheoretical = 0.5 + 0.5 * Math.sign(sorted[i]) * (1 - Math.exp(-Math.abs(sorted[i]) / scale));
    const cdfEmpirical   = (i + 1) / n;
    maxDiff = Math.max(maxDiff, Math.abs(cdfEmpirical - cdfTheoretical));
  }
  return maxDiff * Math.sqrt(n);
}

// ════════════════════════════════════════════════════════
// 1. Propiedades de la distribución de Laplace
// ════════════════════════════════════════════════════════

describe('Distribución de Laplace', () => {

  it('media empírica ≈ 0 (bias cero del mecanismo)', () => {
    const rng = createDeterministicRng(1337);
    const samples = Array.from({ length: N }, () => laplaceSample(1.0, rng));
    const mean = computeMean(samples);
    expect(Math.abs(mean)).toBeLessThan(MEAN_TOLERANCE);
  });

  it('varianza empírica ≈ 2b² para b=1 (σ²=2)', () => {
    const b = 1.0;
    const rng = createDeterministicRng(2023);
    const samples = Array.from({ length: N }, () => laplaceSample(b, rng));
    const empVar = computeVariance(samples);
    const theoVar = laplaceStats(1.0, 1.0).variance; // 2b² = 2
    const relError = Math.abs(empVar - theoVar) / theoVar;
    expect(relError).toBeLessThan(VARIANCE_RELATIVE);
  });

  it('varianza escala correctamente con b (2b²): prueba con b=2 y b=0.5', () => {
    const rng1 = createDeterministicRng(111);
    const rng2 = createDeterministicRng(222);

    const s1 = Array.from({ length: N }, () => laplaceSample(2.0, rng1));
    const s2 = Array.from({ length: N }, () => laplaceSample(0.5, rng2));

    const v1 = computeVariance(s1);
    const v2 = computeVariance(s2);

    // Ratio de varianzas debe ser ≈ (b1/b2)² = (2/0.5)² = 16
    const ratio = v1 / v2;
    expect(ratio).toBeGreaterThan(16 * (1 - VARIANCE_RELATIVE));
    expect(ratio).toBeLessThan(16 * (1 + VARIANCE_RELATIVE));
  });

  it('test KS: distribución empírica ajusta a Laplace teórica (α=0.01)', () => {
    // KS estadístico D·√n < 1.628 para aceptar H₀ (la muestra sigue Laplace)
    const b = 1.5;
    const rng = createDeterministicRng(9999);
    const samples = Array.from({ length: N }, () => laplaceSample(b, rng));
    const ks = ksStatistic(samples, b);
    expect(ks).toBeLessThan(KS_CRITICAL);
  });

  it('laplaceSample lanza error si scale ≤ 0', () => {
    expect(() => laplaceSample(0)).toThrowError(RangeError);
    expect(() => laplaceSample(-1)).toThrowError(RangeError);
  });

  it('escala b = sensitivity/epsilon: prueba con ε=0.5 implica 2x más ruido que ε=1.0', () => {
    const sensitivity = 1.0;
    const rng1 = createDeterministicRng(555);
    const rng2 = createDeterministicRng(666);

    const s1 = Array.from({ length: N }, () => addLaplaceNoise(0, sensitivity, 1.0, -Infinity, Infinity, rng1));
    const s2 = Array.from({ length: N }, () => addLaplaceNoise(0, sensitivity, 0.5, -Infinity, Infinity, rng2));

    const v1 = computeVariance(s1);
    const v2 = computeVariance(s2);

    // b₂ = 1/0.5 = 2 = 2·b₁, entonces Var₂ = 4·Var₁
    const ratio = v2 / v1;
    expect(ratio).toBeGreaterThan(4 * (1 - VARIANCE_RELATIVE));
    expect(ratio).toBeLessThan(4 * (1 + VARIANCE_RELATIVE));
  });

  it('laplaceStats retorna valores teóricos correctos', () => {
    const stats = laplaceStats(1.0, 2.0); // sensitivity=1, ε=2 → b=0.5
    expect(stats.scale).toBeCloseTo(0.5, 5);
    expect(stats.mean).toBe(0);
    expect(stats.variance).toBeCloseTo(2 * 0.5 * 0.5, 5);
    expect(stats.stdDev).toBeCloseTo(0.5 * Math.sqrt(2), 5);
  });
});

// ════════════════════════════════════════════════════════
// 2. Inmunidad al post-procesamiento (clamping)
// ════════════════════════════════════════════════════════

describe('Inmunidad al post-procesamiento', () => {

  /**
   * El Post-Processing Theorem (Proposición 2.1, Dwork & Roth 2014) establece:
   * cualquier función determinista f aplicada sobre la salida de M(D) produce
   * un mecanismo igualmente ε-DP. Por lo tanto, el clamping NO amplifica ε.
   *
   * Tests verifican que:
   *   a) El ruido se añade ANTES del clamping
   *   b) El clamping nunca devuelve valores fuera del rango semántico
   *   c) La distribución del ruido NO cambia por el clamping (para valores centrales)
   */

  it('addLaplaceNoise aplica clamping DESPUÉS del ruido (verificación de orden)', () => {
    // Con min=0 y value=0, sin ruido (scale→0) el resultado es 0
    // Con ruido negativo, el clamping devuelve 0 (no el valor negativo)
    // Verificamos que NUNCA se devuelve un valor < min
    const rng = createDeterministicRng(777);
    const min = 1.0;
    const max = 10.0;
    const samples = Array.from({ length: 500 }, () =>
      addLaplaceNoise(5.0, 1.0, 1.0, min, max, rng)
    );
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(min);
      expect(s).toBeLessThanOrEqual(max);
    }
  });

  it('clamping nunca produce valores fuera del rango semántico [1, 10] para friction_score', () => {
    const rng = createDeterministicRng(888);
    // friction_score extremo: 10 + mucho ruido positivo → debe clampear a 10
    const samples = Array.from({ length: 1000 }, () =>
      addLaplaceNoise(10.0, 100.0, 0.01, 1, 10, rng) // ε muy bajo → ruido enorme
    );
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(10);
    }
  });

  it('con value=5 y rango [1,10], el ruido no altera la media para ruido pequeño', () => {
    // Para ε alto (poco ruido), la media con clamping ≈ valor original
    const rng = createDeterministicRng(999);
    const samples = Array.from({ length: N }, () =>
      addLaplaceNoise(5.0, 1.0, 10.0, 1, 10, rng) // ε=10 → b=0.1 → ruido muy pequeño
    );
    const mean = computeMean(samples);
    // Con poco ruido y clamping simétrico alrededor del centro, la media ≈ 5
    expect(Math.abs(mean - 5.0)).toBeLessThan(0.1);
  });

  it('clamping con min=-Infinity, max=Infinity preserva la distribución Laplace original', () => {
    const b = 2.0;
    const rng1 = createDeterministicRng(101);
    const rng2 = createDeterministicRng(101); // mismo seed → misma secuencia

    const withClamping    = Array.from({ length: N }, () => addLaplaceNoise(0, b, 1.0, -Infinity, Infinity, rng1));
    const withoutClamping = Array.from({ length: N }, () => laplaceSample(b, rng2));

    // Con mismo seed y sin clamping efectivo, ambas distribuciones son idénticas
    const meanWithC    = computeMean(withClamping);
    const meanWithoutC = computeMean(withoutClamping);
    expect(Math.abs(meanWithC - meanWithoutC)).toBeLessThan(0.01);

    const varWithC    = computeVariance(withClamping);
    const varWithoutC = computeVariance(withoutClamping);
    expect(Math.abs(varWithC - varWithoutC)).toBeLessThan(0.01);
  });

  it('addLaplaceNoise lanza RangeError para epsilon ≤ 0', () => {
    expect(() => addLaplaceNoise(5, 1, 0)).toThrowError(RangeError);
    expect(() => addLaplaceNoise(5, 1, -0.5)).toThrowError(RangeError);
  });

  it('addLaplaceNoise lanza RangeError para sensitivity < 0', () => {
    expect(() => addLaplaceNoise(5, -1, 1)).toThrowError(RangeError);
  });

  it('sensitivity=0 produce cero ruido (consulta constante no necesita protección)', () => {
    // sensitivity=0 → scale=0 → laplaceSample lanza RangeError
    // Protección correcta: la función debe detectar esto antes de llamar laplaceSample
    // Con sensitivity=0 el resultado debería ser el valor sin ruido
    // Verificamos que la implementación es determinista en este caso límite
    expect(() => addLaplaceNoise(5, 0, 1)).not.toThrow();
    const result = addLaplaceNoise(5, 0, 1);
    expect(result).toBe(5); // sin ruido porque sensitivity=0
  });
});

// ════════════════════════════════════════════════════════
// 3. Propiedades del intervalo de confianza (CI95)
// ════════════════════════════════════════════════════════

describe('Intervalo de confianza Laplace', () => {

  it('CI95 = b·ln(20) captura ≥ 95% de las muestras empíricas', () => {
    const b = 1.0;
    const stats = laplaceStats(1.0, 1.0);
    const ci = stats.ci95;
    const rng = createDeterministicRng(2024);
    const samples = Array.from({ length: N }, () => laplaceSample(b, rng));
    const inCI = samples.filter(s => Math.abs(s) <= ci).length;
    const pct = inCI / N;
    expect(pct).toBeGreaterThanOrEqual(0.94); // tolerancia ±1%
  });

  it('CI95 escala linealmente con b: CI95(b=2) = 2·CI95(b=1)', () => {
    const ci1 = laplaceStats(1.0, 1.0).ci95;
    const ci2 = laplaceStats(2.0, 1.0).ci95;
    expect(ci2 / ci1).toBeCloseTo(2.0, 3);
  });
});
