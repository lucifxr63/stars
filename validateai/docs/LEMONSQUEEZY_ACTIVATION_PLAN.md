# Validus — Plan de Activación de Cobro (LemonSqueezy)

> **Estado:** Test-ready · 2026-06-30 (Fase 12)
> **Resumen:** la infraestructura de cobro **existe y está probada**; el cobro está **apagado por defecto** (flag off → waitlist Early Bird). Activarlo es **configuración** (secrets + flag), no código. **No hay cargos reales hasta que un humano lo habilite.**

## 1. Estado actual

| Pieza | Estado |
|---|---|
| Edge Function `create-checkout` | ✅ lista (crea checkout en LS, devuelve URL, pasa `custom: {user_id, tier}`) |
| Edge Function `lemonsqueezy-webhook` | ✅ lista (valida firma `hmac.ts`, mapea variant→tier `webhookTiers.ts`, actualiza `profiles.tier`, audita en `tier_events`) |
| Lógica de tiers (`webhookTiers.ts`, `hmac.ts`) | ✅ pura y **con tests** |
| `CheckoutSuccess.tsx` | ✅ polea `profiles.tier` (8×2s), copy honesto si el webhook aún no confirma |
| Helper frontend `src/lib/checkout.ts` | ✅ (Fase 12) — `isCheckoutConfigured` / `getCheckoutMode` / `startCheckout` / `isWaitlistFallback` |
| CTAs (Pricing / UpgradeModal) | ✅ (Fase 12) — checkout si configurado, **fallback a waitlist** si no |
| **Secrets en Supabase / productos en LS / flag en prod** | ⛔ **pendiente — configuración humana** |

## 2. Variables de entorno requeridas

### Frontend (Vite — público, en Vercel)
```
VITE_CHECKOUT_ENABLED=true        # activa el checkout (default: false → waitlist)
VITE_CHECKOUT_MODE=test           # test | live (informativo para analítica)
```

### Servidor (Supabase Edge Function secrets — NUNCA en el repo ni en el frontend)
```
LEMONSQUEEZY_API_KEY
LS_STORE_ID
LS_VARIANT_BASIC
LS_VARIANT_PRO
LS_VARIANT_PREMIUM
LEMONSQUEEZY_WEBHOOK_SECRET
SUPABASE_SERVICE_ROLE_KEY        # ya usado por las Edge Functions
```

## 3. Checklist de configuración en LemonSqueezy

- [ ] Crear (o usar) un **Store** → anotar `Store ID`.
- [ ] Crear un **Product** "Validus" con 3 **Variants**: Basic, Pro, Premium → anotar los 3 `Variant ID`.
- [ ] Configurar precios (CLP, alineados a `Pricing.tsx`: $9.990 / $20.000 / $50.000).
- [ ] Generar una **API Key**.
- [ ] Crear un **Webhook** apuntando a `https://<supabase-ref>.functions.supabase.co/lemonsqueezy-webhook` con eventos de suscripción (`subscription_created/updated/cancelled/expired`) → anotar el **signing secret**.
- [ ] **Empezar en modo TEST** (test mode de LS) antes de cobrar de verdad.

## 4. Checklist de configuración en Vercel / Supabase

- [ ] Supabase → Edge Function secrets: setear los 6 secrets del §2 (servidor).
- [ ] Vercel → env vars: `VITE_CHECKOUT_ENABLED=true`, `VITE_CHECKOUT_MODE=test` (preview/staging primero).
- [ ] Re-deploy del frontend (los `VITE_` se inyectan en build).
- [ ] Verificar que `create-checkout` y `lemonsqueezy-webhook` están desplegadas.

## 5. Webhook esperado

LemonSqueezy → `lemonsqueezy-webhook`:
1. Valida la firma HMAC con `LEMONSQUEEZY_WEBHOOK_SECRET`.
2. Identifica al usuario por `custom.user_id` (inyectado en `create-checkout`).
3. Mapea `variant_id` → tier (`LS_VARIANT_*`).
4. Resuelve el tier efectivo por estado de la suscripción (`active`/`on_trial` → tier pagado; resto → `free`).
5. Actualiza `profiles.tier` y registra el evento en `tier_events`.

## 6. Plan de prueba (modo TEST)

1. `VITE_CHECKOUT_ENABLED=true`, `VITE_CHECKOUT_MODE=test` en un entorno de preview.
2. Secrets de LS en **test mode** en Supabase.
3. Comprar un plan con una **tarjeta de prueba** de LemonSqueezy.
4. Verificar: redirección a `create-checkout` → URL de LS → pago test → `redirect_url` a `/checkout/success`.
5. `CheckoutSuccess` debe polear y mostrar "Suscripción activada" cuando el webhook actualice `profiles.tier`.
6. Verificar en PostHog: `checkout_started` → (webhook) → `checkout_success_viewed`.
7. Verificar audit en `tier_events`.

## 7. Riesgos

- **Cobro accidental:** mitigado — flag off por defecto + modo test primero. No activar `live` sin validar test.
- **Webhook mal firmado / secret incorrecto:** el webhook rechaza → tier no se actualiza → `CheckoutSuccess` muestra "se actualizará en minutos" (honesto), sin romper.
- **Edge sin secrets pero flag on:** `create-checkout` falla → el frontend cae a **waitlist** (try/catch) → nunca estado roto.
- **Desalineación de precios** entre LS y `Pricing.tsx` → revisar en cada cambio.

## 8. Rollback

- Setear `VITE_CHECKOUT_ENABLED=false` (o quitarla) + re-deploy → vuelve **instantáneamente** a la waitlist Early Bird. Sin tocar código ni Edge Functions.
- Opcional: pausar/borrar el webhook en LS.

## 9. Qué NO está listo (config humana pendiente)

- Secrets reales en Supabase Edge.
- Productos/Variants creados en LemonSqueezy.
- Flag `VITE_CHECKOUT_ENABLED=true` en el entorno deseado.
- Validación de un pago real en modo test.

> Hasta completar lo anterior, Validus permanece **pre-revenue** con captación vía **waitlist Early Bird**. El código de Fase 12 no activa cobros por sí solo.
