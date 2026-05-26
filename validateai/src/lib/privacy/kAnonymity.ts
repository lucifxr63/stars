// Algoritmo de K-Anonimato para el data lake de encuestas
// Extracción pura (sin dependencias Deno/Supabase) para testing con Vitest.

import type { PrivacyRecord, KAnonymityResult } from './types';

// Clave canónica de cuasi-identificadores para agrupar registros
export function qiKey(r: PrivacyRecord, suppressIndustry = false): string {
  return [
    suppressIndustry ? '__NULL__' : (r.generalized_industry ?? '__NULL__'),
    r.generalized_role ?? '__NULL__',
    r.friction_bucket,
    r.willingness_to_pay ? '1' : '0',
  ].join('||');
}

/**
 * Aplica K-Anonimato a un conjunto de registros.
 *
 * Estrategia de supresión en dos niveles:
 *   1. Supresión de atributo: si la clase no alcanza k, se nulifica
 *      generalized_industry (el cuasi-identificador más específico) y se
 *      intenta fusionar con la clase reducida.
 *   2. Supresión de registro: si aún no alcanza k, el registro queda fuera
 *      del data lake (pero no se elimina de survey_submissions).
 *
 * @param records  Registros generalizados semánticamente por el LLM
 * @param k        Umbral de k-anonimato (mínimo: 3, default: 5)
 */
export function applyKAnonymity(records: PrivacyRecord[], k: number): KAnonymityResult {
  if (k < 2) throw new RangeError(`k must be ≥ 2, got ${k}`);

  const passed: PrivacyRecord[] = [];
  const suppressed: PrivacyRecord[] = [];
  const attributeSuppressed: PrivacyRecord[] = [];
  const kClassSizes = new Map<string, number>();

  // Primera pasada: agrupa por cuasi-identificadores completos
  const groups = new Map<string, PrivacyRecord[]>();
  for (const r of records) {
    const key = qiKey(r);
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  // Segunda pasada: construye grupos reducidos (sin industry) para la fusión
  const reducedGroups = new Map<string, PrivacyRecord[]>();
  for (const [, group] of groups) {
    for (const r of group) {
      const rKey = qiKey(r, true);
      const rg = reducedGroups.get(rKey) ?? [];
      rg.push({ ...r, generalized_industry: null });
      reducedGroups.set(rKey, rg);
    }
  }

  const processedKeys = new Set<string>();

  for (const [key, group] of groups) {
    if (processedKeys.has(key)) continue;

    if (group.length >= k) {
      // Clase válida sin necesidad de supresión
      for (const r of group) kClassSizes.set(r.id, group.length);
      passed.push(...group);
    } else {
      // Intentar supresión selectiva de atributo (industry → null)
      const reducedKey = qiKey(group[0], true);
      const mergedGroup = reducedGroups.get(reducedKey) ?? [];

      if (mergedGroup.length >= k) {
        // Fusión exitosa — incluir con industry suprimida
        for (const r of mergedGroup) {
          kClassSizes.set(r.id, mergedGroup.length);
          attributeSuppressed.push(r);
        }
        passed.push(...mergedGroup);

        // Marcar todas las claves originales que contribuyeron a esta fusión como procesadas
        for (const r of mergedGroup) processedKeys.add(qiKey({ ...r, generalized_industry: r.generalized_industry }, false));
      } else {
        // Supresión total de registro — excluir del data lake
        suppressed.push(...group);
      }
    }

    processedKeys.add(key);
  }

  return { passed, kClassSizes, suppressed, attributeSuppressed };
}

/**
 * Verifica que un resultado de k-anonimato cumple la garantía formalmente.
 * Retorna null si es válido, o un mensaje descriptivo del primer fallo encontrado.
 */
export function auditKAnonymity(result: KAnonymityResult, k: number): string | null {
  // Re-agrupar los registros que pasaron
  const groups = new Map<string, PrivacyRecord[]>();
  for (const r of result.passed) {
    const key = qiKey(r);
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  for (const [key, group] of groups) {
    if (group.length < k) {
      return `VIOLATION: equivalence class "${key}" has size ${group.length} < k=${k}`;
    }
    // Verificar consistencia con kClassSizes
    for (const r of group) {
      const recorded = result.kClassSizes.get(r.id);
      if (recorded !== group.length) {
        return `INCONSISTENCY: record ${r.id} kClassSize=${recorded} but actual class size=${group.length}`;
      }
    }
  }

  return null; // Auditoría pasada
}
