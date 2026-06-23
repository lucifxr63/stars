# Go-Live Cashflow — Runbook de despliegue (CASHFLOW_PRD_PART_5)

## ✅ Ya ejecutado por el agente (verificado)
- **`vercel.json`** creado con rewrite SPA (`/(.*) → /index.html`) — sin esto, `/auth/callback` daría 404 en Vercel.
- **Supabase Redirect URLs** (allowlist) ahora incluye:
  `https://cashflow.scouttech.lat/**` y `https://cashflow.scouttech.lat/auth/callback`.
- **CORS de Edge Functions:** `https://cashflow.scouttech.lat` añadido a `_shared/cors.ts`; redeployadas `cashflow-invoices`, `cashflow-recurring`, `cashflow-parse-pdf`. Verificado: el preflight devuelve `Access-Control-Allow-Origin: https://cashflow.scouttech.lat`.
- **Build de producción** (`npm run build` = `tsc --noEmit && vite build`): sin errores.

## 🔧 Pendiente — requiere TUS cuentas (no tengo acceso a hosting/DNS/Resend)

### 1. Deploy del frontend a Vercel (monorepo)
El proyecto ahora vive en `startups/cashflow`, dentro del mismo repo (`lucifxr63/stars`)
que Validus. Es un Vercel Project **separado** del de Validus, apuntando a la subcarpeta:

- Vercel → Add New Project → importa el repo `lucifxr63/stars`.
- **Root Directory: `cashflow`** (clave del monorepo).
- Framework preset: **Vite** · Build: `npm run build` · Output: `dist`.
- Environment Variables (Production):
  - `VITE_SUPABASE_URL = https://fcdhcntyvsydnvjwopfe.supabase.co`
  - `VITE_SUPABASE_ANON_KEY = sb_publishable_xkYMatUQAD8aMl-8ns0aeg_q9hrck6L`

O por CLI:
```bash
cd E:\DEV\Respos\Trabajo\startups\cashflow
npx vercel --prod        # primera vez: vincula/crea el proyecto (root = cashflow)
```

### 2. Subdominio `cashflow.scouttech.lat`
- En Vercel → Project → Domains → add `cashflow.scouttech.lat`.
- En tu DNS (donde vive scouttech.lat): crea el **CNAME** `cashflow → cname.vercel-dns.com` (Vercel te dará el valor exacto).
- Espera propagación + emisión del certificado TLS.

### 3. Resend (entregabilidad del correo)
- En Resend → Domains → add `scouttech.lat` → copia los registros que te muestre:
  - **SPF**: TXT `@` → `v=spf1 include:resend.com ~all` (o el que indique Resend si ya tienes SPF, fusiónalo).
  - **DKIM**: 1–3 CNAME (`resend._domainkey...`) con los valores exactos de Resend.
  - **DMARC** (recomendado): TXT `_dmarc` → `v=DMARC1; p=none;`.
- Tras verificar el dominio, corre el **dry-run** (envía solo a ti):
  ```bash
  set RESEND_API_KEY=re_xxx
  set DEV_EMAIL=lucianoalonso2000@gmail.com
  node launch/dry-run-send.mjs
  ```

## 🔥 Smoke Test (tú, antes del blast)
1. Abre `https://cashflow.scouttech.lat` en incógnito.
2. Login con tu cuenta de Google de Validus → debe redirigir a `/auth/callback` → `/dashboard`.
3. Crea una cuenta bancaria, sube un PDF de factura de prueba → la IA (Edge Function en prod) debe pre-llenar el formulario.
4. Si todo pasa → autorización para enviar a los 2 usuarios reales + las cuentas de prueba.

> Cuando el dominio esté en vivo, avísame: puedo correr un check externo (resolución DNS + smoke test del `/auth/callback` y de las Edge Functions en prod) y darte el reporte de validación.
