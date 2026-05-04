# Lemon Squeezy — Setup de Pagos para ValidateAI

> Estado: **Pendiente de configuración**  
> Las edge functions `create-checkout` y `lemonsqueezy-webhook` ya están implementadas.  
> Solo falta configurar la cuenta, crear los productos y agregar los secrets.

---

## ¿Por qué Lemon Squeezy?

- **Merchant of Record** — ellos facturan al cliente y manejan impuestos. No requiere empresa constituida ni RUT tributario chileno.
- Acepta tarjetas internacionales (Visa, Mastercard, Amex) + PayPal.
- Transferencia a cuenta bancaria chilena vía Wise o PayPal.
- Sin comisión fija: **5% por transacción** (sin fee mensual).
- API simple, sin SDK requerido.

---

## Paso 1 — Crear cuenta

1. Ir a [app.lemonsqueezy.com](https://app.lemonsqueezy.com) → Sign up
2. Completar el onboarding (nombre de tienda, país: Chile, moneda: USD o CLP)
3. Configurar método de retiro: **Wise** (recomendado para Chile) o PayPal

---

## Paso 2 — Obtener el Store ID

1. En el dashboard → **Settings → Stores**
2. Copiar el número del Store ID (ej. `123456`)

---

## Paso 3 — Crear los 3 productos (suscripciones)

Para cada tier, crear un **Product** de tipo **Subscription**:

| Tier    | Nombre          | Precio sugerido | Billing  |
|---------|-----------------|-----------------|----------|
| Basic   | ValidateAI Basic   | $11 USD / mes   | Monthly  |
| Pro     | ValidateAI Pro     | $22 USD / mes   | Monthly  |
| Premium | ValidateAI Premium | $33 USD / mes   | Monthly  |

> **Nota sobre precios en CLP:** Lemon Squeezy maneja precios en USD. Si quieres mostrar CLP en la landing, usa los equivalentes aproximados. El cobro real será en USD.

**Para cada producto:**
1. Products → New Product → Type: **Subscription**
2. Agregar una **Variant** con el precio mensual
3. Copiar el **Variant ID** (número visible en la URL o en la tabla de variants)

---

## Paso 4 — Configurar el Webhook

1. Settings → **Webhooks** → Add webhook
2. URL:
   ```
   https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/lemonsqueezy-webhook
   ```
3. Activar estos eventos:
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
   - `subscription_payment_failed`
4. Copiar el **Signing Secret** generado

---

## Paso 5 — Obtener la API Key

1. Settings → **API** → New API Key
2. Nombre: `ValidateAI Production`
3. Copiar la key (empieza con `eyJ...`)

---

## Paso 6 — Agregar Secrets en Supabase

En el dashboard de Supabase → **Edge Functions → Secrets**, agregar:

```
LEMONSQUEEZY_API_KEY   = eyJ...          # API key del paso 5
LS_STORE_ID            = 123456           # Store ID del paso 2
LS_VARIANT_BASIC       = 111111           # Variant ID de Basic
LS_VARIANT_PRO         = 222222           # Variant ID de Pro
LS_VARIANT_PREMIUM     = 333333           # Variant ID de Premium
LS_WEBHOOK_SECRET      = abc123xyz        # Signing secret del paso 4
```

---

## Paso 7 — Deploy de las Edge Functions

```bash
supabase functions deploy create-checkout
supabase functions deploy lemonsqueezy-webhook
```

---

## Paso 8 — Aplicar la migración de DB

```bash
supabase db push
```

Esto agrega `ls_subscription_id` y `tier_expires_at` a la tabla `profiles`.

---

## Paso 9 — Prueba end-to-end (modo test)

1. En Lemon Squeezy → activar **Test Mode** (toggle en el dashboard)
2. En la app, ir a `/pricing` y hacer clic en "Empezar con Basic"
3. Usar tarjeta de prueba: `4242 4242 4242 4242` / cualquier fecha futura / CVC: `123`
4. Verificar en Supabase → tabla `profiles` que el campo `tier` se actualizó a `basic`
5. Verificar en PostHog que no se disparan errores

---

## Arquitectura del flujo de pago

```
Usuario hace clic en "Empezar con Pro"
  → Pricing.tsx llama POST /functions/v1/create-checkout
      → create-checkout verifica JWT del usuario
      → llama API de Lemon Squeezy → crea Checkout Session
      → devuelve { url: "https://checkout.lemonsqueezy.com/..." }
  → Frontend redirige a la URL de checkout (hosted por LS)
      → Usuario completa el pago en la página de LS
      → LS dispara webhook → /functions/v1/lemonsqueezy-webhook
          → verifica firma HMAC-SHA256
          → evento subscription_created → UPDATE profiles SET tier = 'pro'
  → Usuario llega a /dashboard?upgrade=success
```

---

## Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| `create-checkout` retorna 500 | `LS_VARIANT_XXX` o `LS_STORE_ID` no configurados | Verificar secrets en Supabase |
| Webhook no llega | URL incorrecta o eventos no seleccionados | Revisar paso 4 |
| Tier no se actualiza | `user_id` no llega en `custom_data` | Verificar que el JWT del usuario sea válido al crear el checkout |
| Firma inválida | `LS_WEBHOOK_SECRET` incorrecto | Regenerar en LS Dashboard → Webhooks |

---

## Contacto soporte Lemon Squeezy

- Docs: [docs.lemonsqueezy.com](https://docs.lemonsqueezy.com)
- Discord: [discord.gg/lemonsqueezy](https://discord.gg/lemonsqueezy)
