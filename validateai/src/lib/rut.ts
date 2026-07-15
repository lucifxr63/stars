// Validación de RUT chileno (módulo 11) + normalización. Es el RUT de la EMPRESA
// (identificador de negocio), no el RUT personal del usuario (ese va hasheado).

export function cleanRut(rut: string): string {
  return (rut || '').replace(/[.\-\s]/g, '').toUpperCase();
}

// Normaliza a "cuerpo-DV" con guión, ej: "76123456-K".
export function formatRut(rut: string): string {
  const c = cleanRut(rut);
  if (c.length < 2) return c;
  return `${c.slice(0, -1)}-${c.slice(-1)}`;
}

export function isValidRut(rut: string): boolean {
  const c = cleanRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(c)) return false;
  const body = c.slice(0, -1);
  const dv = c.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const expected = res === 11 ? '0' : res === 10 ? 'K' : String(res);
  return dv === expected;
}
