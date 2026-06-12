# Runbook de Lanzamiento — Inicio de Etapa Ops (Demo100)

> Ejecutar con credenciales de producción (Supabase + Vercel). Orden importa.
> Project ref Supabase: `fcdhcntyvsydnvjwopfe`. App: validus.scouttech.lat (Vercel).
> Fecha: 2026-06-12.

## Pre-flight (estado actual)

- **Frontend (Vercel):** auto-deploy en cada push a `main`. Último commit `a98aac1`.
  Ya incluye soft-wall `/demo`, waitlist `/pricing`, Command Center, throttle (inerte).
  → Verificar en el dashboard de Vercel que el último build (commit `a98aac1`) está *Ready*.
- **Edge Functions (Supabase):** NO se despliegan con git push. Requieren `supabase functions deploy` manual (pasos abajo).
- **CI:** gate `@smoke` (Playwright) verde — 43 passed local.

---

## Paso 1 · Deploy de Edge Functions

```bash
# Requiere supabase CLI + login (SUPABASE_ACCESS_TOKEN o `supabase login`)
supabase link --project-ref fcdhcntyvsydnvjwopfe   # si no está linkeado en tu máquina

# 1a. Remitente Resend sobre scouttech.lat (queda en DRY RUN hasta el secret del Paso 3)
supabase functions deploy send-quick-lead

# 1b. Defensa Nivel 1 — throttle de modelo (INERTE: comportamiento idéntico hasta el Paso 4)
supabase functions deploy ai-validate
```

**Riesgo:** bajo. `send-quick-lead` sigue guardando leads igual (DRY RUN sin secret).
`ai-validate` con `THROTTLE_MODE` ausente = ruteo idéntico al actual (free/quick→Haiku, resto→Sonnet).

---

## Paso 2 · Variables de entorno (telemetría)

**Vercel (Project → Settings → Environment Variables → Production):**
```
VITE_POSTHOG_KEY    = <project API key de PostHog>
VITE_POSTHOG_HOST   = https://app.posthog.com   # o el proxy first-party ya configurado
```
> Sin estas, los eventos `demo_paywall_hit` / `checkout_waitlist_captured` / UTM **no se emiten**
> y el análisis de conversión vuela a ciegas. Redeploy de Vercel tras setearlas.

---

## Paso 3 · Resend (apagar el DRY RUN del email)

1. Resend → **Add Domain** `scouttech.lat`.
2. En el DNS de `scouttech.lat` agregar los registros que Resend exige: **SPF + DKIM** (y DMARC).
3. Esperar verificación (puede tardar por propagación DNS).
4. Setear el secret en Supabase:
   ```bash
   supabase secrets set RESEND_API_KEY=<token de Resend>
   ```
5. Redeploy para tomar el secret:
   ```bash
   supabase functions deploy send-quick-lead
   ```

> El remitente ya apunta a `Validus <hola@scouttech.lat>` (override por env `FROM_EMAIL` si se quiere).

---

## Paso 4 · (CONTINGENCIA — NO ahora) Activar el throttle

Solo si el burn rate se dispara (ver `docs/TELEMETRY_QUERIES_LAUNCH.md`):
```bash
supabase secrets set THROTTLE_MODE=on   # basic/pro estándar → Haiku; web_search se mantiene Sonnet
```
Revertir: `supabase secrets unset THROTTLE_MODE` (o `=off`). No requiere redeploy de código.

---

## Paso 5 · Smoke test post-deploy

**Automatizado (local, sin credenciales prod):**
```bash
cd validateai && npx playwright test --grep @smoke   # 43 passed esperado
```

**Manual en prod (incógnito, sin VPN — ver protocolo completo de la Mesa):**
1. **ToFu:** `/demo?utm_source=linkedin&utm_medium=qa_test&utm_campaign=smoke_test` → pestaña Riesgo → "Desbloquear con mi email" → enviar `qa-tofu@scouttech.lat`.
   - Supabase: `SELECT * FROM email_leads WHERE email='qa-tofu@scouttech.lat'` → existe, `validation_id IS NULL`.
   - PostHog: `demo_paywall_hit` + `demo_lead_captured` con `utm_source=linkedin`.
2. **BoFu:** `/pricing` → "Reservar acceso" → enviar `qa-bofu@scouttech.lat`.
   - PostHog: `checkout_waitlist_captured`.
3. **MoFu:** login cuenta free → wizard quick → submit → **redirect duro a /dashboard** + widget "procesando".
4. **Infra:** logs `supabase functions logs send-quick-lead` → `[DRY RUN]` (si DNS no listo) o email entregado.

---

## Rollback

- **Waitlist → cobro real (cuando Legal destrabe LemonSqueezy):** revertir commit `cd40a15` + redeploy Vercel.
- **Edge function rota:** `supabase functions deploy <fn>` con el commit anterior (git checkout del archivo + deploy).
- **Throttle:** `THROTTLE_MODE=off`.

## Relojes
- **Legal / LemonSqueezy:** deadline 2026-06-19 → si se cruza, ticket bypass MercadoPago (`docs/LEGAL_ESCALATION_TEMPLATE.md`).
- **Corte de datos:** hoy 18:00 CLT (`docs/TELEMETRY_QUERIES_LAUNCH.md`).
