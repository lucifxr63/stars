import posthog from 'posthog-js';

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const PH_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://app.posthog.com';

let initialized = false;

export function initAnalytics() {
  if (initialized || !PH_KEY) return;
  posthog.init(PH_KEY, {
    api_host: PH_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage',
    disable_session_recording: true,
    enable_heatmaps: false,
    // Silencia errores de red cuando el ad-blocker corta las requests
    on_xhr_error: () => {},
  });
  initialized = true;
}

export function identifyUser(userId: string, props?: Record<string, unknown>) {
  if (!PH_KEY) return;
  posthog.identify(userId, props);
}

export function resetAnalytics() {
  if (!PH_KEY) return;
  posthog.reset();
}

// ── Typed event helpers ───────────────────────────────────────────────────────

export function trackWizardStep(step: number, stepName: string, mode: 'quick' | 'detailed' | 'premium') {
  if (!PH_KEY) return;
  posthog.capture('wizard_step_completed', { step, step_name: stepName, mode });
}

export function trackWizardAbandoned(step: number, stepName: string) {
  if (!PH_KEY) return;
  posthog.capture('wizard_abandoned', { last_step: step, last_step_name: stepName });
}

export function trackAIPrompt(promptType: string, tier: string, fromCache: boolean) {
  if (!PH_KEY) return;
  posthog.capture('ai_prompt_called', { prompt_type: promptType, tier, from_cache: fromCache });
}

export function trackValidationCompleted(validationId: string, score: number, industry: string, tier: string) {
  if (!PH_KEY) return;
  posthog.capture('validation_completed', { validation_id: validationId, score, industry, tier });
}

export function trackDeliverableDownloaded(type: 'pdf' | 'pdf_fresh' | string, theme?: string) {
  if (!PH_KEY) return;
  posthog.capture('deliverable_downloaded', { deliverable_type: type, theme });
}

export function trackUpgradeClick(fromSection: string, requiredTier: string) {
  if (!PH_KEY) return;
  posthog.capture('upgrade_cta_clicked', { from_section: fromSection, required_tier: requiredTier });
}

export function trackTabView(tabName: string) {
  if (!PH_KEY) return;
  posthog.capture('dashboard_tab_viewed', { tab: tabName });
}

export function trackDemoViewed(source: string) {
  if (!PH_KEY) return;
  posthog.capture('view_demo_clicked', { source });
}
