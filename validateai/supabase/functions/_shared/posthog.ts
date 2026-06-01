/**
 * Lightweight PostHog server-side helper for Deno Edge Functions.
 * Uses the PostHog /capture/ REST API directly — no SDK queue/flush overhead.
 * All calls are fire-and-forget; errors are swallowed silently.
 *
 * Requires env var: POSTHOG_KEY
 */

const POSTHOG_HOST = 'https://app.posthog.com';

/**
 * Fire-and-forget PostHog event capture.
 * Safe to call without await — never throws.
 */
export function phCapture(
  eventName: string,
  distinctId: string,
  properties: Record<string, unknown> = {},
): void {
  const key = Deno.env.get('POSTHOG_KEY');
  if (!key) return;

  fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      event: eventName,
      distinct_id: distinctId,
      properties: {
        $lib: 'validateai-edge',
        ...properties,
      },
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => { /* silent — analytics must never surface errors */ });
}
