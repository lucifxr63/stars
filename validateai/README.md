# ValidateAI

Plataforma SaaS que guía a emprendedores a través de un wizard de 4 pasos para validar ideas de negocio usando IA. Genera un score (0–100), feedback cualitativo y hasta 18 entregables avanzados incluyendo análisis competitivo con web search, unit economics, founder-market fit y un mapa 3D del mercado chileno.

**Producción:** https://validateai-mu.vercel.app

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite + TypeScript 6 |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Estado | Zustand v5 (persist) |
| Routing | React Router v7 |
| Forms | React Hook Form + Zod |
| Animaciones | Framer Motion v12 |
| 3D / Mapas | Three.js + React Three Fiber + d3-geo |
| Gráficos | Recharts |
| PDF | jsPDF |
| Backend / Auth / DB | Supabase (Edge Functions Deno + PostgreSQL + pgvector) |
| AI primario | Anthropic Claude Sonnet 4 (con prompt caching) |
| AI fallback | OpenAI GPT-4o Mini |
| Hosting | Vercel |

---

## Inicio rápido

```bash
# Instalar dependencias
npm install

# Variables de entorno
cp .env.example .env.local
# Completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# Desarrollo
npm run dev

# Build de producción
npm run build

# Preview local
npm run preview
```

### Variables de entorno

**Frontend** (`.env.local`):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

**Supabase Edge Functions** (secrets del proyecto):
```
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
AI_PROVIDER=anthropic       # 'anthropic' | 'openai'
BDE_USER=...                # Banco Central de Chile API
BDE_PASS=...
```

---

## Estructura del proyecto

```
validateai/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # ProtectedLayout (auth guard)
│   │   └── routes/
│   │       ├── Landing.tsx         # Página de inicio
│   │       ├── Login.tsx           # Auth: email + Google OAuth
│   │       ├── AuthCallback.tsx    # PKCE callback
│   │       ├── Validate.tsx        # Wizard (4 pasos)
│   │       ├── Results.tsx         # Lista de validaciones
│   │       ├── ValidationDetail.tsx# Dashboard completo
│   │       ├── IdeaHistory.tsx     # Árbol de pivotes
│   │       ├── MarketStudy.tsx     # Mapa 3D + análisis de mercado
│   │       ├── Admin.tsx           # Panel admin
│   │       ├── SharedValidation.tsx# Validación pública
│   │       └── Pricing.tsx         # Planes y precios
│   ├── components/
│   │   ├── ui/                     # shadcn/ui
│   │   ├── wizard/                 # StepIdea, StepMarket, StepFounder, StepGenerating, FlowSelector
│   │   ├── market/                 # ChileMarketMap, RegionMesh, MarketMapLegend
│   │   ├── layout/                 # Header, Footer
│   │   └── shared/                 # ExportPDF, ScoreBreakdown, DeliverableTabs, ...
│   ├── hooks/
│   │   ├── useAI.ts                # Llamadas a ai-validate (abort-safe)
│   │   ├── useValidation.ts        # CRUD del wizard
│   │   ├── useUserTier.ts          # Tier del usuario desde profiles
│   │   ├── useMarketAnalysis.ts    # market-analyze edge function
│   │   ├── useMentors.ts           # Matching de mentores
│   │   ├── useTrainingData.ts      # Consentimiento + anonimización
│   │   └── useValidationHistory.ts # Árbol de versiones/pivotes
│   ├── stores/
│   │   └── validationStore.ts      # Zustand (persisted)
│   ├── types/
│   │   ├── validation.ts           # Zod schemas + interfaces
│   │   └── market.ts
│   └── lib/
│       ├── supabase.ts             # createClient con PKCE
│       ├── pdf.ts                  # Generación de PDF
│       └── utils.ts
├── supabase/
│   ├── functions/
│   │   ├── ai-validate/            # Core AI (18 prompt types, dual provider, RAG, caché)
│   │   ├── market-analyze/         # BCCh + INE + AI insights
│   │   └── anonymize-idea/         # Anonimización con Haiku
│   └── migrations/                 # 19 migraciones SQL
└── public/
    └── geo/
        └── chile-regiones.json     # GeoJSON 16 regiones
```

---

## Flujo principal

```
Usuario llena wizard (4 pasos)
  → React Hook Form + Zod valida cada paso
  → Zustand store persiste el estado
  → Step 4: POST /functions/v1/ai-validate (3 calls en paralelo)
      → JWT verify
      → Rate limit check (por tier, desde profiles)
      → Haiku pre-pass (estructura la descripción)
      → RAG (competitive_analysis: busca competidores similares)
      → Cache semántico (similarity ≥ 0.92)
      → Anthropic Claude Sonnet 4 / GPT-4o Mini
      → UPDATE validations + status='completed'
  → navigate('/results/:id')
  → Dashboard con entregables on-demand
```

---

## Edge Functions

### `ai-validate`
Función central. 18 tipos de prompt organizados en dos categorías:

**Wizard (generados automáticamente en Step 4):**
`summary` · `market_sizing` · `competitive_analysis`

**On-demand desde el Dashboard:**
`risk_analysis` · `unit_economics` · `founder_fit` · `market_signals` · `validation_kit` · `landing_generator` · `interview_script` · `tech_viability` · `first_100_customers` · `revenue_models` · `risk_checklist` · `pitch_letter`

**Rate limits por tier:**

| Tier | Calls/día | Expensive/día* |
|------|-----------|----------------|
| free | 5 | 0 |
| basic | 20 | 2 |
| pro | 50 | 5 |
| premium | 200 | 20 |

*Expensive = prompts con web_search (`competitive_analysis`, `market_sizing`, `market_signals`)

### `market-analyze`
Obtiene series macro del Banco Central de Chile (BCCh), clasifica la industria según INE CAENES, y genera insights con AI. Rate limit: 10 calls/día.

### `anonymize-idea`
Anonimiza ideas de negocio con Claude Haiku para el dataset de entrenamiento. Requiere consentimiento explícito del usuario. Rate limit: 5 calls/día.

---

## Sistema de tiers

```
free    → score, breakdown, preguntas, próximos pasos
basic   → + segmento cliente, propuesta de valor, análisis de riesgos
pro     → + MVP, SWOT, unit economics, founder-market fit
premium → todo (incluyendo señales de mercado, competitive analysis, deliverables)
```

El tier se lee de `profiles.tier` tanto en la UI (`useUserTier`) como en la Edge Function (rate limiting).

---

## Base de datos

**Tablas principales:**

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Extiende `auth.users`. Contiene `tier` y `training_consent` |
| `validations` | Flujo central. 19+ columnas. Soporta pivotes via `parent_id` / `version` |
| `ai_interactions` | Log de cada llamada AI con `user_id`, tokens y modelo |
| `cached_analyses` | Caché semántico con pgvector (threshold 0.92, sin TTL) |
| `competitors` | Base RAG para `competitive_analysis` |
| `mentors` | Sistema de mentores con matching por expertise |
| `training_data` | Ideas anonimizadas para fine-tuning |
| `market_ai_insights` | Caché de `market-analyze` por validación |

**Migraciones:** 19 archivos en `supabase/migrations/`. Aplicar con:
```bash
supabase db push
```

---

## Comandos útiles

```bash
npm run dev        # Servidor de desarrollo con HMR
npm run build      # Type-check + build de producción
npm run lint       # ESLint
npm run preview    # Preview del build

# Supabase
supabase login
supabase db push   # Aplicar migraciones pendientes
supabase functions deploy ai-validate
supabase functions deploy market-analyze
supabase functions deploy anonymize-idea
```

---

## Roadmap

Ver [SPRINTS.md](SPRINTS.md) para el roadmap completo de 6 sprints (60 casos).

**Próximos pasos inmediatos:**
1. Stripe Checkout + webhook para actualizar `profiles.tier`
2. PostHog analytics (5 eventos clave del wizard)
3. Emails transaccionales con Resend (requiere dominio propio)

---

## Deuda técnica conocida

| Issue | Impacto | Sprint |
|-------|---------|--------|
| `ai-validate` monolito 900+ líneas | Mantenibilidad | Sprint 3 |
| Generación síncrona (sin queue) | Riesgo de timeout en prompts lentos | Sprint 3 |
| Admin: gráficos sin límite de filas | Performance con >1000 rows | Sprint 3 |
| `cached_analyses` sin TTL | Resultados desactualizados | Sprint 3 |
| Mentores: matching básico sin pgvector | Relevancia baja | Sprint 3 |
| Sin tests automatizados | Riesgo en deploys | Sprint 3 |

---

## Contribuir

Este es un proyecto privado en etapa early-stage. Para reportar un bug o sugerir una mejora, abrir un issue en el repositorio o contactar al equipo directamente.
