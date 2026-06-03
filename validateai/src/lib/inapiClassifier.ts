/**
 * Clasificador de colisión de marcas INAPI — lógica pura extraída de
 * supabase/functions/inapi-fetch/index.ts para poder testearse en Vitest.
 *
 * Los estados activos siguen el valor real de la tabla inapi_records.
 */

export interface INAPIRecord {
  denominacion:      string;
  estado:            string;
  titular:           string;
  clases:            string;
  numero_solicitud?: string;
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface CollisionResult {
  colisiones:      INAPIRecord[];
  risk_level:      RiskLevel;
  risk_rationale:  string;
}

// Estados que representan marcas activas y exigibles en INAPI
export const ACTIVE_STATUSES = [
  'Registrada',
  'En Trámite',
  'En trámite',
  'Esperando renovación',
] as const;

/**
 * Normaliza texto para comparación: elimina tildes, colapsa espacios, pone en mayúsculas.
 * Equivalente a la función homónima en el edge function de Deno.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritical marks
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Clasifica el nivel de riesgo de colisión con marcas existentes en INAPI.
 *
 * - high:   coincidencia exacta con marca activa → registro sería rechazado
 * - medium: coincidencia parcial (contención) con marca activa → posible objeción
 * - none:   sin colisiones detectadas
 */
export function classifyCollisionRisk(
  records: INAPIRecord[],
  brandName: string,
): CollisionResult {
  const normalized = normalizeText(brandName);

  const activas = records.filter((r) =>
    (ACTIVE_STATUSES as readonly string[]).includes(r.estado),
  );

  const exactas   = activas.filter((r) => normalizeText(r.denominacion) === normalized);
  const parciales = activas.filter((r) => {
    const dn = normalizeText(r.denominacion);
    return dn !== normalized && (dn.includes(normalized) || normalized.includes(dn));
  });

  if (exactas.length > 0) {
    return {
      colisiones:     [...exactas, ...parciales],
      risk_level:     'high',
      risk_rationale: `${exactas.length} marca(s) con denominación EXACTA activa en INAPI. El registro de "${brandName}" sería rechazado.`,
    };
  }
  if (parciales.length > 0) {
    return {
      colisiones:     parciales,
      risk_level:     'medium',
      risk_rationale: `${parciales.length} marca(s) parcialmente similar(es) activa(s). Posible objeción de INAPI por similitud fonética o conceptual.`,
    };
  }
  return {
    colisiones:     [],
    risk_level:     'none',
    risk_rationale: 'Sin colisiones detectadas en el registro INAPI para esta denominación.',
  };
}
