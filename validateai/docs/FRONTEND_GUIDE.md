# Validus — Guía Frontend para Desarrolladores

> Generado: 2026-06-04 | Stack: React 19 + TypeScript + Vite + Tailwind + shadcn/ui

---

## 1. Árbol de rutas (React Router)

```
APP (App.tsx)
│
├── RUTAS PÚBLICAS (sin auth)
│   ├── /                        → Landing.tsx
│   ├── /login                   → Login.tsx
│   ├── /auth/callback           → AuthCallback.tsx        (OAuth exchange)
│   ├── /shared/:token           → SharedValidation.tsx    (vista pública de validación)
│   ├── /s/:slug                 → SurveyRespond.tsx       (formulario público de encuesta)
│   ├── /pricing                 → Pricing.tsx             (tabla de planes)
│   ├── /demo                    → Demo.tsx
│   ├── /figma/callback          → FigmaCallback.tsx
│   ├── /auth/linkedin/callback  → LinkedInCallback.tsx
│   └── /privacy-policy          → PrivacyPolicy.tsx
│
└── RUTAS PROTEGIDAS (ProtectedLayout — requiere sesión Supabase)
    │
    ├── STANDALONE (sin Sidebar)
    │   ├── /onboarding          → Onboarding.tsx          (wizard 3 pasos, primera vez)
    │   └── /checkout/success    → CheckoutSuccess.tsx     (confirmación de pago)
    │
    └── APP LAYOUT (AppLayout — con Sidebar permanente)
        ├── /validate                    → Validate.tsx           (wizard principal)
        ├── /dashboard                   → Dashboard.tsx          (inicio)
        ├── /results                     → Results.tsx            (historial)
        ├── /results/:id                 → ValidationDetail.tsx   (detalle completo)
        ├── /results/:id/history         → IdeaHistory.tsx        (árbol de pivots)
        ├── /market/:validationId        → MarketStudy.tsx        (mapa Chile 3D)
        ├── /startup                     → MyStartup.tsx          (metadatos startup)
        ├── /profile                     → Profile.tsx            (usuario + tier)
        ├── /developers                  → Developers.tsx         (API docs + webhooks)
        ├── /admin                       → Admin.tsx              (solo admin email)
        ├── /surveys                     → SurveyList.tsx
        ├── /surveys/new                 → SurveyBuilder.tsx
        ├── /surveys/:id/edit            → SurveyBuilder.tsx
        └── /surveys/:id/results         → SurveyResults.tsx
```

**Nota:** La ruta `*` (catch-all) muestra `NotFound`.

---

## 2. Navegación — Sidebar

```
Sidebar.tsx (src/components/layout/Sidebar.tsx)
└── Renderizado en: AppLayout (src/app/layout.tsx)

ÍTEMS PRINCIPALES (NAV_ITEMS):
  1. Inicio              →  /dashboard      (ícono: Home)
  2. Mis Validaciones    →  /results        (ícono: BarChart2)
  3. Encuestas           →  /surveys        (ícono: ClipboardList)
  4. Mi Startup          →  /startup        (ícono: Rocket)
  5. Configuración       →  /profile        (ícono: Settings)

SECCIÓN ADMIN (solo si email === ADMIN_EMAIL):
  6. Admin               →  /admin          (ícono: Shield)

SECCIÓN INFERIOR (siempre visible):
  - Avatar + nombre + badge de tier
  - UsageBar (barra de cuota mensual, solo free/basic)
  - ThemeToggle (claro / oscuro)
  - Botón "Cerrar sesión"
  - Link "Política de privacidad"
```

---

## 3. Navegación — Header

```
Header.tsx (src/components/layout/Header.tsx)
└── Usado en: Landing, Login, Pricing, Demo y rutas públicas (NO en AppLayout)

DESKTOP:
  - Logo Validus
  - "Mis validaciones"  →  /results
  - "Perfil"            →  /profile
  - "API & Devs"        →  /developers
  - [Admin] (condicional)
  - ThemeToggle
  - Botón "Salir"

MOBILE (drawer):
  - Mismos ítems en menú desplegable
```

---

## 4. Sistema de notificaciones (Toasts)

**Librería:** `sonner`  
**Configuración:** `src/components/ui/sonner.tsx`  
**Provider:** `<Toaster position="top-right" richColors />` en `App.tsx`

```typescript
// Uso estándar en cualquier componente:
import { toast } from 'sonner';

toast.success('Sesión cerrada');
toast.error('Error al cargar validaciones');
toast.info('Idea guardada');
toast.warning('Cuota casi agotada');
toast.loading('Analizando...');
```

**Personalización:** íconos Lucide (`CircleCheckIcon`, `TriangleAlertIcon`, etc.)  
**Tema:** sincronizado con modo oscuro/claro via `next-themes`

---

## 5. Sistema de modales y popups

**Primitiva base:** `src/components/ui/dialog.tsx`  
**Librería:** `@base-ui/react/dialog` (NO es Radix)

### Modales activos

| Componente | Archivo | Trigger | Propósito |
|---|---|---|---|
| `ConsentModal` | `shared/ConsentModal.tsx` | Auto en ProtectedLayout si `consentStatus === 'required'` | Consentimiento GDPR |
| `UpgradeModal` | `shared/UpgradeModal.tsx` | Evento `validateai:paywall-hit` (global, AppLayout) | Paywall / upgrade de tier |
| `PDFExportModal` | `shared/PDFExportModal.tsx` | Botón en ValidationDetail | Elegir tema y descargar PDF |
| `PivotModal` | `shared/PivotModal.tsx` | Botón en Results / ValidationDetail | Crear nueva versión (pivot) |
| `ReanalyzeModal` | `shared/ReanalyzeModal.tsx` | Botón en ValidationDetail | Re-correr análisis |

### Overlay / tooltip (no modales)

| Componente | Archivo | Propósito |
|---|---|---|
| `OnboardingOverlay` | `shared/OnboardingOverlay.tsx` | Tutorial tipo tooltip en wizard (hook `useOnboarding`) |
| `StepTransition` | `wizard/StepTransition.tsx` | Overlay entre pasos del wizard |

### Componentes NO usados (candidatos a borrar)

| Componente | Archivo | Estado |
|---|---|---|
| `KycModal` | `shared/KycModal.tsx` | **NUNCA importado** — eliminar o implementar |
| `DetailPanel` | `shared/DetailPanel.tsx` | **NUNCA importado** — eliminar o documentar propósito |

---

## 6. Estado global — Zustand Stores

### `validationStore` (src/stores/validationStore.ts)

```
Clave localStorage: 'validateai-session' (versión 2)
Sincronización: BroadcastChannel entre tabs del browser

ESTADO:
  validationId       — ID de la fila Supabase actual
  currentStep        — Paso activo (1-4 o 1-5 en premium)
  isLoading          — Spinner global
  aiThinking         — Streaming de IA activo
  validationMode     — 'quick' | 'detailed' | 'premium'

DATOS DEL WIZARD:
  stepIdea           — nombre, problema, descripción, industria
  stepMarket         — segmento, región, modelo de negocio, precio
  stepFounder        — experiencia, tracción, equipo
  stepIdeaQuick      — campos mínimos (modo rápido)

RESULTADOS IA:
  summary            — resumen ejecutivo
  validationScore    — 0-100
  aiFeedback         — texto libre
  riskAnalysis       — categorías de riesgo
  unitEconomics      — CAC/LTV
  founderFit         — puntuación founder-mercado
  marketSignals      — indicadores de mercado
  fromCache          — si el resultado viene de caché

DUE DILIGENCE (Premium):
  extractedData      — datos extraídos del PDF subido
  pendingQuestions   — preguntas generadas por IA
  dueDiligenceScore  — puntuación DD
  uploadStatus       — estado de subida del PDF

FOUNDER PROFILE (Sprint 1.5):
  founderProfile     — datos de LinkedIn/CV extraídos
```

### `carouselStore` (src/stores/carouselStore.ts)

```
Clave localStorage: 'validateai-carousel'

ESTADO:
  platform           — 'linkedin' | 'twitter' | 'instagram'
  theme              — 'clean' | 'bold' | 'minimal'
  campaign           — { id, validationId, slides[], version }
  status             — 'idle' | 'generating' | 'done' | 'error'
```

---

## 7. Árbol completo de componentes

```
src/components/
│
├── layout/
│   ├── Header.tsx          — Navbar (rutas públicas)
│   ├── Sidebar.tsx         — Nav persistente (AppLayout)
│   ├── Footer.tsx          — Footer con copyright
│   └── ProgressBar.tsx     — Indicador de pasos del wizard
│
├── wizard/                 — Flujo de validación
│   ├── FlowSelector.tsx    — Elección de flujo (quick/detailed/premium)
│   ├── StepIdea.tsx        — Paso 1 detallado: idea completa
│   ├── StepIdeaQuick.tsx   — Paso 1 rápido: campos mínimos
│   ├── StepIdeaPremium.tsx — Paso 2 premium: revisión de PDF extraído
│   ├── StepMarket.tsx      — Paso 2 detallado: mercado
│   ├── StepMarketPremium.tsx — Paso 3 premium: revisión mercado
│   ├── StepFounder.tsx     — Paso 3: founder y equipo
│   ├── StepGenerating.tsx  — Paso 4: loading + streaming IA
│   ├── StepUpload.tsx      — Paso 1 premium: subida de PDF
│   ├── StepTransition.tsx  — Overlay entre pasos
│   ├── TaskCardStream.tsx  — Card de resultado streaming
│   └── OnboardingOverlay.tsx → (está en shared/ pero usada en wizard)
│
├── shared/                 — Componentes de resultados y UI
│   │
│   ├── SCORE / ANÁLISIS:
│   │   ├── ScoreGauge.tsx          — Gauge circular 0-100
│   │   ├── ScoreBreakdown.tsx      — 5 dimensiones (problema/mercado/etc)
│   │   ├── AggregateRadarChart.tsx — Radar multi-idea
│   │   └── IdeationTrendLine.tsx   — Línea de tendencia de puntajes
│   │
│   ├── ANÁLISIS DE NEGOCIO:
│   │   ├── CompetitiveAnalysis.tsx — Matriz de posicionamiento
│   │   ├── MarketFunnel.tsx        — TAM/SAM/SOM
│   │   ├── RiskAnalysisCard.tsx    — Categorías de riesgo
│   │   ├── UnitEconomicsCard.tsx   — CAC/LTV con gráficos
│   │   ├── FounderFitCard.tsx      — Puntuación founder-mercado
│   │   ├── MarketSignalsCard.tsx   — Indicadores de mercado
│   │   ├── GovernanceCard.tsx      — Cap table / INAPI / legal
│   │   ├── FundraisingRoadmapCard.tsx — Instrumentos e inversores
│   │   └── CorfoFunds.tsx          — Instrumentos CORFO
│   │
│   ├── FEATURES / ROADMAP:
│   │   ├── KanbanMVP.tsx           — Features MVP en Kanban
│   │   ├── NextStepsTimeline.tsx   — Roadmap tipo timeline
│   │   ├── RegulatoryRoadmap.tsx   — Checklist legal/compliance
│   │   ├── TractionTracker.tsx     — Tabla de eventos de tracción
│   │   ├── SwotMatrix.tsx          — SWOT visual
│   │   ├── VersionTimeline.tsx     — Historial de pivots
│   │   ├── PlaybookAnalysisCard.tsx — Casos de estudio
│   │   ├── EvidenceWall.tsx        — (Premium) datos Reddit + Trends
│   │   └── DueDiligenceScoreCard.tsx — Checklist DD + scoring
│   │
│   ├── VEREDICTO / RESUMEN:
│   │   └── VerdictWidgets.tsx      — Exporta 3 componentes:
│   │       ├── VerdictProsCons     — Fortalezas/debilidades
│   │       ├── VerdictFounderFit   — Veredicto founder
│   │       └── VerdictMarketTiming — Veredicto timing
│   │
│   ├── MODALES:
│   │   ├── ConsentModal.tsx        — GDPR consent (auto)
│   │   ├── UpgradeModal.tsx        — Paywall (evento global)
│   │   ├── PDFExportModal.tsx      — Exportar PDF
│   │   ├── PivotModal.tsx          — Crear pivot
│   │   ├── ReanalyzeModal.tsx      — Re-analizar
│   │   └── OnboardingOverlay.tsx   — Tutorial tooltip
│   │
│   ├── UTILIDADES UI:
│   │   ├── DeliverableTabs.tsx     — Tabs en ValidationDetail
│   │   ├── LockedSection.tsx       — Wrapper de tier gating
│   │   ├── EmptyStateAI.tsx        — Skeleton loading (IA pendiente)
│   │   ├── MentorRecommendations.tsx — Lista de mentores
│   │   ├── MentorCard.tsx          — Card individual mentor
│   │   ├── UsageGauge.tsx          — Barra de cuota mensual
│   │   ├── ThemeToggle.tsx         — Botón claro/oscuro
│   │   ├── ErrorBoundary.tsx       — Fallback de error
│   │   └── FounderProfileTab.tsx   — Tab perfil founder
│   │
│   ├── PDF:
│   │   └── ExportPDF.tsx           — Renderer PDF con secciones
│   │
│   └── (sin dead code — DetailPanel y KycModal eliminados 2026-06-04)
│
├── pdf/                    — Secciones de PDF (cargadas dinámicamente)
│   ├── ComplianceRoadmapPDF.tsx
│   ├── InvestmentDossier.tsx
│   ├── LeanRoadmapPDF.tsx
│   ├── PitchDeckOutline.tsx
│   ├── UnitEconomicsPDF.tsx
│   └── pdfStyles.ts
│
├── market/                 — Mapa Chile 3D (Three.js + React Three Fiber)
│   ├── ChileMarketMap.tsx
│   ├── MarketMapLegend.tsx
│   ├── RegionMesh.tsx
│   ├── marketRegionConfig.ts
│   ├── useChileGeo.ts
│   └── useMarketDistribution.ts
│
├── figma/                  — Integración Figma (admin)
│   ├── FigmaAdminPanel.tsx
│   ├── FigmaPanel.tsx      — Solo exporta tipos (ReactFlowNodeData, etc.)
│   └── NavigationCanvas.tsx — Grafo React Flow
│
├── admin/
│   ├── ContentStudio.tsx
│   ├── DataStoryEngine.tsx
│   ├── SitemapPanel.tsx
│   └── Pagination.tsx
│
├── carousel/
│   └── CarouselEditor.tsx
│
└── ui/                     — Primitivas shadcn/ui
    ├── badge.tsx
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx           — @base-ui/react/dialog (NO Radix)
    ├── input.tsx
    ├── skeleton.tsx
    ├── sonner.tsx           — Config del toast
    └── textarea.tsx
```

---

## 8. Hooks personalizados

```
src/hooks/
├── useAI.ts                — Orquesta llamadas a Edge Functions + dispara paywall-hit
├── useAnalytics.ts         — PostHog + GA4
├── useConsentGuard.ts      — Verifica si se requiere mostrar ConsentModal
├── useFigmaIntegration.ts  — Autenticación y datos de Figma
├── useIdeaQuality.ts       — Validación en tiempo real de campos del wizard
├── useLinkedInOAuth.ts     — Flow OAuth LinkedIn
├── useMarketAnalysis.ts    — Datos de mercado para MarketStudy
├── useMentors.ts           — Fetch de mentores recomendados
├── usePaginatedQuery.ts    — Paginación genérica con Supabase
├── useTrainingData.ts      — Consentimiento de anonimización para entrenamiento
├── useUsage.ts             — Contador de cuota mensual (tabla usage_counters)
├── useUserTier.ts          — Tier del usuario desde perfil Supabase
└── useValidationHistory.ts — Árbol de versiones (view validation_tree)
```

---

## 9. Estado de implementación — qué no está siendo usado

### Componentes dead code

Eliminados el 2026-06-04:
- `shared/DetailPanel.tsx` — 0 importaciones, borrado
- `shared/KycModal.tsx` — 0 importaciones, borrado

### Rutas pendientes / sin implementar

| Ruta | Estado |
|---|---|
| `/figma/callback` | Implementada, pero LinkedIn Company Page bloqueada (ver LINKEDIN_OAUTH_INTEGRATION.md) |
| LinkedIn OAuth | Sprint 1.5-B bloqueado hasta crear Company Page en LinkedIn |

### Features parciales

| Feature | Estado | Archivo |
|---|---|---|
| Reddit data (EvidenceWall) | Edge Function `reddit-fetch` pendiente de deploy | `shared/EvidenceWall.tsx` |
| Figma integration | Solo admin, no expuesta a usuarios | `figma/FigmaAdminPanel.tsx` |
| Carousel editor | Implementado, no enlazado desde Sidebar | `carousel/CarouselEditor.tsx` |

---

## 10. Stack técnico frontend

| Tecnología | Versión | Uso |
|---|---|---|
| React | 19 | Framework principal |
| TypeScript | 5.x | Tipado |
| Vite | 6.x | Build + HMR |
| Tailwind CSS | 4.x | Estilos |
| shadcn/ui | latest | Primitivas UI |
| @base-ui/react | 1.x | Dialog/Modal base |
| Zustand | 5.x | Estado global |
| React Router | 7.x | Routing |
| Sonner | 2.x | Toasts |
| Supabase JS | 2.x | Auth + DB + Realtime |
| PostHog | 1.x | Analytics |
| Sentry | 8.x | Error tracking |
| React Three Fiber | 8.x | Mapa Chile 3D |
| React Flow | 11.x | Grafo Figma navigation |
| Recharts | 2.x | Gráficos (radar, line, bar) |

---

## 11. Estructura de archivos auxiliares

```
src/
├── stores/
│   ├── validationStore.ts   — Estado wizard + resultados IA
│   └── carouselStore.ts     — Estado generador de carruseles
│
├── lib/
│   ├── supabase.ts          — Cliente Supabase + helpers auth
│   ├── telemetry.ts         — Eventos PostHog (paywall_hit, exit-intent, etc.)
│   ├── tierLimits.ts        — Límites por tier (free/basic/pro/enterprise)
│   ├── pdf.ts               — Orquestador de generación PDF
│   ├── sentry.ts            — Config Sentry
│   ├── privacy/             — K-Anonimidad, L-Diversidad, Laplace noise
│   └── utils.ts             — cn() y helpers varios
│
├── types/
│   ├── validation.ts        — Tipos principales del dominio
│   ├── survey.ts
│   ├── market.ts
│   └── carousel.ts
│
├── data/
│   ├── corfoInstruments.ts  — Datos estáticos instrumentos CORFO
│   ├── exampleReport.ts     — Reporte de ejemplo para Demo
│   ├── regionalData.ts      — Datos regiones Chile
│   └── regulatoryData.ts    — Datos regulatorios
│
└── utils/
    ├── biasDetector.ts      — Detección Mom Test (encuestas)
    ├── constants.ts         — Constantes globales
    └── crypto.ts            — Hash / firma HMAC
```

---

## 12. Flujo de la aplicación (happy path)

```
1. Usuario llega → Landing (/)
2. Click "Comenzar" → Login (/login) → OAuth Supabase (Google)
3. Auth callback → /auth/callback → redirect a /onboarding (primera vez)
4. Onboarding 3 pasos → /dashboard
5. Click "Nueva validación" → /validate
   ├── FlowSelector: elige flujo
   ├── Flujo Detallado: StepIdea → StepMarket → StepFounder → StepGenerating
   ├── Flujo Rápido: StepIdeaQuick → StepGenerating
   └── Flujo Premium: StepUpload → StepIdeaPremium → StepMarketPremium → StepFounder → StepGenerating
6. Resultados streaming → redirect a /results/:id (ValidationDetail)
7. ValidationDetail → tabs con todos los análisis + exportar PDF/pivot/reanalizar
8. Dashboard → /results (historial de todas las validaciones)
```

---

> **Archivo mantenido por:** Claude Code / Luciano Alonso  
> **Última actualización:** 2026-06-04
