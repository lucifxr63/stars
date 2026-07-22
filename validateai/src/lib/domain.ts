// src/lib/domain.ts
// Utilidad para detectar si la aplicación se ejecuta bajo el dominio bralidus.scouttech.lat

export function isBralidusDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  return (
    hostname.includes('bralidus') ||
    hostname.startsWith('bralidus.') ||
    search.includes('bralidus=true') ||
    pathname.startsWith('/bralidus')
  );
}
