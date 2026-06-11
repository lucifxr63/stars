/**
 * Helpers para distinguir un cierre de sesión deliberado (el usuario hizo clic
 * en "Cerrar sesión") de una expiración inesperada (el refresh token falló y
 * Supabase emitió SIGNED_OUT por su cuenta).
 *
 * Ambos casos disparan el evento `SIGNED_OUT` en onAuthStateChange, así que sin
 * esta bandera no podríamos saber si mostrar "Sesión cerrada" (intencional) o
 * "Tu sesión expiró" (forzar re-login con gracia).
 */
const FLAG = 'validateai:deliberate-logout';

/** Llamar JUSTO antes de supabase.auth.signOut() en los botones de logout. */
export function markDeliberateLogout(): void {
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    // sessionStorage puede no estar disponible (modo privado estricto) — no crítico.
  }
}

/**
 * Devuelve true si el SIGNED_OUT actual proviene de un logout intencional.
 * Consume la bandera (one-shot): la próxima expiración real volverá a leer false.
 */
export function consumeDeliberateLogout(): boolean {
  try {
    const was = sessionStorage.getItem(FLAG) === '1';
    sessionStorage.removeItem(FLAG);
    return was;
  } catch {
    return false;
  }
}
