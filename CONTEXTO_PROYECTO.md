# Contexto Global — ValidateAI

> Generado: 2026-04-26  
> Proyecto: `validateai/` dentro del monorepo `startups/`

---

## ¿Qué es ValidateAI?

SPA para emprendedores que guía por un **wizard de 6 pasos** para validar ideas de negocio con IA. Al final produce:
- Score de viabilidad (0–100)
- Feedback con fortalezas, debilidades y próximos pasos
- Plan de MVP recomendado

**Owner / Dev:** Luciano Alonso (`lucianoalonso2000@gmail.com`)  
**Estado:** MVP funcional, en producción.

---

## URLs

| Entorno | URL |
|---------|-----|
| Producción | https://validateai-mu.vercel.app |
| Backend | `fcdhcntyvsydnvjwopfe.supabase.co` (Supabase) |

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Estado | Zustand v5 (persist → `localStorage` key `validationStore`) |
| Auth | Supabase Auth — email+password + Google OAuth (PKCE) |
| DB | Supabase — tablas: `profiles`, `validations`, `ai_interactions` (RLS en todas) |
| AI | OpenAI GPT-4o-mini via Supabase Edge Function (Deno) ⚠️ |
| AI (parcial) | Anthropic (Claude) — solo para `competitive_analysis` y `market_sizing` |
| PDF export | jsPDF + html2canvas |
| Routing | React Router v7 |
| Forms | React Hook Form + Zod |
| Animaciones | Framer Motion v12 |
| Notificaciones | Sonner |
| Gráficos (admin) | Recharts v3 |

> ⚠️ El spec original decía Claude como proveedor principal, pero la implementación usa OpenAI GPT-4o-mini. Solo `competitive_analysis` y `market_sizing` usan Anthropic directamente.

---

## Estructura de directorios relevante

```
validateai/
├── src/
│   ├── App.tsx
│   ├── index.css
│   ├── app/
│   │   └── routes/
│   │       ├── Landing.tsx
│   │       ├── Login.tsx
│   │       ├── Validate.tsx          ← wizard principal
│   │       ├── Results.tsx
│   │       ├── ValidationDetail.tsx
│   │       ├── IdeaHistory.tsx
│   │       ├── SharedValidation.tsx
│   │       ├── AuthCallback.tsx
│   │       └── Admin.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── wizard/
│   │   │   ├── StepIdea.tsx
│   │   │   ├── StepQuestions.tsx
│   │   │   ├── StepCustomer.tsx
│   │   │   ├── StepValueProp.tsx
│   │   │   ├── StepMVP.tsx
│   │   │   ├── StepSummary.tsx
│   │   │   ├── StepMarket.tsx
│   │   │   ├── StepFounder.tsx
│   │   │   └── StepGenerating.tsx
│   │   └── shared/
│   │       ├── CompetitiveAnalysis.tsx
│   │       ├── MarketFunnel.tsx
│   │       ├── ScoreBreakdown.tsx
│   │       ├── ScoreGauge.tsx
│   │       ├── RiskAnalysisCard.tsx
│   │       ├── MarketSignalsCard.tsx
│   │       ├── LockedSection.tsx
│   │       ├── ReanalyzeModal.tsx
│   │       ├── MentorCard.tsx
│   │       ├── MentorRecommendations.tsx
│   │       ├── PivotModal.tsx
│   │       ├── VersionTimeline.tsx
│   │       ├── UnitEconomicsCard.tsx
│   │       ├── FounderFitCard.tsx
│   │       ├── CorfoFunds.tsx
│   │       ├── DeliverableTabs.tsx
│   │       └── RegulatoryRoadmap.tsx
```

---

## Rutas (React Router v7)

| Path | Componente | Protegida |
|------|-----------|-----------|
| `/` | `Landing.tsx` | No |
| `/login` | `Login.tsx` | No |
| `/auth/callback` | `AuthCallback.tsx` | No |
| `/shared/:id` | `SharedValidation.tsx` | No |
| `/validate` | `Validate.tsx` | Sí |
| `/results` | `Results.tsx` | Sí |
| `/validation/:id` | `ValidationDetail.tsx` | Sí |
| `/history` | `IdeaHistory.tsx` | Sí |
| `/admin` | `Admin.tsx` | Solo `lucianoalonso2000@gmail.com` (hardcodeado) |

---

## Wizard — 6 pasos reales

1. **StepIdea** — nombre, descripción, industria
2. **StepQuestions** — AI genera 5 preguntas → usuario responde
3. **StepCustomer** — AI sugiere segmento + pain points
4. **StepValueProp** — AI genera propuesta de valor + diferenciador
5. **StepMVP** — AI recomienda tipo de MVP + features (must/should/could)
6. **StepSummary** — score 0–100, feedback, strengths/weaknesses/next_steps

---

## Edge Function `ai-validate`

Prompt types disponibles:
- `questions`
- `customer_analysis`
- `value_prop`
- `mvp_generation`
- `summary`
- `competitive_analysis` ← siempre usa Anthropic
- `market_sizing` ← siempre usa Anthropic

Controlado por env `AI_PROVIDER` (anthropic | openai), excepto los dos últimos.

---

## Variables de entorno

### Frontend (Vercel)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### Supabase Edge Functions
```
OPENAI_API_KEY
ANTHROPIC_API_KEY
AI_PROVIDER   # anthropic | openai
```

---

## Admin Panel (`/admin`)

4 tabs:
1. **Métricas** — KPIs + gráficos Recharts
2. **Usuarios**
3. **Validaciones** — filtrable
4. **AI Usage** — tokens y costos

Sin paginación — carga todo en memoria (deuda técnica conocida).

---

## Deuda técnica / Issues conocidos

| Prioridad | Issue |
|-----------|-------|
| 🔴 Alta | Edge Function usa OpenAI en lugar de Claude (el spec decía Claude) |
| 🔴 Alta | `idea_name` / `idea_industry` pueden ser null si usuario abandona Step 1 |
| 🟡 Media | Sin rate limiting ni modelo freemium |
| 🟡 Media | Sin onboarding / tour guiado |
| 🟡 Media | Sin emails transaccionales |
| 🟡 Media | PDF export frágil (html2canvas sin branding) |
| 🟠 Baja | Sin tests (unitarios ni e2e) |
| 🟠 Baja | Sin analytics de producto (Posthog / Mixpanel) |
| 🟠 Baja | Admin sin paginación |
| 🟠 Baja | Responsive mobile parcial |

---

## Archivos modificados en rama actual (`master`)

Cambios pendientes de commit vs estado inicial:

- `src/App.tsx`
- `src/app/routes/Landing.tsx`
- `src/app/routes/Login.tsx`
- `src/app/routes/Validate.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/ProgressBar.tsx`
- `src/components/wizard/StepIdea.tsx`
- `src/index.css`

---

## Notas de colaboración

- Todo el trabajo va dentro de `validateai/`.
- Consultar `ESTADO_ACTUAL.md` y `CLAUDE.md` dentro de `validateai/` antes de proponer cambios grandes.
- El admin está restringido por email hardcodeado — no hay sistema de roles en DB.
- La rama principal del repo es `main`; la rama de trabajo activa es `master`.
