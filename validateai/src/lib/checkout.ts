import { supabase } from '@/lib/supabase';

// ─── Fase 12: estado de checkout (LemonSqueezy) con fallback a waitlist ────────
// El cobro real se habilita SOLO con el flag de entorno + secrets configurados en
// Supabase Edge (LEMONSQUEEZY_API_KEY, LS_STORE_ID, LS_VARIANT_*). Por defecto el
// flag está apagado → el flujo cae a la waitlist Early Bird (sin cargos).
//
// Diseño: el frontend NUNCA conoce secrets; solo un booleano público de toggle.
// La Edge Function `create-checkout` (server-side) usa los secrets reales.

const CHECKOUT_ENABLED = import.meta.env.VITE_CHECKOUT_ENABLED === 'true';
const CHECKOUT_MODE = (import.meta.env.VITE_CHECKOUT_MODE as string | undefined) ?? 'test';

export type PaidTier = 'basic' | 'pro' | 'premium';
export type CheckoutMode = 'test' | 'live' | 'disabled';

/** ¿El checkout real está habilitado por configuración? Si no, se usa waitlist. */
export function isCheckoutConfigured(): boolean {
  return CHECKOUT_ENABLED;
}

/** Modo efectivo del checkout, para badges/analítica (sin exponer secrets). */
export function getCheckoutMode(): CheckoutMode {
  if (!CHECKOUT_ENABLED) return 'disabled';
  return CHECKOUT_MODE === 'live' ? 'live' : 'test';
}

/** ¿El flujo cae a la waitlist Early Bird (checkout no configurado)? */
export function isWaitlistFallback(): boolean {
  return !CHECKOUT_ENABLED;
}

/**
 * Inicia un checkout de LemonSqueezy vía la Edge Function `create-checkout`.
 * Devuelve la URL de checkout. LANZA si no está configurado, no hay sesión, o
 * la Edge falla. El caller DEBE envolver en try/catch y caer a la waitlist.
 * No maneja secrets ni datos de pago en el cliente.
 */
export async function startCheckout(tier: PaidTier): Promise<string> {
  if (!CHECKOUT_ENABLED) throw new Error('checkout_disabled');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('no_session');

  const origin = window.location.origin;
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      tier,
      success_url: `${origin}/checkout/success`,
      cancel_url: `${origin}/pricing`,
    }),
  });
  if (!res.ok) throw new Error(`create_checkout_failed_${res.status}`);

  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error('no_checkout_url');
  return data.url;
}
