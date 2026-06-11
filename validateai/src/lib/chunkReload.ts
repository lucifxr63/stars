// ============================================================
// Recuperación de "stale deploy": chunk hash mismatch
// ============================================================
// Cuando se publica un build nuevo, Vite regenera los hashes de todos los
// chunks. Un cliente con el index.html viejo cacheado referencia chunks que
// ya no existen (ej. Login-CrH1sBZM.js). El rewrite SPA de Vercel devuelve
// index.html (MIME text/html) para ese archivo faltante, y el navegador
// falla con "Failed to fetch dynamically imported module".
//
// La cura es un reload completo: trae el index.html fresco con los hashes
// nuevos. Guardamos un timestamp en sessionStorage para recargar UNA vez y
// evitar un loop infinito si el chunk realmente no existe (404 genuino).
// ============================================================

const RELOAD_TS_KEY = 'chunk-reload-ts';
const RELOAD_COOLDOWN_MS = 10_000;

/** ¿El error parece un fallo de carga de chunk lazy (stale deploy)? */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Expected a JavaScript-or-Wasm module script/i.test(msg)
  );
}

/**
 * Fuerza un reload una sola vez dentro de la ventana de cooldown.
 * @returns true si disparó el reload, false si ya se intentó recientemente.
 */
export function reloadForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false; // ya recargamos recién → no loop
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
  } catch {
    // sessionStorage bloqueado (modo privado estricto): recargamos igual una vez.
  }
  window.location.reload();
  return true;
}

/**
 * Escucha el evento `vite:preloadError` que Vite emite cuando un import
 * dinámico (lazy route) no se puede cargar. Llamar una vez al boot.
 */
export function installChunkReloadHandler(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault(); // evita que el error burbujee sin manejarse
    reloadForStaleChunk();
  });
}
