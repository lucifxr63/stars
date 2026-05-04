# ValidateAI — Estado actual del proyecto (Mayo 2026)

## Qué es

ValidateAI es una SPA que guía a emprendedores a través de un wizard de 4 pasos (Idea, Mercado, Fundador, Generación) para validar ideas de negocio usando IA. Al final genera un score (0–100), feedback y múltiples entregables avanzados, incluyendo un mapa 3D interactivo del mercado chileno.

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
| AI (Edge Function) | Dual Provider: Anthropic (default) / OpenAI (fallback) | via Supabase Edge Functions (Deno) |
| Gráficos y 3D | Recharts / Three.js + R3F | - |
| PDF Export | Primitivas de jsPDF | - |
| Routing | React Router v7 | - |
| Forms | React Hook Form + Zod | - |
| Animaciones | Framer Motion | v12 |
| Notificaciones | Sonner | - |

---

## Estructura de carpetas

```text
validateai/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # ProtectedLayout (auth guard)
│   │   └── routes/
│   │       ├── Landing.tsx         # Página de inicio / marketing
│   │       ├── Login.tsx           # Auth: email+password + Google OAuth
│   │       ├── AuthCallback.tsx    # Maneja redirect OAuth, upsert profile
│   │       ├── Validate.tsx        # Wizard principal (4 pasos)
│   │       ├── Results.tsx         # Lista de validaciones del usuario
│   │       ├── ValidationDetail.tsx # Detalle de una validación (Dashboard)
│   │       ├── IdeaHistory.tsx     # Historial de versiones y pivotes
│   │       ├── MarketStudy.tsx     # Mapa 3D y estudio de mercado (Chile)
│   │       ├── Admin.tsx           # Panel admin (Métricas, Usuarios, AI)
│   │       ├── SharedValidation.tsx # Validación pública
│   │       └── Pricing.tsx         # Planes y precios
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── wizard/                 # StepIdea, StepMarket, StepFounder, StepGenerating, FlowSelector
│   │   ├── market/                 # Componentes para mapa 3D y análisis de mercado
│   │   ├── layout/                 # Header, Footer
│   │   └── shared/                 # ExportPDF, ScoreBreakdown, ReanalyzeModal, MentorRecommendations
│   ├── hooks/                      # useAI, useMarketAnalysis, useMentors, useTrainingData, useUserTier, useValidation, useValidationHistory
│   ├── stores/
│   │   └── validationStore.ts      # Zustand store (persisted en localStorage)
│   ├── data/                       # Datos estáticos (ej: exampleReport)
│   ├── lib/
│   │   ├── supabase.ts             # createClient con flowType: 'pkce'
│   │   └── pdf.ts                  # Helpers PDF
│   └── types/                      # Interfaces (PromptType, Validation, etc.)
├── supabase/
│   ├── functions/
│   │   ├── ai-validate/            # Dual provider (Anthropic/OpenAI) + RAG + Cache
│   │   ├── market-analyze/         # Datos de BCCh + INE
│   │   └── anonymize-idea/         # Anonimización con Claude Haiku
│   └── migrations/                 # 18 migraciones SQL
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
19+ columnas. Flujo central de la validación.
- **Wizard limit:** `current_step` (1 a 4).
- **History/Pivots:** `parent_id`, `version`, `pivot_reason`.
- **Advanced fields:** `score_breakdown`, `founder_context`, `risk_analysis`, `unit_economics`, etc.

### Otras tablas clave:
- `market_ine_classifications`, `market_bde_data`, `market_ai_insights` (Mercado Chile)
- `competitors`, `cached_analyses` (RAG y caché de reportes)
- `mentors` (Sistema de mentores)
- `training_data` (Dataset anonimizado)

---

## Edge Functions AI

1. **`ai-validate`**: Función central. 18 prompt types. Routing dual automático (Anthropic/OpenAI). Utiliza RAG con competidores y caché semántico.
2. **`market-analyze`**: Obtiene y clasifica datos del mercado chileno.
3. **`anonymize-idea`**: Genera resúmenes genéricos (Haiku) para la tabla `training_data`.

**Variables de entorno requeridas en Supabase:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_PROVIDER` (opcional, default 'anthropic').

---

## Issues conocidos / deuda técnica

| Prioridad | Issue | Detalle |
|-----------|-------|---------|
| 🔴 Alta | **idea_name e idea_industry nulls** | Si el usuario interrumpe el wizard en step 1, quedan nulos. |
| 🟡 Media | **Rate limiting inexistente** | No hay rate limiting por tier en `ai-validate`. |
| 🟡 Media | **Admin sin paginación** | Tablas del admin cargan todo en memoria. |
| 🟡 Media | **Matching de Mentores** | La búsqueda usa limitación básica, no RPC semántico completo. |
| 🟡 Media | **Monolito `ai-validate`** | Función de 800+ líneas con 18 prompts. Difícil de escalar. |
| 🟡 Media | **Generación Síncrona** | La generación bloquea el request, ideal migrar a queue. |
| 🟠 Baja | **Sin tests / Analytics** | Faltan unit/E2E tests y Posthog/Mixpanel. |

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
| Rate Limits reales | ❌ No implementado |
| Emails transaccionales | ❌ No implementado |
| Checkout / Pagos | ❌ No implementado |
