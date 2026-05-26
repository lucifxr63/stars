// Mecanismo de Laplace para Privacidad Diferencial
// Extracción pura para testing con Vitest.
// Fuente matemática: Dwork & Roth, "The Algorithmic Foundations of DP" (2014)

/**
 * Genera una muestra de la distribución de Laplace (media=0, escala=b)
 * mediante la transformada inversa de la CDF:
 *
 *   F(x) = 1/2 + 1/2 · sign(x) · (1 - e^(-|x|/b))
 *
 * Invirtiendo:  X = -b · sign(U) · ln(1 - 2|U|)
 * donde U ~ Uniform(-0.5, 0.5)
 *
 * @param scale  Parámetro de escala b = sensitivity / epsilon
 * @param rng    Generador de aleatoriedad inyectable (por defecto: Math.random).
 *               Para tests: pasa un PRNG determinista.
 */
export function laplaceSample(scale: number, rng: () => number = Math.random): number {
  if (scale <= 0) throw new RangeError(`scale must be > 0, got ${scale}`);
  const u = rng() - 0.5;
  // Evitar ln(0) cuando |u| === 0.5 (extremadamente improbable pero defensivo)
  const safeU = Math.abs(u) === 0.5 ? Math.sign(u) * 0.4999 : u;
  return -scale * Math.sign(safeU) * Math.log(1 - 2 * Math.abs(safeU));
}

/**
 * Añade ruido de Laplace a un valor real y aplica clamping semántico.
 * El clamping ocurre DESPUÉS de la adición de ruido (invariante de post-procesamiento).
 *
 * Post-processing immunity: cualquier función determinista aplicada sobre la
 * salida de un mecanismo ε-DP produce un mecanismo ε-DP (Proposición 2.1, Dwork & Roth).
 * Por lo tanto, el clamping no altera la garantía ε-DP original.
 *
 * @param value        Valor real de la consulta (pre-ruido)
 * @param sensitivity  Sensibilidad global Δf de la consulta
 * @param epsilon      Presupuesto de privacidad ε
 * @param min          Límite inferior semántico para clamping
 * @param max          Límite superior semántico para clamping
 * @param rng          PRNG inyectable para tests deterministas
 */
export function addLaplaceNoise(
  value: number,
  sensitivity: number,
  epsilon: number,
  min = -Infinity,
  max = Infinity,
  rng: () => number = Math.random,
): number {
  if (epsilon <= 0) throw new RangeError(`epsilon must be > 0, got ${epsilon}`);
  if (sensitivity < 0) throw new RangeError(`sensitivity must be ≥ 0, got ${sensitivity}`);

  // sensitivity=0 → consulta constante, no necesita ruido (inmune por definición)
  if (sensitivity === 0) return Math.max(min, Math.min(max, value));

  const scale = sensitivity / epsilon;
  const noisyValue = value + laplaceSample(scale, rng);

  // Post-procesamiento determinista — no rompe la garantía ε-DP
  return Math.max(min, Math.min(max, noisyValue));
}

/**
 * Parámetros teóricos de la distribución de Laplace.
 * Útiles para tests estadísticos de validación del mecanismo.
 */
export function laplaceStats(sensitivity: number, epsilon: number) {
  const scale = sensitivity / epsilon; // b
  return {
    scale,
    mean: 0,
    variance: 2 * scale * scale,     // Var[Laplace(0,b)] = 2b²
    stdDev: scale * Math.sqrt(2),    // σ = b√2
    // Intervalo de confianza 95% (CDF inversa bilateral)
    ci95: scale * Math.log(20),      // P(|X| ≤ t) = 1 - e^(-t/b) → t = b·ln(20) ≈ 3b
  };
}

/**
 * Prueba empírica del ratio de privacidad entre dos consultas sobre bases
 * de datos adyacentes D y D' (difieren en exactamente 1 registro).
 *
 * Garantía ε-DP: Para cualquier salida S,
 *   Pr[M(D) ∈ S] / Pr[M(D') ∈ S] ≤ e^ε
 *
 * @param queryOnD   Resultado real de la consulta sobre D
 * @param queryOnDp  Resultado real de la consulta sobre D' (D con 1 registro diferente)
 * @param epsilon    Presupuesto de privacidad declarado
 * @param sensitivity Sensibilidad global de la consulta
 * @param trials     Número de muestras de Monte Carlo
 * @param rng        PRNG inyectable
 * @returns          { maxObservedRatio, epsilonBound, passes }
 */
export function empiricalPrivacyRatio(
  queryOnD: number,
  queryOnDp: number,
  epsilon: number,
  sensitivity: number,
  trials = 10_000,
  rng: () => number = Math.random,
): { maxObservedRatio: number; epsilonBound: number; passes: boolean } {
  const scale = sensitivity / epsilon;
  let maxRatio = 0;

  for (let i = 0; i < trials; i++) {
    const noise = laplaceSample(scale, rng);
    // Probabilidad de obtener exactamente (queryOnD + noise) dada D
    const pD  = (1 / (2 * scale)) * Math.exp(-Math.abs(queryOnD  + noise) / scale);
    // Probabilidad de obtener exactamente (queryOnD + noise) dada D'
    const pDp = (1 / (2 * scale)) * Math.exp(-Math.abs(queryOnDp + noise) / scale);

    if (pDp > 0) {
      const ratio = pD / pDp;
      if (ratio > maxRatio) maxRatio = ratio;
    }
  }

  const epsilonBound = Math.exp(epsilon);
  // Tolerancia numérica del 1% sobre el bound teórico
  const passes = maxRatio <= epsilonBound * 1.01;

  return { maxObservedRatio: maxRatio, epsilonBound, passes };
}
