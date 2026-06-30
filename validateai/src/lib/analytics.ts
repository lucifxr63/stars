import posthog from 'posthog-js';

// ─── Fase 8: helper centralizado de analítica de embudo ───────────────────────
// Capa fina y PII-safe sobre posthog.capture para los eventos NUEVOS del embudo.
// Los pipelines existentes (useAnalytics.ts y lib/telemetry.ts) se mantienen
// intactos por continuidad histórica de métricas.
//
// Principios:
//  - No-op seguro: si VITE_POSTHOG_KEY no está configurada (dev/SSR), no hace nada
//    y NUNCA lanza ni ensucia la consola.
//  - Privacidad primero: red de seguridad que descarta claves con PII y strings
//    largos (probable contenido de idea/output). Aun así, solo se debe instrumentar
//    con propiedades de la allowlist documentada (source, target, plan, tier,
//    is_authenticated, page, step, step_index, tab, has_evidence, source_status,
//    reason, limit_type, method, mode).

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

// Claves que NUNCA deben viajar en un evento (defensa en profundidad).
const PII_DENYLIST = new Set([
  'email', 'rut', 'phone', 'password', 'name', 'full_name', 'fullname',
  'idea', 'idea_name', 'idea_description', 'description', 'startup_name',
  'prompt', 'output', 'content', 'answer', 'text', 'address',
]);

const MAX_STRING_LEN = 120; // strings largos ⇒ probable contenido libre, se descartan

type Props = Record<string, unknown>;

/**
 * Red de seguridad de privacidad (pura y testeable): descarta claves con PII,
 * strings largos (probable contenido libre) y valores undefined. Exportada para
 * que el test unitario verifique la garantía "nunca enviamos PII".
 */
export function sanitizeProps(props: Props): Props {
  const out: Props = {};
  for (const [key, value] of Object.entries(props)) {
    if (PII_DENYLIST.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && value.length > MAX_STRING_LEN) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** Evento genérico del embudo. No-op si PostHog no está configurado. */
export function trackEvent(name: string, props: Props = {}): void {
  if (!PH_KEY) return;
  if (typeof window === 'undefined') return;
  try {
    posthog.capture(name, sanitizeProps(props));
  } catch {
    // La analítica nunca debe romper la UI.
  }
}

/** Click en un CTA. `source` = de dónde; `target` = a dónde/qué acción. */
export function trackCtaClick(source: string, target: string, extra: Props = {}): void {
  trackEvent('cta_clicked', { source, target, ...extra });
}

/** Paso del embudo con nombre explícito de evento (ej. 'wizard_started'). */
export function trackFunnelStep(step: string, props: Props = {}): void {
  trackEvent(step, props);
}
