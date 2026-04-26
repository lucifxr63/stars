# ValidateAI — Estado actual del proyecto (Abril 2026)

## Qué es

ValidateAI es una SPA que guía a emprendedores a través de un wizard de 6 pasos para validar ideas de negocio usando IA. Al final genera un score (0–100), feedback y un plan de MVP.

**URL producción:** https://validateai-mu.vercel.app  
**Stack:** React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Vercel

---

## Stack detallado

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + Vite + TypeScript | React 19, TS 6 |
| Estilos | Tailwind CSS v4 + shadcn/ui | - |
| Estado cliente | Zustand (con persist) | v5 |
| Backend / Auth / DB | Supabase | JS SDK v2 |
| AI (Edge Function) | OpenAI GPT-4o-mini | via Supabase Edge Functions (Deno) |
| PDF Export | jsPDF + html2canvas | - |
| Routing | React Router v7 | - |
| Forms | React Hook Form + Zod | - |
| Animaciones | Framer Motion | v12 |
| Notificaciones | Sonner | - |
| Gráficos (admin) | Recharts | v3 |
| Hosting | Vercel | - |

---

## Estructura de carpetas

```
validateai/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # ProtectedLayout (auth guard)
│   │   └── routes/
│   │       ├── Landing.tsx         # Página de inicio / marketing
│   │       ├── Login.tsx           # Auth: email+password + Google OAuth
│   │       ├── AuthCallback.tsx    # Maneja redirect OAuth, upsert profile
│   │       ├── Validate.tsx        # Wizard principal (6 pasos)
│   │       ├── Results.tsx         # Lista de validaciones del usuario
│   │       ├── ValidationDetail.tsx # Detalle de una validación
│   │       └── Admin.tsx           # Panel admin (solo lucianoalonso2000@gmail.com)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── wizard/                 # StepIdea, StepQuestions, StepCustomer, StepValueProp, StepMVP, StepSummary
│   │   ├── layout/
│   │   │   ├── Header.tsx          # Con link Admin visible solo para admin
│   │   │   └── Footer.tsx
│   │   └── shared/
│   │       ├── LoadingAI.tsx
│   │       ├── ExportPDF.tsx
│   │       └── ScoreGauge.tsx
│   ├── hooks/
│   │   └── useValidation.ts        # saveStep(), callAI(), lógica del wizard
│   ├── stores/
│   │   └── validationStore.ts      # Zustand store (persisted en localStorage)
│   ├── lib/
│   │   ├── supabase.ts             # createClient con flowType: 'pkce'
│   │   └── pdf.ts                  # Helpers PDF
│   └── types/
│       └── validation.ts           # Types: StepIdea, StepQuestions, etc.
├── supabase/
│   ├── functions/
│   │   └── ai-validate/index.ts    # Edge Function (Deno) → llama OpenAI
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_admin_policies.sql
│       └── 003_fix_profile_trigger.sql
├── vercel.json                     # SPA rewrite: /* → index.html
└── public/
```

---

## Base de datos (Supabase)

### Tabla: `profiles`
Extiende `auth.users`. Se crea via trigger `handle_new_user` al registrarse.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | = auth.users.id |
| full_name | text | Viene de Google OAuth `name` o `full_name` |
| avatar_url | text | URL de foto de Google |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: usuarios ven/editan solo su propio profile. Admin (`is_admin()`) puede leer todos.

### Tabla: `validations`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| status | text | `in_progress` / `completed` / `archived` |
| current_step | int | 1–6 |
| idea_name | text | Step 1 |
| idea_description | text | Step 1 |
| idea_industry | text | Step 1 |
| questions_answers | jsonb | Step 2 — array de {question, answer} |
| customer_segment | text | Step 3 |
| customer_pain_points | text[] | Step 3 |
| customer_context | text | Step 3 |
| value_proposition | text | Step 4 |
| differentiator | text | Step 4 |
| mvp_type | text | Step 5 — `web_app/mobile_app/service/marketplace/saas/api` |
| mvp_features | jsonb | Step 5 — array de {name, description, priority} |
| mvp_user_flow | text | Step 5 |
| summary_json | jsonb | Step 6 — strengths, weaknesses, next_steps |
| ai_feedback | text | Step 6 |
| validation_score | int | 0–100 |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-update trigger |
| completed_at | timestamptz | |

RLS: usuarios CRUD solo sus validaciones. Admin puede leer todas.

### Tabla: `ai_interactions`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| validation_id | uuid FK | |
| step | int | |
| prompt_type | text | `questions/customer_analysis/value_prop/mvp_generation/summary` |
| input_data | jsonb | |
| output_data | jsonb | |
| tokens_used | int | |
| model | text | Default: `claude-sonnet-4-20250514` (actualmente usa `gpt-4o-mini`) |
| created_at | timestamptz | |

RLS: usuarios ven sus propias interacciones. Admin puede leer todas.

---

## Flujo de autenticación

- **Email/password:** signUp + signInWithPassword de Supabase
- **Google OAuth:** `signInWithOAuth` con PKCE flow → redirect a `/auth/callback` → `exchangeCodeForSession` → upsert en `profiles` con nombre/avatar de Google → navega a `/validate`
- **Guard:** `ProtectedLayout` verifica sesión con `onAuthStateChange`

---

## Wizard (6 pasos)

1. **StepIdea** — Nombre, descripción, industria
2. **StepQuestions** — AI genera 5 preguntas → usuario responde
3. **StepCustomer** — AI analiza y sugiere segmento + pain points
4. **StepValueProp** — AI genera propuesta de valor + diferenciador
5. **StepMVP** — AI recomienda tipo de MVP + features priorizadas (must/should/could)
6. **StepSummary** — AI genera score (0–100), feedback, strengths/weaknesses/next_steps

Cada paso llama a la Edge Function `ai-validate` y persiste en Supabase via `useValidation.saveStep()`.

---

## Edge Function AI (`supabase/functions/ai-validate`)

- Corre en Deno en Supabase Edge Functions
- **Actualmente usa OpenAI GPT-4o-mini** (no Claude — aunque el schema default dice `claude-sonnet`)
- Autenticación: verifica JWT del usuario antes de procesar
- Guarda cada llamada en `ai_interactions`
- 5 tipos de prompts: `questions`, `customer_analysis`, `value_prop`, `mvp_generation`, `summary`
- Responde siempre JSON puro

**Variable de entorno requerida en Supabase:** `OPENAI_API_KEY`

---

## Admin Panel (`/admin`)

Protegido por email hardcodeado (`lucianoalonso2000@gmail.com`). Sidebar oscuro con 4 tabs:

| Tab | Contenido |
|-----|-----------|
| **Métricas** | KPIs (usuarios, validaciones, score promedio, completitud), predicción a 30 días, gráfico de validaciones por día, distribución de scores, industrias (pie chart), AI por step |
| **Usuarios** | Tabla con avatar, nombre, ID, cantidad de validaciones, actividad semanal, fecha de registro |
| **Validaciones** | Tabla filtrable por estado, con expansión de fila para ver `ai_feedback` y `summary_json` |
| **AI Usage** | KPIs de tokens/costo, gráfico de tokens por día, tabla de interacciones recientes con badge de modelo por proveedor |

---

## Issues conocidos / deuda técnica

| Prioridad | Issue | Detalle |
|-----------|-------|---------|
| 🔴 Alta | **Edge Function usa OpenAI, no Claude** | El spec dice Claude pero la implementación usa `gpt-4o-mini`. Migrarlo a Anthropic SDK |
| 🔴 Alta | **idea_name e idea_industry pueden ser null** | Si el usuario abandona el wizard en step 1 sin guardar, quedan null en DB |
| 🟡 Media | **Sin límite de validaciones por usuario** | No hay rate limiting ni plan freemium |
| 🟡 Media | **Sin onboarding / tour** | El usuario llega y no sabe qué hacer |
| 🟡 Media | **Sin emails transaccionales** | No hay confirmación de registro, bienvenida, ni resumen de validación |
| 🟡 Media | **PDF export básico** | Generado con html2canvas, frágil y sin branding |
| 🟠 Baja | **Sin tests** | Ni unitarios ni e2e |
| 🟠 Baja | **Sin analytics de producto** | No hay Posthog/Mixpanel para ver funnel de conversión |
| 🟠 Baja | **Admin sin paginación** | Las tablas cargan todo en memoria |

---

## Variables de entorno

### Frontend (Vercel)
```
VITE_SUPABASE_URL=https://fcdhcntyvsydnvjwopfe.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### Supabase Edge Functions (Secrets)
```
OPENAI_API_KEY=...
SUPABASE_URL=... (auto)
SUPABASE_SERVICE_ROLE_KEY=... (auto)
```

---

## Estado de features

| Feature | Estado |
|---------|--------|
| Auth email/password | ✅ Funcional |
| Auth Google OAuth | ✅ Funcional |
| Wizard 6 pasos | ✅ Funcional |
| AI en cada paso | ✅ Funcional (GPT-4o-mini) |
| Score y resumen final | ✅ Funcional |
| Export PDF | ✅ Funcional (básico) |
| Historial de validaciones | ✅ Funcional |
| Admin panel | ✅ Funcional |
| Métricas y predicción | ✅ Funcional |
| Emails transaccionales | ❌ No implementado |
| Plan freemium / pagos | ❌ No implementado |
| Tests | ❌ No implementado |
| Analytics | ❌ No implementado |
| Mobile responsive | ⚠️ Parcial |
