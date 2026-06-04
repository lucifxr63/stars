/**
 * Suite 03 — Dashboard autenticado
 * Verifica el estado de la UI cuando el usuario está logueado:
 * sidebar, saludo, stats, UsageBar para tier free.
 */

import { test, expect } from '@playwright/test';
import { mockAuth, TEST_USER } from '../fixtures/mockSupabase';

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
});

test.describe('Dashboard con usuario autenticado', () => {
  test('carga sin errores JS', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });

  test('muestra el saludo con el nombre del usuario', async ({ page }) => {
    // Nombre "Founder Test" → firstName = "Founder"
    await expect(page.getByText(/hola.*founder/i)).toBeVisible();
  });

  test('muestra el CTA de nueva validación', async ({ page }) => {
    await expect(page.getByRole('button', { name: /comenzar/i })).toBeVisible();
  });

  test('muestra el estado "sin validaciones" para usuario nuevo', async ({ page }) => {
    await expect(page.getByText(/todavía no has validado/i)).toBeVisible();
  });
});

test.describe('Sidebar', () => {
  test('muestra los 5 nav items', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mis Validaciones' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Encuestas' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mi Startup' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Configuración' })).toBeVisible();
  });

  test('muestra el tier del usuario', async ({ page }) => {
    // El Sidebar muestra el badge de tier; puede aparecer múltiples veces en la página
    await expect(page.getByText('Free').first()).toBeVisible();
  });

  test('UsageBar visible para tier free con uso parcial', async ({ page }) => {
    // El mock retorna total=2, limit=3 → "2 / 3"
    await expect(page.getByText(/análisis este mes/i)).toBeVisible();
    await expect(page.getByText('2 / 3')).toBeVisible();
  });

  test('UsageBar muestra restantes correctos', async ({ page }) => {
    // 3 - 2 = 1 restante
    await expect(page.getByText(/1 restante/i)).toBeVisible();
  });

  test('UsageBar muestra link de upgrade cuando quedan ≤1', async ({ page }) => {
    await expect(page.getByRole('link', { name: /actualizar plan/i })).toBeVisible();
  });
});

test.describe('Navegación desde sidebar', () => {
  test('los links del sidebar tienen los hrefs correctos', async ({ page }) => {
    // Verificar que los links apuntan a las rutas correctas
    // (sin hacer click, que no funciona confiablemente en tests mock SPA)
    const misValidaciones = page.getByRole('link', { name: 'Mis Validaciones' });
    const miStartup       = page.getByRole('link', { name: 'Mi Startup' });

    await expect(misValidaciones).toHaveAttribute('href', '/results');
    await expect(miStartup).toHaveAttribute('href', '/startup');
  });

  test('/results carga correctamente con navegación directa', async ({ page }) => {
    await page.goto('/results');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/results');
    // La página debe mostrar algo — no estar en blanco
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(10);
  });

  test('/startup carga correctamente con navegación directa', async ({ page }) => {
    await page.goto('/startup');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/startup');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(10);
  });
});
