# Denarius — Documentación de Producto y Arquitectura

> **Denarius** (ex *Cashflow*) — control de flujo de caja en tiempo real para PYMEs
> y startups de LatAm. Producto hermano de **Validus**; el nombre sigue la lógica
> de marcas en latín (*denarius* = la moneda romana de plata).
>
> Estado: **EN PRODUCCIÓN** · Última actualización: 2026-06-24
> Producción: https://denarius.scouttech.lat · https://cashflow-phi-nine.vercel.app
>
> ⚠️ **Nota sobre el nombre:** "Denarius" es el nombre de **marca** (UI, dominio).
> A nivel de **código e infraestructura** el identificador sigue siendo `cashflow`:
> esquema Supabase `cashflow`, Edge Functions `cashflow-*`, bucket `cashflow_docs`,
> carpeta del repo `cashflow/`, proyecto Vercel `cashflow`. Renombrarlos implica una
> migración mayor sobre un proyecto Supabase compartido con Validus y está fuera de
> alcance hasta decidirlo explícitamente.

---

## 1. ¿Qué es y para quién?

Denarius responde una sola pregunta con precisión: **"¿cuánta caja tengo hoy y
cuándo me quedo sin?"**. Está pensado para fundadores y dueños de PYMEs que hoy
viven en planillas Excel frágiles.

**Trabajos que resuelve (jobs-to-be-done):**

- Ver la **caja actual** consolidada y su **proyección** a 30/90/365 días.
- Calcular **Runway** (meses de vida) y **Burn mensual** sin pedir historial.
- Anticipar el **saldo mínimo proyectado** (¿qué semana entro en rojo?).
- Reservar la **caja restringida por impuestos** para que el runway no mienta.
- Gestionar **facturas** por cobrar (A/R) y por pagar (A/P) con vencimientos.
- Cargar **gastos/ingresos fijos** una sola vez (Burn Rate Autopilot).
- **Simular** escenarios ("¿y si este cliente no paga?") ocultando eventos.
- Un lente **SaaS** interno: aportes de socios, gastos e ingresos multimoneda.

**Premisa de negocio:** SPA + BaaS, máxima velocidad de salida al mercado sin
comprometer aislamiento multi-tenant ni rendimiento (presupuesto RLS < 50 ms).

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, TypeScript, Vite 6 |
| Estilos | Tailwind CSS v4 (`@theme inline`), tema dark/light |
| Estado | Zustand (`auth`, `theme`) |
| Routing | React Router 7 |
| Gráficos | Recharts 3 |
| Formularios | React Hook Form + Zod |
| Toasts | Sonner |
| Iconos | lucide-react |
| Tipografía | Space Grotesk (display) + IBM Plex Sans (cuerpo/cifras) |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions Deno) |
| IA | Claude (parsing de PDF de facturas) |
| Deploy | Vercel (SPA estática) |

---

## 3. Estructura del repo (subárbol `cashflow/`)

Denarius vive dentro del monorepo **`stars`** (junto a `validateai`/Validus). Su
raíz es la carpeta `cashflow/`.

```
cashflow/
├── index.html              # Entry; script anti-flash de tema + fuentes Google
├── vite.config.ts          # Alias @/ → src/, plugin React + Tailwind v4
├── vercel.json             # buildCommand, outputDirectory, SPA rewrites
├── ARCHITECTURE.md         # Anexo de arquitectura del esquema `cashflow`
├── DENARIUS.md             # (este documento)
├── STITCH_BRIEF.md         # Brief de diseño para Google Stitch
├── design/stitch/          # Referencias de UI generadas por Stitch (dark+light)
└── src/
    ├── main.tsx            # createRoot + BrowserRouter
    ├── App.tsx             # Rutas + init de auth/theme + Toaster
    ├── index.css           # Tokens de tema (dual) + Tailwind v4
    ├── pages/
    │   ├── Landing.tsx     # Marketing público
    │   ├── Login.tsx       # Google OAuth
    │   ├── Dashboard.tsx   # Núcleo: KPIs, proyección, facturas, fijos
    │   └── SaasCashflow.tsx# Lente SaaS interno (/saas)
    ├── components/         # UI: charts, formularios, listas, ThemeToggle…
    │   └── ui/             # Primitivas: button, confirm
    ├── hooks/              # useCashflow, useCashflowAnalytics, useCashflowExtra
    ├── lib/                # supabase, queries, projection, auth, utils, types DB
    ├── store/              # auth.ts, theme.ts (Zustand)
    └── types/              # Tipos del lente SaaS no derivados de tablas
```

Las **Edge Functions** NO viven aquí: están en
`validateai/supabase/functions/cashflow-*` (proyecto Supabase compartido).

---

## 4. Arquitectura general

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│  SPA React (Vercel)         │         │  Supabase (proyecto compartido)    │
│  denarius.scouttech.lat     │         │  fcdhcntyvsydnvjwopfe              │
│                             │         │                                    │
│  pages → hooks → lib/queries│──HTTPS─▶│  Postgres · esquema `cashflow`     │
│         │                   │  RLS    │   tablas tenant/bank_account/…     │
│         │ supabase-js       │◀────────│  Auth (Google OAuth, SSO futuro)   │
│         │ (schema=cashflow) │         │  Storage `cashflow_docs`           │
│         └─ functions.invoke │──JWT───▶│  Edge Functions Deno `cashflow-*`  │
│  projection.ts (motor local)│         │   (validan getUser → operan bajo   │
└─────────────────────────────┘         │    RLS con el JWT del usuario)     │
                                         └──────────────────────────────────┘
```

- **Sin servidor monolítico.** La lógica vive entre el cliente y Supabase.
- **El motor de proyección corre en el cliente** (`lib/projection.ts`): no persiste
  nada; calcula la curva "al vuelo". Cero basura en la BD.
- **Las Edge Functions** validan la sesión (`getUser`) y operan con el JWT del
  usuario, de modo que la RLS acota los datos. Devuelven **JSON puro**.

### 4.1 Aislamiento de esquema

Denarius opera **íntegramente bajo el esquema `cashflow`**, aislado de `public`
(donde vive Validus). El cliente fija `db.schema = 'cashflow'`
(`createClient<Database, 'cashflow'>`), así `supabase.from('…')` resuelve contra
`cashflow.*` sin `.schema()` por llamada. La única superficie compartida es
`auth.users` (para SSO futuro). Ver [ARCHITECTURE.md](ARCHITECTURE.md).

### 4.2 Seguridad — Flat RLS

Regla rectora: **prohibido JOIN/subconsultas en políticas RLS** (presupuesto
< 50 ms). Se **desnormaliza `owner_id` (= `auth.uid()`)** en todas las tablas
tenant-scoped, con política plana:

```sql
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()))
```

`owner_id` referencia `auth.users(id) ON DELETE CASCADE` → borrar el usuario purga
todas sus filas (privacidad + teardown atómico). En cada `INSERT` el cliente
inyecta `owner_id` desde la sesión (lo exige el `WITH CHECK`).

---

## 5. Modelo de dominio (esquema `cashflow`)

**Núcleo (flujo de caja genérico):**

- `tenant` — empresa del usuario (`owner_id`, `default_tax_rate`,
  `weekly_alerts_enabled`).
- `bank_account` — cuentas (`current_balance`, mantenido por trigger).
- `transaction` — movimientos reales IN/OUT (historial contable).
- `invoice` — facturas A/R (por cobrar) y A/P (por pagar), con `status`
  (PENDING/PAID/CANCELLED), `due_date`, `source_system`.
- `recurring_transaction` — reglas de ingreso/gasto fijo (IN/OUT) con `frequency`
  y `next_date`. **No genera filas futuras**: las expande el motor.
- `profiles` — extensión de identidad (creada por trigger desde `auth.users`).
- `pdf_usage` — cuota de parsing de PDF (Beta).

**Lente SaaS / control interno** (migración `20260704000000`):

- `partner_contributions` — aportes de socios (premisa: préstamo a la empresa).
- `expense` — gastos con fuente de fondeo (`funded_by` COMPANY/PARTNER), desglose
  neto/IVA/total.
- `revenue` — ingresos SaaS multimoneda (USD→CLP + comisión de pasarela). El KPI de
  caja es `net_income_clp`; bruto y comisión quedan como desglose.

**IVA configurable:** `expense` y `revenue` llevan `vat_status` (AFECTO|EXENTO) +
`vat_amount` editable (sin 19% rígido). Integración con SII → Fase 2.

---

## 6. El motor de proyección (`lib/projection.ts`)

Es el corazón del producto. Construye la serie diaria de **"Saldo Disponible
Real"** desde hoy hasta el horizonte, y de ahí derivan los KPIs y el gráfico.

### 6.1 Modelo de vencimientos asimétrico

| Evento | Tratamiento |
|--------|-------------|
| **A/P vencida** | Se mueve a **HOY** (peor escenario: quema inmediata) |
| **A/R vencida** | **No se proyecta** → va al *Centro de Resolución* (acción manual) |
| A/R y A/P futuras (PENDING) | Se proyectan en su `due_date` |
| PAID / CANCELLED | Se ignoran |

### 6.2 Eventos fantasma (Burn Rate Autopilot)

`recurring_transaction` no crea filas futuras: `phantomEvents()` expande cada regla
en sus ocurrencias dentro del horizonte (WEEKLY/MONTHLY/QUARTERLY/YEARLY) y las
inyecta "al vuelo" sobre la curva. Así el usuario carga su nómina/arriendo **una
sola vez** y la proyección los estresa con precisión temporal (no desgaste lineal).

### 6.3 Reserva de impuestos

Si `taxRate > 0`, cada ingreso proyectado (A/R o IN recurrente) entra **neto**
(`amount * (1 - taxRate/100)`). El % reservado queda fuera del disponible y se
expone como **Caja Restringida** (`restrictedTax()`). Es estimación bruta — no
descuenta crédito fiscal.

### 6.4 KPIs (`computeKpis`)

- **Caja actual** — saldo consolidado de cuentas.
- **Burn mensual** — quema neta mensual (>0). Combina el neto histórico (trailing
  90 d) con los recurrentes normalizados a mensual → realista sin historial.
- **Runway** — `currentCash / monthlyBurn` (meses), o ∞ si no hay quema.
- **Saldo mínimo proyectado** — el punto más bajo de la curva + su fecha.
- **Caja Restringida (Impuestos)** — monto reservado sobre ingresos proyectados.

### 6.5 Granularidad y simulador

- `aggregate()` colapsa la serie diaria a semanal (12 sem / 90 d, default) o mensual
  (saldo al cierre del bucket).
- **Simulador What-If:** el Dashboard mantiene un `Set` de IDs "ocultos"; la
  proyección excluye esos eventos para responder "¿y si…?" sin tocar datos.

---

## 7. Edge Functions (Deno, JSON puro)

En `validateai/supabase/functions/`:

| Función | `verify_jwt` | Rol |
|---------|:---:|-----|
| `cashflow-invoices` | true | CRUD de facturas A/R · A/P |
| `cashflow-recurring` | true | CRUD de gastos/ingresos fijos |
| `cashflow-tenant-settings` | true | PATCH de ajustes del tenant (tasa, alertas) |
| `cashflow-parse-pdf` | true | Parsing IA (Claude) de PDF de facturas |
| `cashflow-analytics` | true | Agregación mensual SaaS (`?tenant_id&period`) |
| `cashflow-weekly-cron` | false | Alertas semanales (dormante, Fase 2) |

Todas usan el helper CORS compartido `_shared/cors.ts`.

> **Deuda técnica:** `cashflow-analytics` calcula `initial_balance` agregando el
> histórico al vuelo. Refactor a snapshots `pg_cron` atado a volumen futuro.

---

## 8. Sistema de theming (dark / light)

Patrón canónico de Tailwind v4 en [`src/index.css`](src/index.css):

- `@custom-variant dark (&:where(.dark, .dark *))` → el modo se controla con la
  clase `.dark` en `<html>` (no por `prefers-color-scheme` directo), para permitir
  **override manual persistente**.
- Tokens crudos en `:root` (light, default) y `.dark` (override) → `--background`,
  `--card`, `--primary`, `--accent`, `--danger`, `--amber`, etc.
- `@theme inline` mapea esos tokens a utilidades (`bg-background`, `text-primary`…),
  emitiendo `var()` en el sitio de uso → el override de `.dark` se resuelve solo.

**Semántica de color (idéntica en ambos temas):** esmeralda = positivo/CTA ·
violeta = tech/simulación · rojo = negativo/vencido · ámbar = caja restringida. En
light, los colores semánticos se oscurecen para contraste AA.

**Selección de tema** ([`src/store/theme.ts`](src/store/theme.ts)): preferencia
`system` por defecto + toggle sol/luna persistente (`localStorage['cf_theme']`).
Un script inline en `index.html` fija la clase **antes del primer paint** (sin
flash). Los gráficos Recharts leen el tema resuelto para elegir paleta
(grid/ejes/tooltip/datos), ya que no consumen utilidades de Tailwind.

---

## 9. Autenticación

- **Google OAuth (PKCE)** vía Supabase (`signInWithGoogle` en `lib/auth.ts`), con
  `redirectTo = ${window.location.origin}/auth/callback`.
- `RequireAuth` protege `/dashboard` y `/saas`; `AuthCallback` procesa el retorno.
- El proyecto Supabase es **compartido con Validus**. Por eso, todo dominio nuevo
  debe estar en la **allowlist de Redirect URLs** de Supabase Auth; si no, Supabase
  ignora el `redirectTo` y cae al **Site URL** (validus.scouttech.lat). Allowlist
  actual incluye: `validus.scouttech.lat`, `cashflow.scouttech.lat`,
  `cashflow-phi-nine.vercel.app`, `denarius.scouttech.lat` y `localhost:5173/5174`.

---

## 10. CORS

Las Edge Functions usan `_shared/cors.ts`, que valida el `Origin` contra una
allowlist (`ALLOWED_ORIGINS`) y, si no coincide, cae al primero (validus). El
preflight declara:

- `Access-Control-Allow-Origin`: el origen permitido (eco del request).
- `Access-Control-Allow-Headers`: `authorization, x-client-info, apikey, content-type`.
- `Access-Control-Allow-Methods`: `GET, POST, PATCH, PUT, DELETE, OPTIONS`
  (PATCH/PUT/DELETE **deben** declararse: no son métodos "safelisted").

> Al agregar un dominio nuevo: añadir su origen a `ALLOWED_ORIGINS` **y redeployar**
> las funciones `cashflow-*` (el helper se empaqueta dentro de cada función).

---

## 11. Despliegue

- **Frontend (Vercel):** proyecto `cashflow`. `buildCommand: npm run build`,
  `outputDirectory: dist`, SPA rewrites a `/index.html`. Dominios:
  `denarius.scouttech.lat` (custom) y `cashflow-phi-nine.vercel.app` (auto). Deploy
  manual: `vercel --prod` desde `cashflow/`.
- **Edge Functions (Supabase):** `supabase functions deploy <fn> --project-ref
  fcdhcntyvsydnvjwopfe` desde `validateai/` (respeta `verify_jwt` de `config.toml`).
- **Migraciones:** ⚠️ el tracking remoto está **roto**. **Nunca** `supabase db
  push`. Aplicar cada migración aislada vía SQL Editor o Management API y registrar
  la versión en `supabase_migrations.schema_migrations`.

---

## 12. Variables de entorno

`.env.local` (no commitear):

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (cliente) |
| `VITE_SUPABASE_ANON_KEY` | Anon/publishable key (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo server/scripts; nunca al cliente |
| `SUPABASE_ACCESS_TOKEN` | Management API + deploy de funciones |
| `VITE_POSTHOG_HOST` | Telemetría (opcional) |

---

## 13. Desarrollo local

```bash
npm install
npm run dev        # Vite en localhost:5173/5174 (ya en la allowlist)
npm run build      # tsc --noEmit && vite build
npm run preview    # sirve dist/
npm run gen:types  # regenera src/lib/database.types.ts desde el esquema cashflow
```

**Certificación:** `launch/integration-test-saas.mjs` valida el pipeline del lente
SaaS de punta a punta (insert vía RLS, rechazo de `owner_id` ajeno, contrato JSON de
`cashflow-analytics`, aislamiento cross-tenant) bajo protocolo de cero huella.

---

## 14. Diseño (Google Stitch)

La dirección visual del rediseño dark/light se generó con **Google Stitch** (vía su
MCP). El brief reutilizable está en [STITCH_BRIEF.md](STITCH_BRIEF.md) y las
referencias (HTML + PNG, dark y light de cada pantalla) en
[design/stitch/](design/stitch/). Esos artefactos son **referencia**, no se copian
tal cual: la fuente de verdad de los tokens es `src/index.css`.

---

## 15. Convenciones y "gotchas"

- **Marca vs. código:** "Denarius" solo en strings visibles; identificadores siguen
  siendo `cashflow` (ver nota del encabezado).
- **Proyecto Supabase compartido con Validus** → cuidado con `site_url`, allowlists
  y CORS: cambios mal hechos rompen Validus.
- **RLS plano**: nunca JOIN/subconsultas en políticas; siempre desnormalizar
  `owner_id`; inyectarlo en cada INSERT.
- **Proyección en el cliente**: los recurrentes NO se persisten como filas futuras.
- **Friction Check** antes de cada feature: viabilidad técnica, impacto UX, costo/
  mantenibilidad. Preferir siempre la solución más simple que valide el negocio.

---

## 16. Roadmap (resumen)

- **Fase 2 — SII / IVA real:** descuento de crédito fiscal, no solo reserva bruta.
- **Conexión bancaria / import Excel:** atención a la *duplicación táctica* (un pago
  real + su evento fantasma); definir reconciliación.
- **Alertas semanales por correo:** activar `cashflow-weekly-cron`.
- **SSO con Validus:** aprovechar `auth.users` compartido.
- **Snapshots `pg_cron`** para `cashflow-analytics` cuando crezca el volumen.

---

_Documento derivado del código vivo (projection.ts, queries.ts, supabase.ts,
index.css, theme.ts, cors.ts), de ARCHITECTURE.md y de los PRD del repo. Mantener
sincronizado si cambian tokens, tablas o el contrato de las Edge Functions._
