# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # Type-check + production build
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

No test suite exists yet (known gap â€” see ESTADO_ACTUAL.md).

## Architecture Overview

**ValidateAI** is a React 19 SPA that guides entrepreneurs through a 4-step AI-powered business validation wizard (Idea, Mercado, Fundador, GeneraciÃ³n), producing a score (0â€“100), qualitative feedback, and advanced deliverables.

**Production:** https://validus.scouttech.lat  
**Stack:** React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Supabase + Vercel

### Data flow

```
User fills wizard step
  â†’ React Hook Form + Zod validation
  â†’ useValidation.saveStep() persists to Supabase `validations` table
  â†’ callAI() invokes Supabase Edge Function `ai-validate`
      â†’ Edge Function verifies JWT, calls Anthropic (default) or OpenAI
      â†’ saves interaction to `ai_interactions` table
      â†’ returns JSON
  â†’ validationStore (Zustand, persisted to localStorage) updates UI
```

### State management

`src/stores/validationStore.ts` holds all wizard state via Zustand with `persist` middleware (key: `validationStore`). The store is the single source of truth for:
- `validationId` â€” Supabase row ID for the current session
- `currentStep` (1â€“4)
- Per-step data: `stepIdea`, `stepMarket`, `stepFounder`
- AI results: `summary`, `validationScore`, `aiFeedback`, `score_breakdown`

Call `store.reset()` to clear a session.

### Key hooks

- `useValidation.ts` â€” Core wizard logic (`createValidation`, `saveStep`, `completeValidation`).
- `useAI.ts` â€” Frontend hook for calling the `ai-validate` edge function. Handles abort signals.
- `useMarketAnalysis.ts` â€” Fetches data from `market-analyze` edge function and caches it in `market_ai_insights`.
- `useMentors.ts` â€” Matches the user's idea with mentors from the `mentors` table.
- `useTrainingData.ts` â€” Handles user consent and calls `anonymize-idea` to push data to `training_data`.
- `useUserTier.ts` â€” Determines the user's subscription tier (`free/basic/pro/premium`) and gates features.
- `useValidationHistory.ts` â€” Loads the version tree (pivots) for a given idea via the `validation_tree` view.

### Edge Functions

All functions run on Deno via Supabase Edge Functions.

1. **`ai-validate`**: Core AI routing. Controlled by env var `AI_PROVIDER` (`'anthropic'` or `'openai'`).
   - Supports 18 prompt types: `questions`, `customer_analysis`, `value_prop`, `mvp_generation`, `summary`, `competitive_analysis`, `market_sizing`, `risk_analysis`, `unit_economics`, `founder_fit`, `market_signals`, `validation_kit`, `landing_generator`, `interview_script`, `tech_viability`, `first_100_customers`, `revenue_models`, `risk_checklist`, `pitch_letter`.
   - Uses **RAG** for `competitive_analysis` (querying the `competitors` table).
   - Implements semantic caching for heavy prompts via the `cached_analyses` table.
2. **`market-analyze`**: Fetches macro-economic series from BCCh and classifies the idea via the INE API, then uses AI to extract Chilean market insights.
3. **`anonymize-idea`**: Uses Claude Haiku to strip PII and sensitive details from an idea, storing the generic summary in `training_data` for model fine-tuning.
4. **`followup-email`**: (Currently inactive/no cron trigger). Designed to send 7-day post-validation engagement emails via Resend.

All responses must be pure JSON; frontend extractors handle markdown stripping if necessary.

### Auth

Supabase auth with PKCE flow. `ProtectedLayout` (`src/app/layout.tsx`) guards all routes via `onAuthStateChange`. Google OAuth redirect lands on `/auth/callback` â†’ `AuthCallback.tsx` exchanges code, upserts `profiles` row.

### Admin panel

Route `/admin` is restricted to an admin email (hardcoded check). Uses Recharts for metrics, loads all data without pagination (known limitation).

## Environment Variables

### Frontend (`.env.local` / Vercel)
```
VITE_SUPABASE_URL=https://fcdhcntyvsydnvjwopfe.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_POSTHOG_KEY=...        # PostHog project API key (Sprint D) â€” app.posthog.com
VITE_POSTHOG_HOST=https://app.posthog.com   # o EU: https://eu.posthog.com
```

### Supabase Edge Function Secrets
```
ANTHROPIC_API_KEY=...        # Primary AI provider
OPENAI_API_KEY=...           # Fallback / alternative provider
AI_PROVIDER=anthropic        # 'anthropic' | 'openai'
REDDIT_CLIENT_ID=...         # Reddit app-only OAuth (Sprint C) â€” crear en reddit.com/prefs/apps
REDDIT_CLIENT_SECRET=...     # Reddit app-only OAuth
SERPAPI_KEY=...              # SerpApi para Google Trends (Sprint C) â€” serpapi.com
BDE_USER=...                 # Banco Central de Chile API (market-analyze)
BDE_PASS=...                 # Banco Central de Chile API
```

Si `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` no estÃ¡n presentes, `premium-validate` usa datos mock con flag `status: 'mock'`.
Si `SERPAPI_KEY` no estÃ¡ presente, `premium-validate` usa datos mock con flag `status: 'mock'`.

## Path Aliases

`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).

## Supabase Migrations

Migrations live in `supabase/migrations/` (18 files). Apply with `supabase db push` or via the Supabase dashboard. The trigger `handle_new_user` auto-creates a `profiles` row on signup.

## 3D Chile Market Map

A 3D extruded map of Chile's 16 regions in the results dashboard, showing market size per region.
Implemented via Three.js + R3F (`ChileMarketMap.tsx`), using d3-geo for projection.

---

## Known Issues

- `idea_name` / `idea_industry` can be null if a user abandons Step 1 before saving.
- Admin tables load all rows into memory (no pagination).
- No API rate limiting per tier.
- Mentors matching (`useMentors`) is currently using a hardcoded similarity threshold and basic querying instead of the full semantic RPC.
- Generation is fully synchronous, which blocks the UI for long prompts.
- No tests or product analytics.


## Estado estratÃ©gico (Mayo 2026)

### Etapa actual
Conseguir primeros usuarios. Sin usuarios pagos aÃºn. Sin dominio propio todavÃ­a.  
Producto: MVP funcional con wizard 4 pasos, score 5 dimensiones, 4 tiers, dashboard con 5 tabs.

### Framework de validaciÃ³n (10 categorÃ­as â€” estado de implementaciÃ³n)

| CategorÃ­a | Estado | Tier |
|-----------|--------|------|
| DefiniciÃ³n del Problema | âœ… `problem` score (25%) | Free |
| TAM/SAM/SOM | âœ… `market_sizing` | Premium |
| Moat Competitivo | âœ… `competitive_analysis` + RAG | Premium |
| Unit Economics (CAC/LTV) | âœ… `unit_economics` | Pro |
| Founder-Market Fit | âœ… `founder_fit` | Pro |
| MVP Roadmap (Kanban) | âœ… `mvp_generation` | Pro |
| Gobernanza / Cap Table | âŒ **No existe** | â€” |
| TracciÃ³n / Evidencia de campo | âš ï¸ Parcial (solo nextSteps) | â€” |
| Escalabilidad TÃ©cnica | âš ï¸ `tech_viability` existe pero no es default | Pro |
| Estrategia Fundraising | âŒ **No existe** | â€” |

El score de 5 dimensiones (problem/market/competition/solution/execution) NO debe modificarse â€” es el DNA del producto y ya estÃ¡ implementado correctamente segÃºn el framework de referencia.

### Premium agents â€” estado real
`premium-validate` edge function usa `fetchRedditMock()` y `fetchTrendsMock()` â€” **datos ficticios**.  
`EvidenceWall.tsx` existe pero muestra datos fake. Esto es el mayor gap de la propuesta de valor premium.  
- Reddit: requiere OAuth app (Reddit Developer â€” gratuito)  
- Google Trends: no hay API oficial â€” alternativa: SerpApi o proxy `pytrends`

### Unit economics de la plataforma
- Costo variable por reporte profundo: ~$1.00 USD (tokens + PDF + infra prorrateada)
- Precio sugerido tier Basic: $9.990 CLP (~$11 USD) â†’ margen bruto >90%
- CAC objetivo: <$3.000 CLP via ads segmentados (Meta/LinkedIn)
- Con ratio LTV/CAC >3x el producto es venture-backable desde el dÃ­a 1

### Sprints de desarrollo (roadmap priorizado)

**Sprint A â€” Bloqueadores de monetizaciÃ³n (1 semana)**
1. Rate limiting enforcement en `ai-validate` â€” guard al inicio del handler
2. Stripe checkout â€” edge function `create-checkout` + webhook `stripe-webhook` â†’ actualiza `profiles.tier`
3. Emails transaccionales con Resend â€” activar `followup-email` + cron

**Sprint B â€” Completar 10 categorÃ­as (2 semanas)**
4. Prompt type `governance_assessment` â€” estructura societaria, vesting, Ley 21.719, red flags legales
5. Prompt type `fundraising_roadmap` â€” instrumento (SAFE/convertible), ticket size, lista fondos LatAm, narrative
6. Componente `TractionTracker` â€” tabla `traction_events` para registrar hitos manualmente (pre-orders, LOIs)
7. Nuevo tab "InversiÃ³n" en `ValidationDetail.tsx` conteniendo los 3 componentes anteriores

**Sprint C â€” Calidad de datos (3 semanas)**
8. Reddit API real en `premium-validate`
9. Google Trends real (SerpApi o similar)
10. Ajuste de SOM con series PIB regional BCCh en `market_sizing`
11. Benchmarks sectoriales hardcodeados (JSON) en prompt `unit_economics`

**Sprint D â€” Pulido (2 semanas)**
12. Data Room export â€” PDF unificado investor-ready (todas las secciones)
13. PostHog analytics â€” 5 eventos: `wizard_step_completed`, `ai_prompt_called`, `validation_completed`, `deliverable_downloaded`, `wizard_abandoned`
14. Traction/metrics tracking histÃ³rico

### Prioridades activas (en orden inmediato)

1. **Rate limiting por tier** â€” URGENTE
   - No existe hoy. Un usuario free puede llamar los 18 prompt types sin lÃ­mite.
   - `competitive_analysis` y `market_sizing` usan web_search de Anthropic â†’ $0.05â€“0.20 USD por request.
   - SoluciÃ³n acordada: tabla `usage_logs` con RLS policy + guard al inicio de `ai-validate`.
   - `useUserTier.ts` ya existe â€” usarlo como base para el enforcement.

2. **Checkout / pagos reales** â€” siguiente
   - Stripe ya configurado. Falta integraciÃ³n.
   - El tier resultante del pago debe persistir en `profiles` y ser leÃ­do por `useUserTier.ts`.

3. **Gobernanza + Fundraising** â€” Sprint B
   - Dos categorÃ­as de las 10 que no existen. Agregar como anÃ¡lisis on-demand en nuevo tab "InversiÃ³n".
   - No cambiar el score de 5 dimensiones.

4. **Emails transaccionales (Resend)** â€” bloqueado hasta tener dominio
   - `followup-email` edge function ya existe pero sin cron trigger.

### Lo que NO es urgente ahora
- Refactor de `ai-validate` (859 lÃ­neas pero legible)
- Migrar generaciÃ³n a queue (sin timeouts en producciÃ³n)
- Tests (despuÃ©s de monetizaciÃ³n)
- Score extendido con `tech_viability` y `founder_fit` (riesgo de confundir al usuario)

### Pregunta pendiente antes de implementar rate limiting
Â¿El campo `tier` del usuario vive en `profiles` o solo en Supabase auth metadata?  
Revisar `useUserTier.ts` y la migraciÃ³n correspondiente antes de escribir cÃ³digo.