// src/lib/domain.ts
// Utilidad para detectar si la aplicación se ejecuta bajo el dominio animus.scouttech.lat

export function isAnimusDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  return (
    hostname.includes('animus') ||
    hostname.startsWith('animus.') ||
    search.includes('animus=true') ||
    pathname.startsWith('/animus')
  );
}
