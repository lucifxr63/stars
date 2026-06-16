import { z } from 'zod';
import posthog from 'posthog-js';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const PH_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://app.posthog.com';

// ── Approved event schema (Zod) ───────────────────────────────────────────────

export const TelemetryEventSchema = z.object({
  event_name: z.enum(['deliverable_viewed', 'wizard_abandoned', 'paywall_hit', 'micro_feedback']),
  user_id: z.string().uuid(),
  validation_id: z.string().uuid().optional(),
  context: z.object({
    tier: z.enum(['free', 'basic', 'pro', 'premium']),
    action_taken: z.string().min(3),
    step_reached: z.number().int().min(1).max(6).optional(),
    feature_name: z.string().optional(),
  }),
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

// Callers provide everything except user_id / validation_id — those are auto-injected.
export type TelemetryInput = Omit<TelemetryEvent, 'user_id' | 'validation_id'>;

// ── Rem 4: structured Zod error reporting ────────────────────────────────────

function reportSchemaViolation(error: z.ZodError): void {
  // z.prettifyError gives a human-readable multi-line string (Zod 4+)
  const pretty = z.prettifyError(error);
  console.error('[telemetry] schema violation:\n' + pretty);
  // Sentry hook — wire when @sentry/react is installed:
  // Sentry.captureException(error, { extra: { tree: z.treeifyError(error) } });
}

// ── Async wrapper for standard UI interactions ────────────────────────────────

/**
 * Typed PostHog wrapper that:
 *  1. Auto-injects user_id (Supabase auth) and validation_id (validationStore)
 *  2. Validates the full payload with TelemetryEventSchema before sending
 *  3. Reports schema violations via reportSchemaViolation (never throws)
 */
export async function trackTelemetryEvent(input: TelemetryInput): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { validationId } = useValidationStore.getState();

    const result = TelemetryEventSchema.safeParse({
      ...input,
      user_id: user.id,
      validation_id: validationId ?? undefined,
    });

    if (!result.success) {
      reportSchemaViolation(result.error);
      return;
    }

    const { event_name, user_id, validation_id, context } = result.data;
    posthog.capture(event_name, { user_id, validation_id, ...context });
  } catch {
    // telemetry must never propagate errors to the UI
  }
}

// ── Rem 2: fetch keepalive beacon (replaces sendBeacon) ──────────────────────

/**
 * Beacon variant for pagehide / visibilitychange scenarios.
 * Uses fetch({ keepalive: true }): BFCache-compatible, supports auth headers,
 * works inside Service Workers. Payload kept small by Zod schema (< 64 KB limit).
 * Falls back gracefully if fetch is unavailable.
 *
 * NOTE: Calls PostHog /capture/ API directly so posthog-js internals don't
 * downgrade to sendBeacon. Phase 2 will re-route via /t/* reverse proxy.
 */
export function trackTelemetryBeacon(
  eventName: TelemetryEvent['event_name'],
  context: TelemetryEvent['context'],
): void {
  try {
    if (!PH_KEY) return;
    const { validationId } = useValidationStore.getState();
    const distinctId = posthog.get_distinct_id?.() ?? 'anonymous';

    const body = JSON.stringify({
      api_key: PH_KEY,
      event: eventName,
      distinct_id: distinctId,
      properties: {
        validation_id: validationId ?? undefined,
        $lib: 'validateai-beacon',
        ...context,
      },
      timestamp: new Date().toISOString(),
    });

    fetch(`${PH_HOST}/capture/`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => { /* silent — beacon errors must not surface */ });
  } catch {
    // silent
  }
}
