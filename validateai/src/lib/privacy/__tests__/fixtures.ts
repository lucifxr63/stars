// Fixtures y factory functions compartidas por las tres suites de tests.
// Siguen el patrón descrito en la spec de Auditoría de Privacidad Empírica.

import type { PrivacyRecord, Severity, FrictionBucket } from '../types';

let _seq = 0;
export function resetSeq() { _seq = 0; }

/** Crea un PrivacyRecord con valores por defecto sobreescribibles */
export function makeRecord(overrides: Partial<PrivacyRecord> = {}): PrivacyRecord {
  const id = `rec_${String(++_seq).padStart(4, '0')}`;
  return {
    id,
    generalized_industry: 'Tecnología y Software',
    generalized_role: 'Fundador/Dueño',
    friction_bucket: 'alta' as FrictionBucket,
    willingness_to_pay: true,
    severity: 'critico' as Severity,
    central_problem: 'Problema de prueba',
    current_solutions: ['Excel', 'Email'],
    key_quotes: [],
    mom_test_signals: { talks_about_past: true, mentions_money_spent: false, reveals_workarounds: true },
    week_bucket: '2026-W21',
    ...overrides,
  };
}

/**
 * Genera n registros con los mismos cuasi-identificadores (misma clase de equivalencia).
 * Útil para construir clases de tamaño exacto k.
 */
export function makeEquivalenceClass(
  n: number,
  qi: Partial<PrivacyRecord> = {},
  severities?: Severity[],
): PrivacyRecord[] {
  return Array.from({ length: n }, (_, i) =>
    makeRecord({
      ...qi,
      severity: severities ? severities[i % severities.length] : 'critico',
    }),
  );
}

/**
 * Crea un outlier hiperespecífico que NO puede alcanzar k=5 por sí solo.
 * Representa un cargo hiperespecífico ("Ingeniero Aeroespacial Senior, Zona Rural").
 */
export function makeOutlier(overrides: Partial<PrivacyRecord> = {}): PrivacyRecord {
  return makeRecord({
    generalized_industry: 'Manufactura e Industria',
    generalized_role: 'Dirección C-Level',
    friction_bucket: 'baja',
    willingness_to_pay: false,
    severity: 'tolerable',
    ...overrides,
  });
}

/**
 * PRNG determinista (LCG) para tests del mecanismo de Laplace.
 * Garantiza reproducibilidad entre ejecuciones.
 * Algoritmo: LCG con parámetros de Numerical Recipes.
 */
export function createDeterministicRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Dataset D: base de datos de referencia con n registros */
export function makeDatasetD(n: number, queryFn: (records: PrivacyRecord[]) => number): number {
  const records = makeEquivalenceClass(n, {}, ['tolerable', 'critico', 'paralizante']);
  return queryFn(records);
}

/** Dataset D': idéntico a D pero con el último registro modificado en severity */
export function makeDatasetDprime(n: number, queryFn: (records: PrivacyRecord[]) => number): number {
  const records = makeEquivalenceClass(n, {}, ['tolerable', 'critico', 'paralizante']);
  // Modificar el último registro — D y D' difieren en exactamente 1 elemento
  records[records.length - 1] = makeRecord({ severity: 'paralizante', willingness_to_pay: false });
  return queryFn(records);
}
