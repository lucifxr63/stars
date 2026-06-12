# Contexto Ejecutivo — Ecosistema `/startups`

> Documento de onboarding para el nuevo equipo directivo.
> Fecha: 2026-06-11 · Rama: `main` · Autor: handoff técnico
> Objetivo: dar memoria fresca tanto **global** como **por partes** de todo lo que vive en el monorepo `E:\DEV\Respos\Trabajo\startups`.

---

## 0. TL;DR para la Mesa

- **Un producto estrella (Validus / Validus)** ya en producción en `https://validus.scouttech.lat`, monetizable, con wizard de validación de ideas + 18 entregables de IA.
- **Tres piezas que forman un solo sistema de inteligencia**:
  1. **Validus** (`validateai/`) — la app SaaS de cara al usuario (React 19).
  2. **Bralidus** (`validateai-developer-portal/`) — portal para developers que consumen la API (RaaS).
  3. **BralidusPY** (`validateai-financial-worker/`) — el motor Python de inteligencia macro/financiera (GraphRAG) que alimenta el conocimiento.
- **Una fuente de verdad de conocimiento** (`validateai-knowledge-vault/`) — vault tipo Obsidian que cura los datos que el RAG consume.
- **Proyectos satélite** que comparten infra/ADN pero son negocios distintos: **FacturaIA** (factoring PyME), **data-storytelling-mvp**, **corpus** (RAG seed) y la carpeta `docs/` (memoria estratégica).
- **Estado de negocio**: MVP funcional, **sin usuarios pagos aún**, captando primeros usuarios. Pagos implementados en código (LemonSqueezy) pero pendientes de secrets/activación. Dominio propio aún por consolidar.
- **Backend único**: todo se apoya en un mismo proyecto **Supabase** (`fcdhcntyvsydnvjwopfe`) — Postgres + pgvector + Edge Functions (Deno). Hosting frontend en **Vercel**.

---

## 1. Visión Global — cómo encaja todo

```
                         ┌─────────────────────────────┐
                         │   USUARIO FINAL (fundador)   │
                         └──────────────┬──────────────┘
                                        │
                   ┌────────────────────▼────────────────────┐
                   │  VALIDUS  (validateai/)                  │
                   │  React 19 SPA · Vercel                   │
                   │  Wizard 4 pasos → Score → 18 entregables │
                   └───────┬──────────────────────┬──────────┘
                           │                       │
              JWT / RPC    │                       │  consume API pública (RaaS)
                           ▼                       ▼
        ┌──────────────────────────────┐   ┌────────────────────────────┐
        │  SUPABASE (backend único)    │   │  BRALIDUS                  │
        │  Postgres + pgvector         │◄──┤  (developer-portal/)       │
        │  ~40 Edge Functions (Deno)   │   │  Gestión API keys, usage,  │
        │  Auth PKCE · RLS · Crons     │   │  playground, webhooks,     │
        └───────┬──────────────────────┘   │  knowledge graph viewer    │
                │  lee/escribe                └────────────────────────────┘
                │  knowledge_nodes / edges
                ▼
        ┌──────────────────────────────┐   ┌────────────────────────────┐
        │  BRALIDUS-PY                 │   │  KNOWLEDGE VAULT           │
        │  (financial-worker/)         │◄──┤  (knowledge-vault/)        │
        │  FastAPI + GraphRAG          │   │  Obsidian · fuente de      │
        │  Extractores macro/finanzas  │   │  verdad curada (.md)       │
        │  Embeddings → Supabase       │   └────────────────────────────┘
        └──────────────────────────────┘
```

**Idea central:** Validus le da al fundador una validación de su idea apoyada en (a) modelos LLM, (b) datos macro/financieros reales de Chile y el mundo, y (c) un grafo de conocimiento curado. BralidusPY es quien **construye y mantiene** ese conocimiento; Bralidus es el escaparate **B2B/API** del mismo motor; el Knowledge Vault es la **materia prima editorial**.

**Naming:** "Validus" es el nombre comercial de Validus. "Bralidus" es la marca del motor de inteligencia (portal + worker Python). Ambos comparten el mismo Supabase y Edge Functions — **no hay acoplamiento de código entre frontends**, solo el backend compartido.

---

## 2. Stack común (lo que comparten todas las piezas)

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TypeScript 6 (strict) + Tailwind v4 |
| Estado | Zustand v5 (persist) |
| Backend | Supabase: Postgres + pgvector, Auth PKCE, Edge Functions (Deno) |
| IA | Anthropic **Claude Sonnet 4** (primario, prompt caching) · fallback OpenAI GPT-4o mini · Claude Haiku para anonimización |
| Worker | Python 3.12 + FastAPI + APScheduler (BralidusPY) |
| Hosting | Vercel (frontends) · Railway (worker Python) · Supabase (backend) |
| Analytics | PostHog (pipeline propio con Zod) |
| Pagos | LemonSqueezy (código listo, activación pendiente) |

---

## 3. Desglose por partes

### 3.1 VALIDUS — `validateai/` (producto estrella)

**Qué es:** SaaS que guía a un emprendedor por un **wizard de 4 pasos** (Idea → Mercado → Fundador → Generación) y produce un **Score 0–100** en 5 dimensiones (problema, mercado, competencia, solución, ejecución) + hasta **18 entregables** de IA.

**Producción:** `https://validus.scouttech.lat` (Vercel). RC activo `v1.0.0-rc1`.

**Los 18 prompt types** (en la Edge Function `ai-validate`): `questions`, `customer_analysis`, `value_prop`, `mvp_generation`, `summary`, `competitive_analysis` (con RAG), `market_sizing`, `risk_analysis`, `unit_economics`, `founder_fit`, `market_signals`, `validation_kit`, `landing_generator`, `interview_script`, `tech_viability`, `first_100_customers`, `revenue_models`, `risk_checklist`, `pitch_letter` (+ `governance_assessment` y `fundraising_roadmap` añadidos después).

**Sistema de Tiers** (controlado en `profiles`, rate limiting real desde 2026-06-03 vía `usage_counters` + RPC atómica `check_and_increment_usage`):
- **Free** — score + desglose + próximos pasos (3/mes)
- **Basic** — + segmento cliente, propuesta de valor, riesgos (15/mes)
- **Pro** — + MVP specs, FODA, Unit Economics, Founder-Market Fit, gobernanza, fundraising (50/mes)
- **Premium** — acceso total, señales de mercado, competitive avanzado (999/mes)

**Diferenciadores técnicos:**
- **Caché semántico** con pgvector (threshold 0.92) para reusar análisis similares y bajar costos de tokens.
- **Mapa 3D de Chile** (Three.js + R3F + d3-geo) con tamaño de mercado por región.
- **Founder Profile** (Sprint 1.5): extracción de perfil del fundador inyectada en `founder_fit`.
- **Módulo de Encuestas** completo (Mom Test, bias detector, Ley 21.719, k-anonymity).
- **Privacy Sprint**: RUT hasheado en Vault, IP truncada /24, separación de auditoría, PII Shield (3 migraciones en prod).

**Datos reales integrados:** Banco Central de Chile (BCCh), INE, SII (consulta por RUT), ChileCompra/Mercado Público, CMF, INAPI (marcas), FRED (macro USA).

**Estado / pendientes clave:**
- ✅ Rate limiting por tier · ✅ Gobernanza + Fundraising · ✅ CI frontend con gates duros (tsc/vitest/build) + smoke E2E
- ⚠️ **Pagos**: LemonSqueezy en código (`create-checkout` + `lemonsqueezy-webhook` deployados) pero faltan crear cuenta, productos y 6 secrets → ver `SETUP_LEMONSQUEEZY.md`.
- ⚠️ **Agentes premium con datos mock**: `premium-validate` usa Reddit/Trends ficticios (`EvidenceWall.tsx` muestra fake) → mayor gap de la propuesta premium. SerpApi ya activo; Reddit OAuth pendiente.
- ⚠️ Emails transaccionales (Resend / `followup-email`) bloqueados hasta tener dominio.
- ❌ Sin suite de tests amplia (solo smoke E2E + vitest en CI).

**Crons activos en prod:** `cron-tier-health` (lunes), `followup-email` (diario, listo pero sin dominio), `cron-uf-daily`.

---

### 3.2 BRALIDUS — `validateai-developer-portal/` (RaaS / API B2B)

**Qué es:** Portal de developers para la **API de Validus (RaaS — RAG as a Service)**. Es una SPA independiente que comparte el mismo Supabase. Vive (planificado) en `/developers`.

**Funcionalidades:**
- **API Keys** — generadas en el navegador (`val_live_` + hex aleatorio), hasheadas SHA-256 client-side; el raw nunca toca el backend.
- **Monitoreo de uso** — requests/tokens por día/mes, rate limits por plan (Free: 1.000 req / 500k tokens), gráficos 14 días.
- **Playground** — 8 endpoints testeables con snippets curl/Node/Python.
- **Health check** de servicios (CMF, FRED, ChileCompra, RAG, webhooks).
- **RAG Audit** — precisión, latencia, keyword hit rate por run.
- **Knowledge Graph viewer** (ReactFlow) — nodos = documentos, aristas = wikilinks; upload de `.md` con parser de frontmatter.
- **Webhooks** — 3 eventos: `validation.complete`, `analysis.ready`, `profile.updated`.

**8 endpoints públicos documentados:** `/api/v1/rag/query`, `/api/v1/data/economy`, `/api/v1/data/macro`, `/api/v1/data/chilecompra/metricas`, `/api/v1/rag/ingest/text`, `/functions/v1/assemble-mega-prompt`, `POST/GET /api/v1/webhooks`.

**Auth:** magic link (Supabase OTP, PKCE). Componente principal `DeveloperPortal.tsx` (~1.484 líneas — editar con cuidado, ediciones puntuales).

**Estado:** Funcional. Es el canal de monetización B2B (vender acceso al motor de inteligencia a terceros).

---

### 3.3 BRALIDUS-PY — `validateai-financial-worker/` (motor de inteligencia)

**Qué es:** Servicio **Python + FastAPI** que convierte el contexto de una startup en **consultas GraphRAG dinámicas** y que **ingesta datos macro/financieros** para construir el knowledge graph. Desplegado en **Railway** (`railway.toml`, Dockerfile).

**Dos caras:**
1. **Pipeline de ingesta** (`main.py`) — extrae series y genera embeddings (`text-embedding-3-small`, 1536 dims) a Supabase `knowledge_nodes`.
2. **API GraphRAG** (`api/app.py`) — endpoints `POST /query` (el principal), `/entities`, `/cache`, `POST /ingest`, `/health`.

**Extractores** (`src/extractors/`): FRED (macro USA), yfinance (S&P, NASDAQ, IPSA, cobre, WTI, oro, litio, USD/CLP, VIX, Treasury 10Y, ECH, ILF), BCCh, CMF, Diario Oficial, empleo, Mercado Público, SEIA, OpenBB (Phase 3, bajo demanda).

**Arquitectura avanzada:**
- **MoE (Mixture of Experts)** — `moe_router.py` + `experts.py`: gating network que enruta queries a expertos especializados.
- **Entity Router** — 25 industrias.
- **Radar Forense** (Sprint MoE-8) — `api/radar/`: scraper + classifier de señales (RSS Diario Financiero, Emol) con Claude Haiku de fallback.
- **GraphRAG** — ~305 aristas en `knowledge_edges`; combina GRAPH + VECTOR.

**Estado / pendientes:**
- ✅ GRAPH+VECTOR funcional, entity router operativo.
- ⚠️ **yfinance rate-limited** (mitigado con `curl_cffi` TLS fingerprinting, pero frágil).
- ⚠️ **Integración Bralidus → Validación**: plan aprobado por la Mesa (Fase 0+1 primero). Hoy `ai-validate` **NO** usa BralidusPY; Due Diligence usa el `/query` viejo sin procedencia. **Gap D: aún no desplegado en prod.** Doc: `validateai/docs/BRALIDUS_INTEGRATION_PLAN.md`.

---

### 3.4 KNOWLEDGE VAULT — `validateai-knowledge-vault/`

**Qué es:** Vault tipo **Obsidian** — la **fuente de verdad curada** para el motor RAG/GraphRAG. Carpetas: `normativa/`, `metodologia/`, `mercado/`, `docs/`. Incluye `schema.sql` y scripts de ingesta.

**Cómo se conecta:** Los `.md` se suben (bulk vía `sync-knowledge-graph.js` del portal, o desde la UI) a `knowledge_nodes` / `knowledge_edges` en Supabase. El frontmatter YAML y los wikilinks `[[...]]` se convierten en nodos y aristas del grafo.

**Plan INAPI Fase 2 (pendiente):** migrar `inapi_records` (1.28 GB) a este vault separado. Fase 1 ya ejecutada (−1.2 GB); `inapi-fetch` reescrito para usar DB local con búsqueda trigram.

---

### 3.5 Proyectos satélite

| Proyecto | Qué es | Estado |
|---|---|---|
| **FacturaIA** (`facturaia/`) | SaaS de **factoring para PyMEs** chilenas (DataShield SpA). Comisión flat 1.5%, motor de riesgo IA "SII-Simulated" (Claude Haiku), aprobación auto si pagador es gran empresa y Tax Risk ≤ 35. Compliance Ley Fintec 21.521 + 19.628. | MVP completo (4 sprints), landing con LOIs. Negocio **independiente**, mismo stack. |
| **data-storytelling-mvp** | Generador de contenido data-driven (CSV → script → render). Alimenta `generate-carousel` / `generate-content-story`. | MVP / herramienta de marketing. |
| **corpus** (`corpus/`) | 9 documentos `.md` seed del RAG (validación, economics, legal Chile, tech, growth, funding, product AI, psicología, CORFO/SII). | Material base de conocimiento. |
| **docs/** | Memoria estratégica del ecosistema (~40 docs): specs, análisis de mercado, planes de integración, feedback, playbooks. | Referencia viva. |

---

## 4. Backend compartido — qué hay en Supabase

**Proyecto:** `fcdhcntyvsydnvjwopfe.supabase.co`

**~40 Edge Functions (Deno)** agrupadas por dominio:
- **Core validación:** `ai-validate`, `assemble-mega-prompt`, `premium-validate`, `anonymize-idea`, `parse-project`, `extract-founder-profile`
- **API pública (RaaS):** `api-v1`
- **Datos gobierno/macro:** `market-analyze`, `sii-proxy`, `validate-rut`, `cmf-best-fetch`, `chilecompra-fetch`, `chilecompra-calcular`, `inapi-fetch`, `fred-sync`, `sync-economic-data`, `cron-uf-daily`
- **Encuestas:** `survey-crud`, `survey-respond`, `survey-analyze`, `survey-anonymize`, `survey-datalake`
- **Pagos:** `create-checkout`, `lemonsqueezy-webhook`, `fintoc-link`, `fintoc-webhook`
- **Engagement / contenido:** `followup-email`, `send-quick-lead`, `match-mentors`, `generate-carousel`, `generate-content-story`
- **Integraciones:** `linkedin-oauth-callback`, `figma-oauth-handler`, `ai-figma-bridge`, `posthog-proxy`, `register-consent`
- **Crons / salud:** `cron-tier-health`

**Tablas núcleo:** `profiles` (tiers/consentimientos), `validations` (con versiones/pivotes), `ai_interactions` (telemetría tokens/modelos), `cached_analyses` (caché semántico pgvector), `competitors` (RAG), `usage_counters` (rate limit), `knowledge_nodes`/`knowledge_edges` (grafo), `api_keys`/`api_usage_logs` (RaaS), `rag_audit_*`.

---

## 5. Estado de negocio y prioridades

**Etapa:** Conseguir primeros usuarios. **Sin usuarios pagos aún. Dominio propio por consolidar.**

**Unit economics (Validus):**
- Costo variable por reporte profundo: ~$1,00 USD.
- Precio sugerido Basic: $9.990 CLP (~$11 USD) → margen bruto >90%.
- CAC objetivo: <$3.000 CLP (Meta/LinkedIn ads). LTV/CAC >3x → venture-backable.

**Bloqueadores de monetización (orden):**
1. **Activar LemonSqueezy** (cuenta + productos + 6 secrets). Código ya listo.
2. **Datos premium reales** (Reddit OAuth; Trends ya con SerpApi) para cerrar el gap de `premium-validate`.
3. **Dominio propio** → desbloquea emails Resend.
4. **Integración BralidusPY en prod** (Gap D) para diferenciar la calidad del análisis.

**CI/CD:** `frontend-ci.yml` con gates duros (tsc/vitest/build) + smoke E2E `@smoke`. Lint en modo advisory por deuda preexistente. Escalón 2 (Vercel Previews) en HOLD hasta ~2026-06-18.

---

## 6. Deuda técnica conocida (resumen honesto)

- `premium-validate` con datos mock (Reddit/Trends) — gap de propuesta de valor premium.
- `ai-validate` ~859 líneas, monolítico pero legible (refactor no urgente).
- Generación 100% síncrona (bloquea UI en prompts largos; sin queue todavía).
- Admin panel: paginación implementada, pero check de admin por email hardcodeado.
- `idea_name`/`idea_industry` pueden quedar null si se abandona el paso 1.
- `useMentors` usa threshold hardcodeado en vez del RPC semántico completo.
- yfinance frágil por rate limit.
- Cobertura de tests baja (smoke E2E + vitest, sin suite amplia).

---

## 7. Protocolo de trabajo del equipo (heredado)

Para toda feature mediana/grande, antes de codificar:
1. **Friction Check** — fricción técnica (deuda/latencia/costo tokens), fricción UX (rompe flujo del fundador), fricción de costo (¿rate-limited si se abusa?).
2. **KPI Anchor** — cada feature debe atar una métrica de negocio explícita (abandono en paso X, conversión free→Basic, latencia `ai-validate`, cache hit rate, completaciones end-to-end). Si no hay KPI articulable, probablemente no es prioritaria.

**Regla de oro de producto:** el score de 5 dimensiones (problem/market/competition/solution/execution) **NO se modifica** — es el ADN del producto.

---

## 8. Dónde leer más (mapa de docs)

- Visión técnica integraciones → `docs/INTEGRACIONES_ARQUITECTURA.md`
- Playbook estratégico → `docs/STARTUPS_ECONO.MD`, `docs/STARTUPS_NEW.MD`
- Estado producto / V3 → `docs/VALIDUS_V3_NEW.MD`, `docs/VALIDUS_V3_STATUS.md`, `validateai/docs/ESTADO_PRODUCTO.md`
- Guía frontend → `validateai/docs/FRONTEND_GUIDE.md`
- Integración Bralidus → `validateai/docs/BRALIDUS_INTEGRATION_PLAN.md`
- Pagos → `validateai/SETUP_LEMONSQUEEZY.md`
- Demo / control de acceso → `validateai/docs/Demo100.MD`, `DEMO100_ACCESS_CONTROL_ONEPAGER.md`
- Auditoría backend/frontend → `validateai/AUDITORIA_BACKEND_FRONTEND.md`
- Go-live → `validateai/VALIDUS_GO_LIVE_CHECKLIST.md`
```

