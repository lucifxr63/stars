/**
 * Suite 01 — Rutas públicas
 * No requieren autenticación. Verifican que el HTML llega, los textos clave
 * están presentes y no hay errores JS fatales.
 */

import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('carga sin errores JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('muestra el logo Validus', async ({ page }) => {
    await expect(page.getByRole('img', { name: 'Validus' }).first()).toBeVisible();
  });

  test('tiene un CTA principal visible', async ({ page }) => {
    // El landing tiene al menos un botón o link que lleva al producto.
    // Busca por botón (más amplio que link) con texto de acción.
    const cta = page
      .getByRole('button', { name: /gratis|empezar|validar|comenzar|crear|ingresar/i })
      .or(page.getByRole('link', { name: /gratis|empezar|validar|comenzar|crear|ingresar/i }))
      .first();
    await expect(cta).toBeVisible({ timeout: 8_000 });
  });

  test('el title del documento está definido', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(3);
  });
});

test.describe('Pricing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('carga sin errores JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('muestra los 4 planes', async ({ page }) => {
    // Usar first() porque "Free"/"Pro" pueden aparecer en múltiples elementos
    await expect(page.getByText('Free').first()).toBeVisible();
    await expect(page.getByText('Basic').first()).toBeVisible();
    await expect(page.getByText('Pro').first()).toBeVisible();
    await expect(page.getByText('Premium').first()).toBeVisible();
  });

  test('muestra precios en CLP', async ({ page }) => {
    await expect(page.getByText(/9\.990/)).toBeVisible();
    await expect(page.getByText(/20\.000/)).toBeVisible();
  });

  test('tiene botón de CTA para cada plan de pago', async ({ page }) => {
    await expect(page.getByRole('button', { name: /empezar con basic/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /empezar con pro/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /empezar con premium/i })).toBeVisible();
  });

  test('menciona Lemon Squeezy (no Stripe)', async ({ page }) => {
    await expect(page.getByText(/lemon squeezy/i)).toBeVisible();
    const stripeText = await page.getByText(/procesado por stripe/i).count();
    expect(stripeText).toBe(0);
  });
});

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('carga sin errores JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('muestra el formulario de email/contraseña', async ({ page }) => {
    await expect(page.getByPlaceholder('tu@email.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });

  test('tiene botón de Google OAuth', async ({ page }) => {
    await expect(page.getByRole('button', { name: /continuar con google/i })).toBeVisible();
  });

  test('tiene botón de submit visible', async ({ page }) => {
    const submit = page.getByRole('button', { name: /ingresar|crear cuenta/i });
    await expect(submit).toBeVisible();
  });

  test('permite alternar entre login y registro', async ({ page }) => {
    const toggle = page.getByText(/regístrate gratis/i);
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByRole('button', { name: /crear cuenta/i })).toBeVisible();
  });
});
