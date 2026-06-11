# One-Pager — Épica Control de Acceso (Demo 100)

**Estado: CERRADA ✅** · Fecha: 2026-06-11 · Stack: Vite + React Router 7 + Supabase (no Next.js)

---

## 1. Qué se entregó (mergeado a `main`, validado contra prod)

| # | Entregable | Evidencia |
|---|---|---|
| 1 | **Protección de rutas** | `ProtectedLayout` (React Router) — no middleware Next.js. Guarda todo el árbol privado vía `onAuthStateChange`, sin FOUC. Ya existía; auditado. |
| 2 | **Aislamiento de datos (RLS)** | Auditoría completa: **todas** las tablas con `user_id` tienen RLS owner. Único hueco sellado: `usage_counters` (deny-all a clientes). Probado diferencial en prod (3 filas reales → demo ve 0). |
| 3 | **Recuperación de contraseña** | Flujo PKCE end-to-end: `/forgot-password` + `/reset-password`. Anti-enumeración. |
| 4 | **Expiración de sesión** | Distingue logout deliberado de `SIGNED_OUT` inesperado → limpia estado + re-login con aviso. |
| 5 | **Cuentas demo pre-pobladas** | `seed-demo-accounts.ts` idempotente: 4 tiers, email confirmado, onboarding + consent Ley 21.719 pre-registrados. |
| 6 | **Golden Validation (MediConnect)** | demo_pro (9 deliverables) y demo_premium (11 + gobernanza + fundraising + EvidenceWall). Reporte instantáneo, sin riesgo de timeout de IA en escena. |

**PRs:** #5 (golden) y #6 (consent) — mergeados / en revisión. Auth epic → merge `6735e7e`.

---

## 2. Fuera de alcance — POR DISEÑO (ratificado por la Mesa)

- **Multi-tenant / `public.companies`** → se mantiene **tenancy per-user**. Evita scope creep pre-demo.
- **Tracking de IP completa / geo / device fingerprint** → se mantiene **PII minimizada** (IP truncada a /24). Privacidad por diseño = argumento de venta B2B bajo Ley 21.719.
- **APIs reales de Reddit / Google Trends** → EvidenceWall usa datos **curados/ilustrativos** (entorno controlado, declarado).
- **Tamaño de empresa (rango de empleados)** → único campo de perfilamiento faltante; se agrega como `<select>` **post-demo** (no bloquea).

---

## 3. Métricas de éxito

### A) Día del Demo (operacional — binario)
Éxito = **cero fallos en vivo**:
- ✅ Las 4 cuentas demo entran directo a `/dashboard` (sin email-confirm, sin onboarding, sin modal de consent).
- ✅ Reporte MediConnect carga en **< 2 s** (pre-load, cero llamadas IA en escena).
- ✅ El "Aha!" (score 84 + veredicto + TAM/SAM/SOM) visible en **< 30 s** desde el login.

### B) Línea base del MVP (usuarios reales, post-demo)
Estrella polar = **TTV → primer `validation_completed`**. Fuente: `validations.completed_at − profiles.created_at`, y embudo en PostHog.

| Métrica | 🟢 Éxito rotundo | 🟡 Aceptable (ajustes menores) | 🔴 Ajuste inmediato |
|---|---|---|---|
| **TTV** (mediana, signup → 1er `validation_completed`) | **≤ 8 min** (supera la promesa de 10 min) | 8 – 15 min | **> 15 min** mediana, o p75 > 25 min |
| **`wizard_abandoned`** (% que completa paso 1 y nunca llega a `validation_completed`) | **≤ 35 %** | 35 – 55 % | **> 55 %** |
| **Caída por paso individual** (diagnóstico) | ningún paso pierde > 20 % | un paso pierde 20–30 % | algún paso pierde **> 30 %** → ahí está la fricción |
| **Tasa de activación** (% de signups que llegan a `validation_completed`) | ≥ 50 % | 30 – 50 % | < 30 % |

**Rationale:** el producto promete "validá tu idea en 10 minutos" (testimonial del login). El umbral verde de TTV (≤ 8 min) **bate la propia promesa**; el rojo (> 15 min) significa que la generación síncrona o un paso del wizard está rompiendo la experiencia. La caída por paso es más accionable que el agregado: dice *dónde* arreglar.

### C) Señales de conversión (secundarias, ya instrumentadas)
`paywall_hit` → `upgrade_cta_clicked` (intención de pago), `deliverable_viewed` (profundidad de valor percibido), DAU/WAU (retención). Sin umbral duro pre-demo — se observan para la narrativa de inversión.

---

## 4. Decisión que la junta debe ratificar
Cerrar la conversación de infraestructura base. La épica de Control de Acceso está **cerrada y desplegada**. El foco pasa a **conversión y experiencia**: TTV, abandono del wizard y el "Aha!" de MediConnect.
