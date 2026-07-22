// supabase/functions/api-v1/utils/validation.ts
// Utilidades de validación y sanitización defensivas para Bralidus & api-v1.

/**
 * Valida un RUT chileno utilizando el algoritmo de Módulo 11.
 * Acepa formatos: "12.345.678-K", "12345678-K", "12345678K"
 */
export function isValidRut(rutRaw: string): boolean {
  if (!rutRaw || typeof rutRaw !== 'string') return false
  const clean = rutRaw.replace(/[^0-9kK]/g, '')
  if (clean.length < 8 || clean.length > 9) return false

  const body = clean.slice(0, -1)
  const dvInput = clean.slice(-1).toUpperCase()

  let sum = 0
  let multiplier = 2

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body.charAt(i), 10) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const remainder = 11 - (sum % 11)
  let expectedDv = ''

  if (remainder === 11) expectedDv = '0'
  else if (remainder === 10) expectedDv = 'K'
  else expectedDv = remainder.toString()

  return dvInput === expectedDv
}

/**
 * Formatea un RUT a su representación limpia canónica: "12345678-K"
 */
export function formatRutCanonical(rutRaw: string): string {
  const clean = rutRaw.replace(/[^0-9kK]/g, '')
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1).toUpperCase()
  return `${body}-${dv}`
}

/**
 * Sanitiza una cadena de consulta para consultas RAG y búsquedas semánticas.
 * Elimina caracteres de control ASCII y secuencias potencialmente maliciosas de Prompt Injection.
 */
export function sanitizeQuery(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  // Remove control characters (except standard whitespace: \t, \n, \r)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  // Truncate to maximum safety limit (2000 characters)
  if (sanitized.length > 2000) {
    sanitized = sanitized.slice(0, 2000)
  }

  return sanitized.trim()
}
