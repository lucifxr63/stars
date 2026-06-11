/**
 * mockSupabase — intercepta las llamadas a la API de Supabase en tests E2E.
 *
 * Estrategia: page.route() captura requests antes de que lleguen a la red.
 * No se necesitan credenciales reales ni un backend de test separado.
 *
 * Endpoints interceptados:
 *   GET  /auth/v1/user           → usuario autenticado falso
 *   POST /auth/v1/token          → sesión falsa (refresh token flow)
 *   GET  /rest/v1/profiles       → perfil de tier "free" con onboarding completo
 *   POST /rest/v1/rpc/get_usage_summary → uso mensual (2/3 análisis usados)
 *   GET  /rest/v1/validations    → lista vacía de validaciones
 */

import type { Page, Route } from '@playwright/test';

export const TEST_USER = {
  id:    'test-user-00000000-0000-0000-0000-000000000001',
  email: 'test@validus.cl',
  user_metadata: { full_name: 'Founder Test', name: 'Founder Test' },
  app_metadata:  {},
  aud:           'authenticated',
  role:          'authenticated',
  created_at:    '2026-01-01T00:00:00Z',
  updated_at:    '2026-01-01T00:00:00Z',
};

export const TEST_SESSION = {
  access_token:  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.mock',
  refresh_token: 'mock-refresh-token',
  token_type:    'bearer',
  expires_in:    3600,
  expires_at:    Math.floor(Date.now() / 1000) + 3600,
  user:          TEST_USER,
};

export const TEST_PROFILE = {
  id:                  TEST_USER.id,
  full_name:           'Founder Test',
  avatar_url:          null,
  tier:                'free',
  tier_expires_at:     null,
  kyc_status:          null,
  rut_hash:            null,
  training_consent:    false,
  onboarding_completed: true,
  startup_name:        'TestStartup',
  startup_sector:      'saas',
  founder_pitch:       'Ayudamos a founders a validar ideas con IA.',
  created_at:          '2026-01-01T00:00:00Z',
  updated_at:          '2026-01-01T00:00:00Z',
};

const SUPABASE_URL = 'https://fcdhcntyvsydnvjwopfe.supabase.co';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Activa todos los mocks de Supabase para una página.
 * Llama ANTES de page.goto() para que los mocks estén listos.
 *
 * Estrategia doble:
 *  1. addInitScript → inyecta sesión en localStorage antes de que cargue el JS
 *     (resuelve supabase.auth.getSession() sin llamada de red)
 *  2. page.route → intercepta getUser() y token refresh por si acaso
 */
export async function mockAuth(page: Page) {
  // 1. Inyectar sesión en localStorage antes del primer JS ejecutado
  //    La key de Supabase es: sb-<ref>-auth-token
  await page.addInitScript((session: unknown) => {
    const key = 'sb-fcdhcntyvsydnvjwopfe-auth-token';
    localStorage.setItem(key, JSON.stringify(session));
  }, TEST_SESSION);

  // 2. Auth: getUser (por si el token se verifica contra la API)
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
    json(route, TEST_USER),
  );

  // 3. Auth: getSession / refresh
  await page.route(`${SUPABASE_URL}/auth/v1/token**`, (route) =>
    json(route, TEST_SESSION),
  );

  // Profiles: select (para useUserTier, ProtectedLayout, Sidebar)
  await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, (route) => {
    if (route.request().method() === 'GET') {
      return json(route, [TEST_PROFILE]);
    }
    return json(route, TEST_PROFILE);
  });

  // Usage summary: get_usage_summary RPC
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_usage_summary**`, (route) =>
    json(route, {
      period:    '2026-06',
      total:     2,
      expensive: 0,
      reset_at:  '2026-07-01T00:00:00Z',
    }),
  );

  // Validations: lista vacía por defecto
  await page.route(`${SUPABASE_URL}/rest/v1/validations**`, (route) =>
    json(route, []),
  );

  // Consent logs: no flagged
  await page.route(`${SUPABASE_URL}/rest/v1/consent_logs**`, (route) =>
    json(route, []),
  );

  // Founder profiles
  await page.route(`${SUPABASE_URL}/rest/v1/founder_profiles**`, (route) =>
    json(route, []),
  );

  // Edge Functions de Deno: el smoke E2E debe depender SOLO del artefacto del
  // frontend — ninguna llamada sale a la red real (Supabase/AI).
  await mockEdgeFunctions(page);
}

/**
 * Catch-all para las Edge Functions de Deno (`/functions/v1/**`).
 * Devuelve un stub benigno para cualquier función no mockeada explícitamente,
 * garantizando aislamiento total del backend en los tests.
 * Llamar DESPUÉS de los mocks específicos de functions si se quiere overridear.
 */
export async function mockEdgeFunctions(page: Page) {
  await page.route(`${SUPABASE_URL}/functions/v1/**`, (route) =>
    json(route, { status: 'mock', mocked: true }),
  );
}

/**
 * Simula un usuario NO autenticado (getUser devuelve 401).
 */
export async function mockUnauthenticated(page: Page) {
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
    json(route, { message: 'JWT expired' }, 401),
  );
  await page.route(`${SUPABASE_URL}/auth/v1/token**`, (route) =>
    json(route, { error: 'invalid_grant' }, 400),
  );
}
