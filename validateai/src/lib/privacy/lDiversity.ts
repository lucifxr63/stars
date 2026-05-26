// Algoritmo de L-Diversidad para el data lake de encuestas
// Extracción pura (sin dependencias Deno/Supabase) para testing con Vitest.

import type { PrivacyRecord, LDiversityResult, Severity } from './types';
import { qiKey } from './kAnonymity';

/**
 * Aplica L-Diversidad sobre registros que ya pasaron K-Anonimato.
 *
 * Atributo sensible: severity (tolerable | critico | paralizante).
 * Restricción: dentro de cada clase de equivalencia debe haber ≥ l
 * valores DISTINTOS de severity.
 *
 * Cuando falla (homogeneidad):
 *   - La clase completa se excluye del data lake.
 *   - Se registra en homogeneousClasses para logging y auditoría.
 *
 * @param records  Registros que superaron k-anonimato
 * @param l        Umbral de l-diversidad (mínimo: 2, default: 2)
 */
export function applyLDiversity(records: PrivacyRecord[], l: number): LDiversityResult {
  if (l < 2) throw new RangeError(`l must be ≥ 2, got ${l}`);

  const passed: PrivacyRecord[] = [];
  const homogeneousClasses: LDiversityResult['homogeneousClasses'] = [];
  const lScoreByClass = new Map<string, number>();

  const groups = new Map<string, PrivacyRecord[]>();
  for (const r of records) {
    const key = qiKey(r);
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  for (const [key, group] of groups) {
    const distinctSeverities = new Set(group.map(r => r.severity));
    const lScore = distinctSeverities.size;

    for (const r of group) lScoreByClass.set(r.id, lScore);

    if (lScore >= l) {
      passed.push(...group);
    } else {
      // Homogeneidad detectada — clase completa excluida del data lake
      const dominantSeverity = [...distinctSeverities][0];
      homogeneousClasses.push({
        key,
        severity: dominantSeverity as Severity,
        count: group.length,
      });
    }
  }

  return { passed, homogeneousClasses, lScoreByClass };
}

/**
 * Audita formalmente que cada clase de equivalencia cumpla l-diversidad.
 * Retorna null si es válido, o descripción del primer fallo.
 */
export function auditLDiversity(result: LDiversityResult, l: number): string | null {
  const groups = new Map<string, Set<Severity>>();
  for (const r of result.passed) {
    const key = qiKey(r);
    const s = groups.get(key) ?? new Set<Severity>();
    s.add(r.severity);
    groups.set(key, s);
  }

  for (const [key, severities] of groups) {
    if (severities.size < l) {
      return `VIOLATION: class "${key}" has l-score=${severities.size} < l=${l} (severities: ${[...severities].join(', ')})`;
    }
  }

  // Verificar que las clases homogéneas registradas no están en passed
  const passedIds = new Set(result.passed.map(r => r.id));
  for (const hc of result.homogeneousClasses) {
    // Reconstruir los ids de la clase — si alguno está en passed, es un bug
    const classRecords = result.passed.filter(r => qiKey(r) === hc.key);
    if (classRecords.length > 0) {
      return `LEAK: homogeneous class "${hc.key}" has records in passed set (${classRecords.map(r => r.id).join(', ')})`;
    }
  }

  void passedIds; // silence unused warning
  return null;
}
