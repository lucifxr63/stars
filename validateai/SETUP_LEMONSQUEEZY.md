# Setup Pendiente: Lemon Squeezy (Pagos)

> **Estado:** PENDIENTE — requiere configuración manual antes de aceptar pagos reales.
> Revisado por: Claude Code · 2026-05-22

---

## Qué falta

El código del flujo de pagos está completo y funcional. Solo faltan los pasos manuales en el dashboard de Lemon Squeezy y cargar los secrets en Supabase.

---

## Pasos (en orden)

### 1. Crear cuenta y Store en Lemon Squeezy
- Ir a https://lemonsqueezy.com
- Crear Store: moneda **CLP**, país **Chile**
- Anotar el **Store ID** (Settings del store o URL)

### 2. Crear los 3 productos como suscripción mensual

| Plan    | Precio      |
|---------|-------------|
| Basic   | $9.990 CLP  |
| Pro     | $19.990 CLP |
| Premium | $29.990 CLP |

Para cada uno: Product → Billing: **Recurring → Monthly**

Después de crear cada producto ir a su pestaña **Variants** y anotar el **Variant ID** (número de 6-7 dígitos).

### 3. Crear el Webhook

- Settings → Webhooks → Add webhook
- **URL:** `https://<REF>.supabase.co/functions/v1/lemonsqueezy-webhook`
  - El `<REF>` está en Supabase → Settings → General → Reference ID
- **Events a activar:**
  - `subscription_created`
  - `subscription_updated`
  - `subscription_cancelled`
  - `subscription_expired`
  - `subscription_payment_failed`
- Anotar el **Signing Secret** generado

### 4. Crear API Key

- Settings → API → Create key → anotar la clave

### 5. Cargar secrets en Supabase

Supabase Dashboard → Edge Functions → Manage secrets:

```
LEMONSQUEEZY_API_KEY   = <api key del paso 4>
LS_STORE_ID            = <store id del paso 1>
LS_VARIANT_BASIC       = <variant id de Basic>
LS_VARIANT_PRO         = <variant id de Pro>
LS_VARIANT_PREMIUM     = <variant id de Premium>
LS_WEBHOOK_SECRET      = <signing secret del paso 3>
```

### 6. Desplegar las edge functions

```bash
supabase functions deploy create-checkout
supabase functions deploy lemonsqueezy-webhook
```

---

## Archivos relevantes

| Archivo | Descripción |
|---------|-------------|
| `supabase/functions/create-checkout/index.ts` | Crea sesión de checkout en LS |
| `supabase/functions/lemonsqueezy-webhook/index.ts` | Recibe eventos y actualiza `profiles.tier` |
| `supabase/migrations/20260504_stripe_billing.sql` | Columnas `ls_subscription_id` y `tier_expires_at` en profiles |
| `src/app/routes/Pricing.tsx` | UI de planes — llama a `create-checkout` |

## Flujo cuando esté configurado

```
Usuario hace clic en "Empezar con Pro"
  → create-checkout crea sesión en LS
  → usuario paga en LS Checkout
  → LS dispara subscription_created
  → lemonsqueezy-webhook actualiza profiles.tier = 'pro'
  → useUserTier.ts lo detecta y desbloquea las secciones
```

---

## Lo que YA está hecho (no tocar)

- `create-checkout` soporta basic / pro / premium
- `lemonsqueezy-webhook` maneja los 5 eventos (creación, actualización, cancelación, expiración, fallo de pago)
- Verificación HMAC de la firma del webhook
- Migrations aplicadas (`ls_subscription_id`, `tier_expires_at`)
- Tier premium restaurado en el CHECK constraint de `profiles`
