# Auditoría Profunda: Backend ↔ Frontend — ValidateAI

> Fecha: Mayo 2, 2026

## Resumen Ejecutivo

Auditoría completa: **4 edge functions** (backend), **11 rutas frontend**, **23 componentes shared**, **7 hooks**, **18 migraciones SQL**. Se identifican discrepancias, código muerto, problemas de arquitectura, y plan de limpieza.

---

## 1. Mapeo Endpoints Backend ↔ Pantallas Frontend

### 1.1 Edge Functions (Backend)

| # | Edge Function | Acciones | Pantallas que la consumen | Estado |
|---|--------------|----------|--------------------------|--------|
| 1 | `ai-validate` | 18 prompt types | `Validate.tsx`, `ValidationDetail.tsx`, `StepGenerating.tsx` | ✅ Activo |
| 2 | `market-analyze` | Mercado Chile (BCCh+INE+GPT) | `MarketStudy.tsx` via `useMarketAnalysis` | ✅ Activo |
| 3 | `anonymize-idea` | Anonimización training data | `Results.tsx` via `useTrainingData` | ⚠️ Parcial |
| 4 | `followup-email` | Emails seguimiento 7 días | **Ninguna pantalla** — sin trigger | ⚠️ Inactivo |

### 1.2 Pantallas Frontend vs. Endpoints

| Ruta | Pantalla | Endpoints usados | Acceso DB directo |
|------|----------|-------------------|-------------------|
| `/` | Landing.tsx | Ninguno | Ninguno (usa `exampleReport.ts`) |
| `/login` | Login.tsx | Ninguno | `supabase.auth` |
| `/auth/callback` | AuthCallback.tsx | Ninguno | `supabase.auth` + profiles |
| `/validate` | Validate.tsx | `ai-validate` | `validations` CRUD |
| `/results` | Results.tsx | `anonymize-idea` | `validations` listado |
| `/results/:id` | ValidationDetail.tsx | `ai-validate` (regeneración) | `validations`, `ai_interactions` |
| `/results/:id/history` | IdeaHistory.tsx | Ninguno | `validation_tree` vista |
| `/market/:validationId` | MarketStudy.tsx | `market-analyze` | `market_ai_insights` |
| `/admin` | Admin.tsx | Ninguno | queries directas a todo |
| `/shared/:token` | SharedValidation.tsx | Ninguno | `validations` via share_token |
| `/pricing` | Pricing.tsx | Ninguno | Ninguno (estática) |

---

## 2. Código Deprecado y Muerto

### 2.1 ARCHIVOS A ELIMINAR

| Archivo | Razón |
|---------|-------|
| `refactor.cjs` | Script one-shot, no referenciado |
| `refactor2.cjs` | Idem |
| `src/utils/prompts.ts` | `PROMPT_TYPES` no se importa en ningún .tsx/.ts — código 100% muerto |

### 2.2 Migraciones Duplicadas

| Duplicada | Original | Problema |
|-----------|----------|----------|
| `20260424_rag_cache.sql` | `001_rag_competitors.sql` + `002_cached_analyses.sql` | Tablas `competitors` y `cached_analyses` creadas 2 veces con `if not exists`. Función `increment_cache_usage` difiere pero nunca se llama |

### 2.3 Código Muerto en Backend

| Ubicación | Problema |
|-----------|----------|
| `market-analyze` → `SECTOR_SERIES` | Objeto vacío `{}`, nunca poblado |
| `ai-validate` → `generateEmbedding()` | Si falta `OPENAI_API_KEY`, toda cadena RAG/caché silenciada sin aviso |
| `anonymize-idea` → SDK NPM Anthropic | Inconsistencia: usa `npm:@anthropic-ai/sdk` mientras otros usan `fetch` directo |
| `followup-email` completa | Sin cron job ni trigger — código inactivo |

### 2.4 Código Muerto en Frontend

| Ubicación | Problema |
|-----------|----------|
| `useMentors.ts` | Nunca usa `search_mentors` RPC. Hardcodea `similarity: 0.8`. Matching semántico de la migración 008 no implementado |
| `FounderContext` tipo | Campos `hasBuiltBefore` y `networkInTargetMarket` existen en type pero nunca se recolectan en wizard (`StepFounderSchema` solo tiene 3 campos) |
| `TIER_SECTIONS.pro` → `'swot'` | No hay gating real — SwotMatrix se renderiza en DeliverableTabs sin chequeo de tier |

---

## 3. Problemas Detectados

### 3.1 Críticos 🔴

| # | Problema | Detalle |
|---|---------|---------|
| P1 | **Docs dicen "6 pasos"** | Wizard actual tiene 4 pasos. ESTADO_ACTUAL.md y CLAUDE.md desactualizados |
| P2 | **Docs dicen "solo OpenAI"** | Backend soporta dual provider (Anthropic default + OpenAI fallback) |
| P3 | **Estructura carpetas incorrecta en docs** | No menciona hooks/, data/, components/market/. Menciona `LoadingAI.tsx` que NO EXISTE |
| P4 | **CLAUDE.md store keys incorrectas** | Menciona `stepQuestions`, `stepCustomer` etc que ya no existen en el store |
| P5 | **CORS `*` en producción** | Todas las edge functions permiten cualquier origen |
| P6 | **Sin validación de prompt_type** | `ai-validate` no valida input — cualquier string puede causar `undefined` en SYSTEM_PROMPTS |
| P7 | **Errores silenciados** | `saveAnalysisCache` y `ai_interactions.insert` ignoran errores completamente |

### 3.2 Medios 🟡

| # | Problema | Detalle |
|---|---------|---------|
| P8 | Admin sin paginación | Carga todo en memoria |
| P9 | followup-email sin scheduler | Nunca se ejecuta |
| P10 | Rate limiting inexistente | Sin throttling por tier |
| P11 | current_step inconsistente | Store=4, docs=6 |
| P12 | Insert sin await en Deno | Puede perder datos |
| P13 | PromptType duplicado | Definido 3 veces: useAI.ts, ai-validate, prompts.ts |
| P14 | market-analyze hardcodea GPT-4o-mini | No respeta AI_PROVIDER |

### 3.3 Menores 🟠

| # | Problema | Detalle |
|---|---------|---------|
| P15 | Versiones Deno stdlib inconsistentes | 0.177.0 vs 0.168.0 |
| P16 | anonymize-idea usa SDK NPM | Inconsistencia de estilo |
| P17 | exampleReport.ts hardcodeado | Puede desincronizarse de los tipos |

---

## 4. Mejoras Propuestas

### 4.1 Arquitectura

| # | Mejora | Prioridad | Esfuerzo |
|---|--------|-----------|----------|
| M1 | Tipo compartido `PromptType` | Alta | Bajo |
| M2 | Rate limiting por tier | Alta | Medio |
| M3 | Validar prompt_type (whitelist) | Alta | Bajo |
| M4 | Cron job para followup-email | Media | Bajo |
| M5 | Búsqueda semántica real en mentores | Media | Medio |
| M6 | Admin email en env var | Media | Bajo |
| M7 | Paginar tablas admin | Media | Medio |

### 4.2 Robustez

| # | Mejora | Prioridad | Esfuerzo |
|---|--------|-----------|----------|
| R1 | Restringir CORS a dominio producción | Alta | Bajo |
| R2 | Logging estructurado | Media | Medio |
| R3 | Circuit breaker para APIs externas | Media | Alto |
| R4 | Timeout explícito en fetch | Alta | Bajo |
| R5 | Retry con backoff para 429/5xx | Media | Medio |
| R6 | Error boundary por sección en ValidationDetail | Baja | Bajo |

### 4.3 Escalabilidad

| # | Mejora | Impacto | Esfuerzo |
|---|--------|---------|----------|
| S1 | Separar ai-validate monolito (833 líneas) | Alto | Alto |
| S2 | Queue/Realtime para generación asíncrona | Alto | Alto |
| S3 | Cache TTL cleanup con pg_cron | Medio | Bajo |
| S4 | CDN para GeoJSON/assets | Bajo | Bajo |
| S5 | Partitioning de ai_interactions | Medio | Alto |

---

## 5. Documentación — QUÉ ACTUALIZAR

### ESTADO_ACTUAL.md

| Línea | Cambio Requerido |
|-------|------------------|
| L5 | "6 pasos" → "4 pasos (Idea, Mercado, Fundador, Generación)" |
| L20 | "OpenAI GPT-4o-mini" → "Anthropic Claude Sonnet 4 (default) / OpenAI (fallback)" |
| L34-73 | Reescribir estructura carpetas completa |
| L48 | Eliminar `LoadingAI.tsx` (no existe) |
| L99 | `current_step` 1-6 → 1-4 |
| L127 | 5 prompt types → 18 |
| L146-153 | Wizard 6 pasos → 4 pasos |
| L162-168 | Documentar routing dual + variables env correctas |
| L189-235 | Actualizar issues y features |

### CLAUDE.md

| Sección | Cambio Requerido |
|---------|------------------|
| L18 | "6-step" → "4-step" |
| L38-42 | Store keys incorrectas → `stepIdea`, `stepMarket`, `stepFounder` |
| L59 | Completar 18 prompt types |
| L136-143 | Actualizar known issues |
| Nueva | Documentar market-analyze, anonymize-idea, followup-email |
| Nueva | Documentar los 7 hooks actuales |

---

## 6. Resumen — Qué se Elimina

### Archivos a Eliminar (3)
1. ❌ `refactor.cjs` — script temporal sin referencias
2. ❌ `refactor2.cjs` — script temporal sin referencias  
3. ❌ `src/utils/prompts.ts` — código 100% muerto (no importado en ningún lado)

### Código a Limpiar (sin eliminar archivo)
1. 🧹 `FounderContext.hasBuiltBefore` y `networkInTargetMarket` en types/validation.ts
2. 🧹 Hardcoded `similarity: 0.8` en useMentors.ts → refactorizar
3. 🧹 `SECTOR_SERIES = {}` vacío en market-analyze

### Documentos a Reescribir
1. 📝 `ESTADO_ACTUAL.md` — desactualizado en ~15 puntos
2. 📝 `CLAUDE.md` — desactualizado en ~8 puntos
