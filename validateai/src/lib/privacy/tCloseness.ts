// T-Closeness — tercera capa del pipeline de privacidad tabular.
// Referencia: Li et al. (2007) "t-Closeness: Privacy Beyond k-Anonymity and l-Diversity"
//
// Neutraliza dos vectores de ataque residuales tras k-anonimato y l-diversidad:
//   - Ataque de sesgo (skewness): una clase con l-diversidad puede sobre-representar
//     una categoría rara globalmente, multiplicando el riesgo de inferencia.
//   - Ataque de similitud: valores semánticamente próximos dentro de una clase permiten
//     inferencia precisa aunque sean formalmente distintos.
//
// Garantía: la distribución local de severity en cada clase no puede distar más de t
// de la distribución global, medida con Earth Mover's Distance (Wasserstein-1) 1D.

import type { PrivacyRecord, TClosenessResult } from './types';
import { qiKey } from './kAnonymity';

// Orden canónico de severidades para el algoritmo EMD lineal.
// El orden importa: la EMD 1D asigna coste unitario entre categorías adyacentes.
export const SEVERITY_ORDER = ['tolerable', 'critico', 'paralizante'] as const;
type SeverityLabel = typeof SEVERITY_ORDER[number];

/**
 * Earth Mover's Distance (Wasserstein-1) para distribuciones discretas unidimensionales
 * ordenadas. Algoritmo de acumulación iterativa de diferencias de CDF — O(n).
 *
 * Para distribuciones P y Q sobre n categorías ordenadas:
 *   w₀ = 0
 *   wᵢ = p_{i-1} - q_{i-1} + w_{i-1}
 *   EMD = Σ |wᵢ|
 *
 * La EMD es simétrica y vale 0 sii P = Q.
 * Para 3 categorías, el máximo teórico es 2 (distribuciones antipodales: [1,0,0] vs [0,0,1]).
 */
export function calculate1D_EMD(p: number[], q: number[]): number {
  if (p.length !== q.length) {
    throw new RangeError(`p and q must have equal length, got ${p.length} vs ${q.length}`);
  }
  let w = 0;
  let emd = 0;
  for (let i = 0; i < p.length; i++) {
    w = p[i] - q[i] + w;
    emd += Math.abs(w);
  }
  return emd;
}

/** Convierte un array de PrivacyRecord a vector de frecuencias relativas en orden SEVERITY_ORDER. */
export function toFrequencyVector(records: PrivacyRecord[]): number[] {
  const counts = new Array<number>(SEVERITY_ORDER.length).fill(0);
  for (const r of records) {
    const idx = SEVERITY_ORDER.indexOf(r.severity as SeverityLabel);
    if (idx >= 0) counts[idx]++;
  }
  const total = records.length || 1;
  return counts.map(c => c / total);
}

/**
 * Aplica t-closeness a un conjunto de registros ya procesados por k-anonimato y l-diversidad.
 *
 * Una clase de equivalencia (agrupada por QI) pasa si:
 *   EMD(distribución_local_severity, distribución_global_severity) ≤ t
 *
 * @param records      Registros a evaluar
 * @param t            Umbral de tolerancia EMD (debe ser > 0; valor típico: 0.20)
 * @param globalDist   Vector de frecuencias globales de referencia (opcional).
 *                     Si no se provee, se calcula automáticamente de `records`.
 *                     En producción, pasar la distribución histórica acumulada del
 *                     data lake para evitar que clases sesgadas contaminen la referencia.
 */
export function applyTCloseness(
  records: PrivacyRecord[],
  t: number,
  globalDist?: number[],
): TClosenessResult {
  if (t <= 0) throw new RangeError(`t must be > 0, got ${t}`);
  if (records.length === 0) {
    return { passed: [], violatingClasses: [], tScoreByClass: new Map() };
  }

  const Q = globalDist ?? toFrequencyVector(records);

  const classes = new Map<string, PrivacyRecord[]>();
  for (const r of records) {
    const key = qiKey(r);
    const g = classes.get(key) ?? [];
    g.push(r);
    classes.set(key, g);
  }

  const passed: PrivacyRecord[] = [];
  const violatingClasses: TClosenessResult['violatingClasses'] = [];
  const tScoreByClass = new Map<string, number>();

  for (const [key, group] of classes) {
    const P = toFrequencyVector(group);
    const emd = calculate1D_EMD(P, Q);

    for (const r of group) tScoreByClass.set(r.id, emd);

    if (emd <= t) {
      passed.push(...group);
    } else {
      violatingClasses.push({ key, emd, tBound: t, count: group.length });
    }
  }

  return { passed, violatingClasses, tScoreByClass };
}

/**
 * Audita el resultado de t-closeness verificando que ningún registro en `passed`
 * tenga EMD > t (lo que indicaría un bug en la implementación).
 * Retorna null si el resultado es válido, o un mensaje descriptivo del fallo.
 */
export function auditTCloseness(result: TClosenessResult, t: number): string | null {
  for (const r of result.passed) {
    const score = result.tScoreByClass.get(r.id);
    if (score === undefined || score > t) {
      return `VIOLATION: record ${r.id} in passed has EMD=${score?.toFixed(4)} > t=${t}`;
    }
  }
  return null;
}
