# Validus â€” Estado actual del proyecto (Mayo 2026)

## QuÃ© es

Validus es una SPA que guÃ­a a emprendedores a travÃ©s de un wizard de 4 pasos (Idea, Mercado, Fundador, GeneraciÃ³n) para validar ideas de negocio usando IA. Al final genera un score (0â€“100), feedback y mÃºltiples entregables avanzados, incluyendo un mapa 3D interactivo del mercado chileno.

**URL producciÃ³n:** https://validus.scouttech.lat  
**Stack:** React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Vercel

---

## Stack detallado

| Capa | TecnologÃ­a | VersiÃ³n |
|------|-----------|---------|
| Frontend | React + Vite + TypeScript | React 19, TS 6 |
| Estilos | Tailwind CSS v4 + shadcn/ui | - |
| Estado cliente | Zustand (con persist) | v5 |
| Backend / Auth / DB | Supabase | JS SDK v2 |
| AI (Edge Function) | Dual Provider: Anthropic (default) / OpenAI (fallback) | via Supabase Edge Functions (Deno) |
| GrÃ¡ficos y 3D | Recharts / Three.js + R3F | - |
| PDF Export | Primitivas de jsPDF | - |
| Routing | React Router v7 | - |
| Forms | React Hook Form + Zod | - |
| Animaciones | Framer Motion | v12 |
| Notificaciones | Sonner | - |

---

## Estructura de carpetas

```text
validateai/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ layout.tsx              # ProtectedLayout (auth guard)
â”‚   â”‚   â””â”€â”€ routes/
â”‚   â”‚       â”œâ”€â”€ Landing.tsx         # PÃ¡gina de inicio / marketing
â”‚   â”‚       â”œâ”€â”€ Login.tsx           # Auth: email+password + Google OAuth
â”‚   â”‚       â”œâ”€â”€ AuthCallback.tsx    # Maneja redirect OAuth, upsert profile
â”‚   â”‚       â”œâ”€â”€ Validate.tsx        # Wizard principal (4 pasos)
â”‚   â”‚       â”œâ”€â”€ Results.tsx         # Lista de validaciones del usuario
â”‚   â”‚       â”œâ”€â”€ ValidationDetail.tsx # Detalle de una validaciÃ³n (Dashboard)
â”‚   â”‚       â”œâ”€â”€ IdeaHistory.tsx     # Historial de versiones y pivotes
â”‚   â”‚       â”œâ”€â”€ MarketStudy.tsx     # Mapa 3D y estudio de mercado (Chile)
â”‚   â”‚       â”œâ”€â”€ Admin.tsx           # Panel admin (MÃ©tricas, Usuarios, AI)
â”‚   â”‚       â”œâ”€â”€ SharedValidation.tsx # ValidaciÃ³n pÃºblica
â”‚   â”‚       â””â”€â”€ Pricing.tsx         # Planes y precios
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ ui/                     # shadcn/ui components
â”‚   â”‚   â”œâ”€â”€ wizard/                 # StepIdea, StepMarket, StepFounder, StepGenerating, FlowSelector
â”‚   â”‚   â”œâ”€â”€ market/                 # Componentes para mapa 3D y anÃ¡lisis de mercado
â”‚   â”‚   â”œâ”€â”€ layout/                 # Header, Footer
â”‚   â”‚   â””â”€â”€ shared/                 # ExportPDF, ScoreBreakdown, ReanalyzeModal, MentorRecommendations
â”‚   â”œâ”€â”€ hooks/                      # useAI, useMarketAnalysis, useMentors, useTrainingData, useUserTier, useValidation, useValidationHistory
â”‚   â”œâ”€â”€ stores/
â”‚   â”‚   â””â”€â”€ validationStore.ts      # Zustand store (persisted en localStorage)
â”‚   â”œâ”€â”€ data/                       # Datos estÃ¡ticos (ej: exampleReport)
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ supabase.ts             # createClient con flowType: 'pkce'
â”‚   â”‚   â””â”€â”€ pdf.ts                  # Helpers PDF
â”‚   â””â”€â”€ types/                      # Interfaces (PromptType, Validation, etc.)
â”œâ”€â”€ supabase/
â”‚   â”œâ”€â”€ functions/
â”‚   â”‚   â”œâ”€â”€ ai-validate/            # Dual provider (Anthropic/OpenAI) + RAG + Cache
â”‚   â”‚   â”œâ”€â”€ market-analyze/         # Datos de BCCh + INE
â”‚   â”‚   â””â”€â”€ anonymize-idea/         # AnonimizaciÃ³n con Claude Haiku
â”‚   â””â”€â”€ migrations/                 # 18 migraciones SQL
```

---

## Base de datos (Supabase)

### Tabla: `profiles`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | = auth.users.id |
| tier | text | `free`, `basic`, `pro`, `premium` |
| training_consent | bool | Para uso en datasets |

### Tabla: `validations`
19+ columnas. Flujo central de la validaciÃ³n.
- **Wizard limit:** `current_step` (1 a 4).
- **History/Pivots:** `parent_id`, `version`, `pivot_reason`.
- **Advanced fields:** `score_breakdown`, `founder_context`, `risk_analysis`, `unit_economics`, etc.

### Otras tablas clave:
- `market_ine_classifications`, `market_bde_data`, `market_ai_insights` (Mercado Chile)
- `competitors`, `cached_analyses` (RAG y cachÃ© de reportes)
- `mentors` (Sistema de mentores)
- `training_data` (Dataset anonimizado)

---

## Edge Functions AI

1. **`ai-validate`**: FunciÃ³n central. 18 prompt types. Routing dual automÃ¡tico (Anthropic/OpenAI). Utiliza RAG con competidores y cachÃ© semÃ¡ntico.
2. **`market-analyze`**: Obtiene y clasifica datos del mercado chileno.
3. **`anonymize-idea`**: Genera resúmenes genéricos (Haiku) para la tabla `training_data`.
4. **`api-v1` (Animus Engine v2.0 / Bralidus RaaS)**: Motor canónico B2G/B2B (Mercado Público ChileCompra, Licitus y Macroeconomía) con rate limiting por tiers (`free` con 500 créditos de testing/mes). La tabla canónica `licitaciones_mercado_publico` está **vacía** (falta escribir la ingesta `mp-sync`); mientras tanto los endpoints B2G leen de **Licitus** en vivo y marcan la procedencia con `meta.source = 'licitus_live'`. Si Licitus tampoco responde: 503, nunca datos inventados.

**Variables de entorno requeridas en Supabase:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_PROVIDER` (default 'anthropic').

---

## Issues conocidos / deuda técnica

| Prioridad | Issue | Detalle |
|-----------|-------|---------|
| Alta | **idea_name e idea_industry nulls** | Si el usuario interrumpe el wizard en step 1, quedan nulos. |
| Media | **Admin sin paginación** | Tablas del admin cargan todo en memoria. |
| Media | **Matching de Mentores** | La búsqueda usa limitación básica, no RPC semántico completo. |
| Media | **Monolito `ai-validate`** | Función de 800+ líneas con 18 prompts. Difícil de escalar. |
| Media | **Generación Síncrona** | La generación bloquea el request, ideal migrar a queue. |
| Baja | **Sin tests / Analytics** | Faltan unit/E2E tests y Posthog/Mixpanel. |

---

## Estado de features

| Feature | Estado |
|---------|--------|
| Auth email/Google | ✅ Funcional |
| Wizard 4 pasos | ✅ Funcional |
| AI Dual Provider | ✅ Funcional |
| Dashboard / Entregables avanzados | ✅ Funcional |
| 3D Market Map Chile | ✅ Funcional |
| Historial / Pivotes | ✅ Funcional |
| Export PDF (nativo jsPDF) | ✅ Funcional |
| Mentores (básico) | ✅ Funcional |
| Planes / Tiers UI | ✅ Funcional |
| Admin panel | ✅ Funcional |
| Anonimización (Training Data) | ✅ Funcional |
| **Animus Engine v2.0 (API v1 B2G & Bralidus RaaS)** | ⚠️ En producción, leyendo de Licitus en vivo — la ingesta canónica `mp-sync` no existe aún |
| **Rate Limits por Tiers (`api-v1/ratelimit.ts`)** | ✅ Funcional (Plan Free: 500 créditos prueba / 30 req/min) |
| Datos económicos (`/data/macro`, `/data/economy`) | ⚠️ Crons agendados el 2026-07-29 tras 66 días congelados — ver `20260729000001_cron_economic_data.sql` |
| Emails transaccionales | ⚠️ `followup-email` desplegada y con cron diario, en DRY RUN hasta DNS de scouttech.lat |
| Checkout / Pagos | ⚠️ `create-checkout` + `lemonsqueezy-webhook` desplegadas; faltan secrets de LemonSqueezy |
