# Rollout — Identidad de empresa compartida del ecosistema

> Objetivo: cada app del ecosistema pide (una vez) la identidad de la **empresa** del usuario
> —RUT de negocio + razón social— y la guarda en una **tabla compartida**, para que todas la usen
> y la pasen a Bralidus → S-Pulse. **NO** es el RUT personal (ese va hasheado, ver Día D).

## Estado

| Pieza | Estado |
|---|---|
| Migración `company_identity` (Supabase compartido) | ✅ escrita — `validateai/supabase/migrations/20260715000000_company_identity.sql` · ⏳ **falta aplicar** |
| Referencia: **nexus** (S-Pulse UI) | ✅ implementada + desplegada (PR S-Pulse#4) |
| Validus | ⏳ pendiente |
| Bralidus (frontend) | ⏳ pendiente |
| Denarius / Cashflow | ⏳ pendiente |
| Licitus | ⏳ pendiente |
| **Consumo**: pasar `company_rut` a Bralidus→S-Pulse (path DD de Validus) | ⏳ pendiente (el payoff) |

## 0. Aplicar la migración (bloquea la activación)

En el **Supabase compartido `fcdhcntyvsydnvjwopfe`** → SQL Editor, correr
`validateai/supabase/migrations/20260715000000_company_identity.sql`. Crea la tabla
`company_identity(user_id PK, company_rut, company_name, timestamps)` con RLS por `auth.uid()`.
Hasta aplicarla, los gates **degradan** (no bloquean) — la lectura devuelve `false` y se saltea.

## Patrón (implementado en nexus, replicar por app)

3 piezas + 1 wiring, todas contra el cliente Supabase compartido de cada app:

1. **Validador de RUT** (módulo 11) — `lib/rut.{js,ts}` (`isValidRut`, `formatRut`, `cleanRut`).
2. **Acceso a la tabla** — `lib/companyIdentity.{js,ts}`:
   - `getCompanyIdentity()` → `objeto | null (sin identidad → gate) | false (tabla/err → no bloquear)`.
   - `saveCompanyIdentity({company_rut, company_name})` → upsert por `user_id`.
3. **Gate UI** — componente que pide RUT (empresa) + razón social, valida y upsertea.
4. **Wiring** — tras la sesión, si `getCompanyIdentity() === null` → mostrar el gate antes de la app.

Archivos de referencia en `S-Pulse/frontend/src/{lib/rut.js, lib/companyIdentity.js,
auth/CompanyIdentityGate.jsx, auth/AuthProvider.jsx}`.

## Pasos por app

### Validus (`validateai/`, React 19 + TS) — PRIORIDAD (es el consumidor S-Pulse)
- Cliente Supabase: `@/lib/supabase`. Auth: `routes/Login.tsx` + `AuthCallback.tsx` + guard del router.
- Añadir `lib/rut.ts` + `lib/companyIdentity.ts` + un gate; montarlo en el guard (después del login,
  antes del dashboard).
- **Consumo (payoff):** en el path **Due Diligence** (no en el wizard cacheado — envenena la caché
  por perfil), leer `company_identity` y agregar `startup_context.company_rut` + `tenant_id` al body
  de `_shared/bralidus.ts::callBralidusMoE`. Con eso Bralidus dispara `build_relationship_context`
  (S-Pulse) → el valor por-empresa llega al usuario.

### Bralidus (`lucifxr63/Bralidus`, Vite + TS)
- Ya tiene `src/lib/supabase.ts`, `pages/Login.tsx`, `pages/AuthCallback.tsx`, router en `App.tsx`.
- Replicar `lib/rut.ts` + `lib/companyIdentity.ts` + `pages/CompanyIdentityGate.tsx`; montar como
  `ProtectedRoute` previo al dashboard.

### Denarius / Cashflow (`cashflow/`)
- Mismo patrón; identificar su cliente Supabase y el punto post-login.

### Licitus (`pymengine` frontend, Next.js/Cloudflare)
- Next App Router: el gate como layout/guard en el segmento autenticado; `lib/companyIdentity.ts`
  con el cliente Supabase del proyecto.

## Verificación (por app)
1. Aplicar la migración.
2. Usuario sin identidad → tras login aparece el gate; RUT inválido → error; RUT válido + razón
   social → guarda y entra.
3. Segundo login (o en otra app del ecosistema) → NO vuelve a pedir (identidad compartida).
4. (Validus) una validación DD → la respuesta de Bralidus trae relaciones S-Pulse; en logs de
   `bralidus-api`, pegó a `/spulse/companies/{rut}/*`.
