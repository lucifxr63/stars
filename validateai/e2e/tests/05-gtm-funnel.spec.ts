/**
 * Suite 05 — Smoke del embudo GTM (Demo100 + contingencia de ingresos)
 * Automatiza el PROTOCOLO DE SMOKE TEST de la Mesa Directiva:
 *   Fase 1 (ToFu): soft-wall de /demo captura email a costo $0.
 *   Fase 2 (BoFu): CTAs de /pricing secuestrados → WaitlistModal Early Bird.
 *   Fase 3 (MoFu): Command Center asíncrono (GenerationStatusWidget + Bralidus).
 *
 * Las llamadas a send-quick-lead se interceptan (no se ensucia email_leads real
 * ni se golpea la red). Las aserciones de backend (Supabase email_leads) y de
 * PostHog/UTM y Resend (Fase 4) requieren acceso de Ops — no son automatizables
 * desde el frontend y quedan para el smoke manual en producción.
 */

import { test, expect } from '@playwright/test';
import { mockAuth } from '../fixtures/mockSupabase';

const QA_TOFU = 'qa-tofu@scouttech.lat';
const QA_BOFU = 'qa-bofu@scouttech.lat';

// ── Fase 1: ToFu — soft-wall de /demo ─────────────────────────────────────────
test.describe('Fase 1 · ToFu soft-wall /demo', () => {
  test('el muro captura email al tocar una sección premium', { tag: '@smoke' }, async ({ page }) => {
    // Intercepta el lead para no ensuciar email_leads y poder afirmar el envío.
    const leads: Array<Record<string, unknown>> = [];
    await page.route('**/functions/v1/send-quick-lead', async (route) => {
      leads.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.goto('/demo?utm_source=linkedin&utm_medium=qa_test&utm_campaign=smoke_test');

    // Contenido base estático (costo $0)
    await expect(page.getByRole('button', { name: 'Resumen' })).toBeVisible();

    // Trigger del muro: pestaña con sección premium bloqueada
    await page.getByRole('button', { name: 'Riesgo' }).click();
    const unlock = page.getByRole('button', { name: /desbloquear con mi email/i });
    await expect(unlock).toBeVisible();
    await unlock.click();

    // Soft-wall (modal) visible
    await expect(page.getByRole('heading', { name: /desbloquea/i })).toBeVisible();

    // Captura — el input del modal es el último input[email] del DOM
    const modalEmail = page.locator('input[type="email"]').last();
    await modalEmail.fill(QA_TOFU);
    await page.getByRole('button', { name: /enviarme acceso/i }).click();

    // Aserción UX + envío del lead
    await expect(page.getByText(/listo.*revisa tu correo/i)).toBeVisible();
    expect(leads.some((l) => l.email === QA_TOFU)).toBe(true);
  });
});

// ── Fase 2: BoFu — waitlist de /pricing ───────────────────────────────────────
test.describe('Fase 2 · BoFu waitlist /pricing', () => {
  test('el CTA de pago abre la waitlist Early Bird y captura email', { tag: '@smoke' }, async ({ page }) => {
    const leads: Array<Record<string, unknown>> = [];
    await page.route('**/functions/v1/send-quick-lead', async (route) => {
      leads.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.goto('/pricing');

    // Secuestro: el botón de compra NO va a checkout, abre el modal
    await page.getByRole('button', { name: /reservar acceso/i }).first().click();

    // Copy de escasez (50% Early Bird)
    await expect(page.getByText(/descuento del 50%/i)).toBeVisible();

    const modalEmail = page.locator('input[type="email"]').last();
    await modalEmail.fill(QA_BOFU);
    await page.getByRole('button', { name: /reservar mi cupo/i }).click();

    await expect(page.getByRole('heading', { name: /cupo reservado/i })).toBeVisible();
    expect(leads.some((l) => l.email === QA_BOFU)).toBe(true);
  });
});

// ── Fase 3: MoFu — Command Center asíncrono ───────────────────────────────────
test.describe('Fase 3 · MoFu Command Center', () => {
  test('el GenerationStatusWidget muestra el job en proceso', { tag: '@smoke' }, async ({ page }) => {
    await mockAuth(page);
    // Override: una validación generándose (status in_progress + current_step 4 = firma de job)
    await page.route('**/rest/v1/validations**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'val-smoke-1',
            idea_name: 'IdeaSmoke',
            status: 'in_progress',
            current_step: 4,
            generation_progress: { summary: 'success' },
            validation_score: null,
            created_at: '2026-06-12T00:00:00Z',
          },
        ]),
      }),
    );

    await page.goto('/dashboard');

    // Indicador inconfundible anti-churn (req #3)
    await expect(page.getByText(/validus ai está procesando/i)).toBeVisible();
  });

  test('el widget Bralidus (Market Signals) renderiza en el Dashboard', { tag: '@smoke' }, async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Heading del widget (rol heading) — no choca con el nav item (link) ni con
    // las fuentes de las señales (párrafos).
    await expect(page.getByRole('heading', { name: 'Inteligencia de Mercado' })).toBeVisible();
  });

  test('flujo quick: submit del wizard redirige DURO a /dashboard (asincronía #3)', { tag: '@smoke' }, async ({ page }) => {
    await mockAuth(page);

    // Consentimiento ya aceptado → evita el ConsentModal (z-9999) que intercepta clicks.
    await page.route('**/rest/v1/consent_logs**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'consent-smoke' }) }),
    );
    // Onboarding del wizard ya visto → evita el OnboardingOverlay (z-50).
    await page.addInitScript(() => localStorage.setItem('validateai_onboarded', '1'));

    // validations: insert con .select().single() → objeto con id; listas → array
    // con una fila in_progress+step4 (para que el widget la muestre tras el redirect).
    await page.route('**/rest/v1/validations**', async (route) => {
      const accept = route.request().headers()['accept'] ?? '';
      const row = {
        id: 'val-smoke-async',
        idea_name: 'SmokeIdea',
        status: 'in_progress',
        current_step: 4,
        generation_progress: {},
        validation_score: null,
        created_at: '2026-06-12T00:00:00Z',
      };
      const wantsSingle = accept.includes('vnd.pgrst.object');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wantsSingle ? row : [row]),
      });
    });
    // RPC de progreso del job en background (fire-and-forget) — evita red real.
    await page.route('**/rest/v1/rpc/merge_generation_progress**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/validate');

    // Entrar a modo Rápido vía FlowSelector (StepIdea trae el selector).
    await page.getByRole('button', { name: /análisis rápido/i }).click();

    // Completar el formulario quick (cumple StepIdeaQuickSchema: desc ≥100 chars).
    await page.getByPlaceholder(/FreshBox/i).fill('SmokeIdea');
    await page.getByPlaceholder(/Una app que conecta/i).fill(
      'Plataforma que conecta a pymes chilenas con contadores certificados en menos de 24 horas, ' +
      'eliminando la fricción de conseguir asesoría tributaria confiable y a tiempo para el SII.',
    );
    await page.getByPlaceholder(/Clínicas dentales medianas/i).fill('Pymes chilenas de servicios');
    await page.getByRole('button', { name: 'B2B', exact: true }).click();
    await page.locator('label:has(input[name="idea_industry"])').first().click();

    // Submit → la asincronía híbrida NO debe quedarse cargando: redirect duro.
    await page.getByRole('button', { name: /analizar idea/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText(/validus ai está procesando/i)).toBeVisible();
  });
});
