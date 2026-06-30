// ─── Fase 5: shim de migración de claves de almacenamiento ────────────────────
// Copia, una sola vez, el valor de cada clave heredada `validateai_*` a su nueva
// clave `validus_*` SOLO si la nueva aún no existe. No borra la clave vieja: deja
// una ventana de transición segura para usuarios con sesiones/preferencias previas.
//
// IMPORTANTE: este módulo se ejecuta como SIDE EFFECT al importarse. Debe importarse
// ANTES que cualquier store (Zustand persist hidrata al evaluarse su módulo), por eso
// se importa primero en main.tsx.

import { STORAGE_KEYS, SESSION_KEYS } from './storageKeys';

function migrateKey(storage: Storage, from: string, to: string): void {
  try {
    // Si la nueva ya tiene valor, no se pisa (idempotente).
    if (storage.getItem(to) !== null) return;
    const legacy = storage.getItem(from);
    if (legacy !== null) storage.setItem(to, legacy);
  } catch {
    // storage no disponible (modo privado estricto / SSR) — no crítico, no-op.
  }
}

function runStorageMigration(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const { to, from } of Object.values(STORAGE_KEYS)) {
      migrateKey(window.localStorage, from, to);
    }
    for (const { to, from } of Object.values(SESSION_KEYS)) {
      migrateKey(window.sessionStorage, from, to);
    }
  } catch {
    // Defensa total: nunca debe romper el arranque de la app.
  }
}

// Ejecutar inmediatamente al importar (antes de la hidratación de los stores).
runStorageMigration();

export { runStorageMigration };
