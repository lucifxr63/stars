// ─── Fase 5: Rebrand técnico validateai → validus ─────────────────────────────
// Fuente única de los nombres de claves de almacenamiento y eventos de runtime.
// Las claves persistidas exponen { to } (nombre nuevo, en uso) y { from } (nombre
// heredado, leído solo para migración backward-compatible — ver storageMigration.ts).
// Los eventos/canales NO se persisten: se renombran de forma atómica, sin shim.

/** Claves de localStorage migradas. `to` = nuevo (en uso), `from` = heredado. */
export const STORAGE_KEYS = {
  session:      { to: 'validus-session',           from: 'validateai-session' },
  carousel:     { to: 'validus-carousel',          from: 'validateai-carousel' },
  previewTier:  { to: 'validus_preview_tier',      from: 'validateai_preview_tier' },
  pdfTheme:     { to: 'validus_pdf_theme',         from: 'validateai_pdf_theme' },
  onboarded:    { to: 'validus_onboarded',         from: 'validateai_onboarded' },
  mfGenerating: { to: 'validus_mf_generating_v1',  from: 'validateai_mf_generating_v1' },
} as const;

/** Claves de sessionStorage migradas. */
export const SESSION_KEYS = {
  deliberateLogout: { to: 'validus:deliberate-logout', from: 'validateai:deliberate-logout' },
} as const;

/** Nombres de eventos de window (no persistidos → rename atómico sin shim). */
export const EVENTS = {
  tierPreview:  'validus:tier-preview',
  usageUpdated: 'validus:usage-updated',
  paywallHit:   'validus:paywall-hit',
} as const;

/** Canal cross-tab (efímero). */
export const BROADCAST_CHANNEL = 'validus_store';

/** Marca de entrada de history para el exit-intent guard (estado transitorio). */
export const HISTORY_GUARD_KEY = 'validus_guard';
