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

**Validus** is a React 19 SPA that guides entrepreneurs through a 4-step AI-powered business validation wizard (Idea, Mercado, Fundador, GeneraciÃ³n), producing a score (0â€“100), qualitative feedback, and advanced deliverables.

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
5. **`api-v1`**: **Animus Engine v2.0 / Bralidus RaaS Canonical API Gateway** (`https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1`).
   - **B2G Mercado Público ChileCompra Routes:**
     - `GET /api-v1/mercado-publico/compra-agil` — Compras Ágiles (< 30 UTM) with canonical fallback.
     - `GET /api-v1/mercado-publico/opportunities` — Combined B2G tender opportunities.
     - `GET /api-v1/mercado-publico/licitaciones` — Large public tenders (LE, LP, LR).
     - `GET /api-v1/mercado-publico/health` — B2G integration service status.
   - **Fuente primaria: la tabla canónica `licitaciones_mercado_publico`.** Al 2026-08-04 tiene **38.305 filas frescas** (se cargan a diario), repartidas en las CUATRO vías por las que el Estado compra:

     | `source_type` | Qué es | Filas |
     |:---|:---|---:|
     | `tender` | Licitación tradicional | 13.990 |
     | `agile_purchase` | Compra ágil | 24.043 |
     | `convenio_marco` | Contra catálogo ya licitado | 242 |
     | `trato_directo` | **Sin competencia**, por excepción legal | 30 |

     Las cuatro se consultan por `GET /mercado-publico/opportunities?type=`. Las rutas dedicadas `/convenio-marco` y `/tratos-directos` devuelven **501 y son redundantes** — no implementarlas.

     La ingesta la hace `mp-sync` (`validateai-developer-portal/services/mercado-publico`, proyecto Vercel propio **sin integración Git**: se despliega a mano con `vercel deploy --prod`).
   - **Fallback a Licitus (`fetchLicitusActivas()` en `api-v1/routes/data.ts`):** sólo si la consulta canónica no devuelve nada. Las respuestas llevan `meta.source = 'licitus_live'` y `data_source` por ítem para que la procedencia sea explícita.
     - `published_at` is `null` on this path: Licitus `/mercado/activas` exposes the CLOSING date, not the publication date. It is left null rather than filled in.
     - If Licitus is also unavailable, the endpoints return **503 `SOURCE_UNAVAILABLE`**. They do not fabricate records.
     - **NEVER reintroduce a hardcoded dataset here.** A previous version (commit `e01c47e`) injected 12 invented records whose `published_at` was computed as `now - N hours` on every request, so two consecutive calls returned different dates for the same `external_code`, and their `official_url` pointed at nonexistent fichas. An integrator caught it within minutes of testing.
   - **La competencia real de las compras ágiles** — `GET /mercado-publico/ofertas?codigo=` o `?rut=`. Extraído de `raw_payload->detalle->proveedores_cotizando`, donde estaba enterrado: **7.111 ofertas, 2.369 proveedores, 1.095 adjudicaciones y 1.033 motivos de inadmisibilidad**. Tablas `mp_ofertas` / `mp_oferta_items`. Con `rut` agrega un resumen con la tasa de adjudicación. Sin filtro devuelve 400 en vez de volcar 7.111 filas.

     Sólo hay oferentes de **compras ágiles concluidas** (1.308 de 24.043): licitaciones, convenios y tratos directos no los publican, y las abiertas todavía no.

     La extracción la re-ejecuta `mp_extraer_ofertas()` como **step del workflow** de `sync-compra-agil`. Ojo: el workflow NO llama a `runSyncCompraAgilJob`, usa las funciones de slice — meter lógica en la monolítica es meterla en código muerto.
   - **Precios de referencia** — `GET /mercado-publico/precios?q=` o `?codigo_producto=`. Devuelve `p25`/`mediana`/`p75` y **nunca un "precio de mercado" a secas**: `precio_unitario` mezclaba precios reales con canastas enteras puestas en una línea (7 pesos por cápsula convivía con 1.030.568 por "SEGÚN LISTADO EN ADJUNTO"). Se filtran esas líneas, pero queda dispersión real porque un código UNSPSC agrupa productos heterogéneos — por eso cada fila trae `ratio_p75_p25` y `fiabilidad`. **No presentar un número sin mirar esa señal.**

   ### Autenticación y medición (reescritas el 2026-08-04)

   - **La API key es OBLIGATORIA.** Se cerraron las dos puertas que había: el paso sin token y los literales `demo_public_key` / `demo_*` / `sb_publishable_*`. Hoy devuelven `401 AUTH_REQUIRED`.
   - **Zona pública:** `GET /health/services` y `GET /` se registran en `index.ts` **antes** del `app.use` de los middlewares, así que Hono los resuelve sin pasar por auth. No es una excepción declarada: es consecuencia de la línea en que están escritos. **Agregar ahí una ruta de datos la publica sin cuota ni registro y nada falla para avisarlo.**
   - **Tiers reales** (`TIER_CREDIT_LIMITS`): `anon` 150 · `free` 500 · `basic` 1.000 · `pro` 15.000 · `premium` 100.000 · `enterprise` 5.000.000. **No existe `starter`.** `anon` quedó inalcanzable al cerrar el acceso; se conserva como default defensivo.
   - **La unidad es el CRÉDITO**, no la petición ni el token. `api_usage_logs.credits_used` es lo que se cobra y lo que se compara contra el tope; `tokens_used` es telemetría del costo real. Mezclarlas hacía que `/data/macro` cobrara 30 cuando se cotiza 1.
   - **El sujeto medido**: `api_key` → ambas columnas; sesión → `api_key_id` NULL + `profile_id`; anónimo → ambas NULL. La RLS deja ver por `profile_id` **y** por la cláusula vieja sobre `api_keys`, que es lo único que mantiene visible el historial anterior a mayo.
   - **`endpoint` guarda la PLANTILLA**, nunca la ruta concreta. Con 47 rutas parametrizadas, la ruta cruda escribía en el log qué causa revisó un abogado y qué RUT miró un analista. Eso es su agenda de investigación y no hace falta para medir consumo.
   - **Los rechazos se registran**: 429 como fila con 0 créditos; 401/403 en `api_auth_failures`, un **contador** agregado por (prefijo de IP, día) y no un historial — es el único rechazo que cualquiera puede provocar sin credencial.
   - **Deploy:** `npx supabase functions deploy api-v1 --no-verify-jwt`

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
- Admin tables: paginación implementada (25 filas/página, `.range()` + `PaginationBar` en tabs users/validations/ai).
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

1. **Rate limiting por tier** — IMPLEMENTADO (2026-06-03)
   - `usage_counters` tabla con RPC atomica `check_and_increment_usage` (SELECT FOR UPDATE).
   - Limites: free 3/mes (0 costosos), basic 15/mes (5 costosos), pro 50/mes, premium 999/mes.
   - `useUsage` hook + `UsageBar` en Sidebar muestran el uso en tiempo real.
   - `ai-validate` verifica tier y cuota antes de cada llamada AI.

2. **Checkout / pagos — codigo completo, pendiente secrets LS**
   - `create-checkout` y `lemonsqueezy-webhook` deployados en Supabase.
   - Falta: crear cuenta LS, productos, webhook URL y setear 6 secrets en Supabase.
   - Ver `SETUP_LEMONSQUEEZY.md` para el checklist completo.

3. **Gobernanza + Fundraising** — IMPLEMENTADO
   - `governance_assessment` y `fundraising_roadmap` son prompt types activos.
   - `GovernanceCard` renderiza cap table visual, INAPI checklist, Ley Karin y omission warnings.
   - Ambos gateados a Pro (no Basic — Pricing.tsx ya corregido).

4. **Emails transaccionales (Resend)** — bloqueado hasta tener dominio
   - `followup-email` edge function ya existe pero sin cron trigger.

### Lo que NO es urgente ahora
- Refactor de `ai-validate` (859 lÃ­neas pero legible)
- Migrar generaciÃ³n a queue (sin timeouts en producciÃ³n)
- Tests (despuÃ©s de monetizaciÃ³n)
- Score extendido con `tech_viability` y `founder_fit` (riesgo de confundir al usuario)

### Pregunta pendiente antes de implementar rate limiting
Â¿El campo `tier` del usuario vive en `profiles` o solo en Supabase auth metadata?  
Revisar `useUserTier.ts` y la migraciÃ³n correspondiente antes de escribir cÃ³digo.

---

## Protocolo de Desarrollo Proactivo

Aplicar en toda tarea no trivial (nuevas features, cambios de schema, nuevos Edge Functions, cambios de flujo UX).

### Friction Check (antes de proponer implementacion)

Antes de codificar cualquier feature mediana o grande, identificar explicitamente:

1. **Friccion tecnica** - Introduce deuda, latencia, dependencia fragil o costo de tokens elevado?
2. **Friccion UX** - Rompe un flujo existente, agrega pasos al wizard, o confunde al fundador?
3. **Friccion de costo** - Cuanto cuesta por request si se abusa? Esta rate-limited?

Proponer mitigacion para cada friccion identificada antes de empezar a escribir codigo.

### KPI Anchor (por cada feature nueva)

Cada feature debe tener una metrica de negocio asociada explicita. Ejemplos validos:

- Reduccion de abandono en paso X del wizard
- Aumento de conversion free->Basic
- Reduccion de latencia en `ai-validate`
- Ahorro de tokens por sesion (semantic cache hit rate)
- Nuevos usuarios que completan el wizard end-to-end

Si no se puede articular el KPI, la feature probablemente no es prioritaria ahora.
