/**
 * Suite 02 — Protección de rutas
 * Verifica que las rutas privadas redirigen a /login
 * cuando el usuario no está autenticado.
 */

import { test, expect } from '@playwright/test';
import { mockUnauthenticated } from '../fixtures/mockSupabase';

const PROTECTED_ROUTES = [
  '/dashboard',
  '/validate',
  '/results',
  '/profile',
  '/startup',
];

for (const route of PROTECTED_ROUTES) {
  test(`${route} redirige a /login sin autenticación`, { tag: '@smoke' }, async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto(route);
    await page.waitForURL(/\/login/, { timeout: 5_000 });
    expect(page.url()).toContain('/login');
  });
}

test('la ruta /onboarding redirige a /login sin autenticación', async ({ page }) => {
  await mockUnauthenticated(page);
  await page.goto('/onboarding');
  await page.waitForURL(/\/login/, { timeout: 5_000 });
  expect(page.url()).toContain('/login');
});

test('/login no redirige si ya está en /login (no loop)', async ({ page }) => {
  await mockUnauthenticated(page);
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('/login');
  // No debe haber redirigido a otro lugar
  expect(page.url()).not.toContain('/dashboard');
});
