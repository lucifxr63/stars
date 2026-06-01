# ValidateAI â€” Estado actual del proyecto (Mayo 2026)

## QuÃ© es

ValidateAI es una SPA que guÃ­a a emprendedores a travÃ©s de un wizard de 4 pasos (Idea, Mercado, Fundador, GeneraciÃ³n) para validar ideas de negocio usando IA. Al final genera un score (0â€“100), feedback y mÃºltiples entregables avanzados, incluyendo un mapa 3D interactivo del mercado chileno.

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
3. **`anonymize-idea`**: Genera resÃºmenes genÃ©ricos (Haiku) para la tabla `training_data`.

**Variables de entorno requeridas en Supabase:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_PROVIDER` (opcional, default 'anthropic').

---

## Issues conocidos / deuda tÃ©cnica

| Prioridad | Issue | Detalle |
|-----------|-------|---------|
| ðŸ”´ Alta | **idea_name e idea_industry nulls** | Si el usuario interrumpe el wizard en step 1, quedan nulos. |
| ðŸŸ¡ Media | **Rate limiting inexistente** | No hay rate limiting por tier en `ai-validate`. |
| ðŸŸ¡ Media | **Admin sin paginaciÃ³n** | Tablas del admin cargan todo en memoria. |
| ðŸŸ¡ Media | **Matching de Mentores** | La bÃºsqueda usa limitaciÃ³n bÃ¡sica, no RPC semÃ¡ntico completo. |
| ðŸŸ¡ Media | **Monolito `ai-validate`** | FunciÃ³n de 800+ lÃ­neas con 18 prompts. DifÃ­cil de escalar. |
| ðŸŸ¡ Media | **GeneraciÃ³n SÃ­ncrona** | La generaciÃ³n bloquea el request, ideal migrar a queue. |
| ðŸŸ  Baja | **Sin tests / Analytics** | Faltan unit/E2E tests y Posthog/Mixpanel. |

---

## Estado de features

| Feature | Estado |
|---------|--------|
| Auth email/Google | âœ… Funcional |
| Wizard 4 pasos | âœ… Funcional |
| AI Dual Provider | âœ… Funcional |
| Dashboard / Entregables avanzados | âœ… Funcional |
| 3D Market Map Chile | âœ… Funcional |
| Historial / Pivotes | âœ… Funcional |
| Export PDF (nativo jsPDF) | âœ… Funcional |
| Mentores (bÃ¡sico) | âœ… Funcional |
| Planes / Tiers UI | âœ… Funcional |
| Admin panel | âœ… Funcional |
| AnonimizaciÃ³n (Training Data) | âœ… Funcional |
| Rate Limits reales | âŒ No implementado |
| Emails transaccionales | âŒ No implementado |
| Checkout / Pagos | âŒ No implementado |
