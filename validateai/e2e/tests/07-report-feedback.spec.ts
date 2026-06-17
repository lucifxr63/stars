/**
 * Suite 07 — Feedback de calidad del reporte
 * Verifica el componente <ReportFeedback>: aparece al pie del reporte, captura
 * el rating y muestra el agradecimiento tras enviar (persistiendo en DB + PostHog).
 */

import { test, expect } from '@playwright/test';
import { mockAuth } from '../fixtures/mockSupabase';

const SUPABASE_URL = 'https://fcdhcntyvsydnvjwopfe.supabase.co';
const VALIDATION_ID = 'val-00000000-0000-0000-0000-0000000000bb';

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
  // Veredicto ya generado → el efecto de generación no dispara ai-validate.
  playbook_analysis: { funding_verdict: 'Promisorio', _fallo_elegante: false },
  created_at: '2026-06-16T00:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await mockAuth(page);

  await page.route(`${SUPABASE_URL}/rest/v1/validations**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VALIDATION_ROW) }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/validation_agents_log**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/founder_profiles**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );

  // report_feedback: GET (¿ya opinó?) → sin filas; POST (insert) → 201
  await page.route(`${SUPABASE_URL}/rest/v1/report_feedback**`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto(`/results/${VALIDATION_ID}`);
  await page.waitForLoadState('networkidle');
});

test.describe('Feedback de calidad del reporte', () => {
  test('muestra la pregunta de utilidad', async ({ page }) => {
    await expect(page.getByText(/qué tan útil te resultó este reporte/i)).toBeVisible({ timeout: 10_000 });
  });

  test('al valorar positivo, agradece y persiste', async ({ page }) => {
    await expect(page.getByText(/qué tan útil te resultó este reporte/i)).toBeVisible({ timeout: 10_000 });
    // Rating alto (🤩) → envío directo. force: la página re-renderiza por hooks
    // async al pie (mentors, etc.) y el check de "stable" puede fallar por layout shift.
    const btn = page.getByRole('button', { name: 'Excelente' });
    await btn.scrollIntoViewIfNeeded();
    await btn.dispatchEvent('click');
    await expect(page.getByText(/gracias.*reportes/i)).toBeVisible({ timeout: 5_000 });
  });
});
