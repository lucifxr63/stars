/**
 * Suite 08 — Veredicto no-bloqueante (#6)
 * Antes, mientras se generaba el playbook, TODO el tab Veredicto se tapaba con un
 * spinner full-width. Ahora la columna de score/desglose (que ya viene del wizard)
 * se muestra de inmediato y solo el Playbook espera con un loader inline.
 */

import { test, expect } from '@playwright/test';
import { mockAuth } from '../fixtures/mockSupabase';

const SUPABASE_URL = 'https://fcdhcntyvsydnvjwopfe.supabase.co';
const VALIDATION_ID = 'val-00000000-0000-0000-0000-0000000000cc';

const VALIDATION_ROW = {
  id: VALIDATION_ID,
  idea_name: 'HidroCraft',
  idea_description: 'Cerveza artesanal hidropónica.',
  idea_industry: 'Foodtech',
  target_country: 'Chile',
  business_model: 'B2C',
  pricing_range: '1-10 USD',
  validation_mode: 'detailed',
  validation_score: 72,
  // score_breakdown presente (viene del wizard) pero SIN playbook → dispara generación.
  score_breakdown: { problem: 80, market: 70, competition: 60, solution: 75, execution: 65 },
  playbook_analysis: null,
  created_at: '2026-06-16T00:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await mockAuth(page);

  // Cuota disponible (1/3) para que la generación arranque (no choque el muro).
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_usage_summary**`, (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ period: '2026-06', total: 1, expensive: 0, reset_at: '2026-07-01T00:00:00Z', total_limit: 3, expensive_limit: 0 }),
    }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/validations**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VALIDATION_ROW) }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/validation_agents_log**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/founder_profiles**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/report_feedback**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  // ai-validate (playbook) DEMORADO: mantiene el estado "generando" observable.
  await page.route(`${SUPABASE_URL}/functions/v1/ai-validate`, async (route) => {
    await new Promise((r) => setTimeout(r, 8000));
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ funding_verdict: 'Promisorio', verdict_recommendation: 'GO' }),
    });
  });

  // No esperamos networkidle (ai-validate cuelga 8s a propósito).
  await page.goto(`/results/${VALIDATION_ID}`, { waitUntil: 'domcontentloaded' });
});

test.describe('Veredicto no-bloqueante mientras genera el playbook', () => {
  test('muestra el desglose del score Y el loader del playbook a la vez', async ({ page }) => {
    // El score (ya disponible) se ve sin esperar al playbook…
    await expect(page.getByText('Desglose del score')).toBeVisible({ timeout: 10_000 });
    // …mientras el Playbook muestra su loader inline (no tapa todo el tab).
    await expect(page.getByText(/analizando tu idea con el playbook vc/i)).toBeVisible();
  });
});
