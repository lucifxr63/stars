/**
 * Suite 06 — Veredicto con cuota agotada
 * Verifica la mejora de UX: cuando un usuario free sin evaluaciones abre una
 * validación cuyo veredicto aún no está generado, NO debe ver el error genérico
 * "No se pudo generar el veredicto. Reintentar", sino el aviso claro de límite
 * con CTA de upgrade.
 */

import { test, expect } from '@playwright/test';
import { mockAuth } from '../fixtures/mockSupabase';

const SUPABASE_URL = 'https://fcdhcntyvsydnvjwopfe.supabase.co';
const VALIDATION_ID = 'val-00000000-0000-0000-0000-0000000000aa';

const VALIDATION_ROW = {
  id: VALIDATION_ID,
  idea_name: 'HidroCraft',
  idea_description: 'Cerveza artesanal hidropónica para el mercado chileno.',
  idea_problem: 'Falta de insumos locales sustentables.',
  idea_industry: 'Foodtech',
  target_country: 'Chile',
  target_region: null,
  business_model: 'B2C',
  business_stage: null,
  pricing_range: '1-10 USD',
  validation_mode: 'detailed',
  validation_score: 72,
  customer_segment: 'Cerveceros artesanales',
  value_proposition: 'Insumos frescos todo el año',
  differentiator: 'Cultivo hidropónico local',
  playbook_analysis: null, // ← sin veredicto: dispara el efecto de generación
  score_breakdown: null,
  created_at: '2026-06-16T00:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await mockAuth(page);

  // Cuota agotada: 3/3 usados → remaining 0
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_usage_summary**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ period: '2026-06', total: 3, expensive: 0, reset_at: '2026-07-01T00:00:00Z' }),
    }),
  );

  // .single() → objeto único de la validación (sin veredicto)
  await page.route(`${SUPABASE_URL}/rest/v1/validations**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VALIDATION_ROW) }),
  );

  // .maybeSingle() → sin filas
  await page.route(`${SUPABASE_URL}/rest/v1/validation_agents_log**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/founder_profiles**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );

  // El backend rechaza el veredicto por límite mensual (red de seguridad ante la carrera de carga)
  await page.route(`${SUPABASE_URL}/functions/v1/ai-validate`, (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'monthly_limit', message: 'Limite alcanzado.', used: 3, limit: 3, tier: 'free' }),
    }),
  );

  await page.goto(`/results/${VALIDATION_ID}`);
  await page.waitForLoadState('networkidle');
});

test.describe('Veredicto bloqueado por cuota', () => {
  test('muestra el aviso de límite en vez del error genérico', async ({ page }) => {
    await expect(page.getByText(/te quedaste sin evaluaciones gratis/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /subir a basic/i })).toBeVisible();
  });

  test('NO muestra "Reintentar" (que volvería a chocar contra el muro)', async ({ page }) => {
    await expect(page.getByText(/te quedaste sin evaluaciones gratis/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^reintentar$/i })).toHaveCount(0);
  });
});
