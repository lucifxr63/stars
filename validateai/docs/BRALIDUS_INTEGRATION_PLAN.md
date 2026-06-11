# Plan de Integración Bralidus → Workflow de Validación

> **Estado:** Aprobado por Mesa Directiva (2026-06-11). Ejecutar **Fase 0 + Fase 1** primero.
> **Punto de verdad y auditoría.** Relevante durante el freeze operativo de Bralidus hasta **2026-06-24**
> (el freeze cubre *nuevos extractores*; este plan vive del lado consumidor + deploy, no lo viola).

---

## 0. Objetivo

Inyectar Bralidus (`validateai-financial-worker`, GraphRAG macro/legal/unit-econ) en el workflow de
validación de ValidateAI para producir resultados **mejores** y **comprobables/respaldados** — donde cada
ajuste de score arrastra evidencia citable (indicador, valor, fecha, fuente).

## 1. Diagnóstico (estado al 2026-06-11)

Bralidus expone dos puertas:

| Endpoint | Qué hace | Devuelve |
|---|---|---|
| `POST /query` | RAG dinámico simple: `entity_router` → embed → `search_hybrid_graphrag` | `context_for_llm` + `nodes[]{source_type, document_title, category, content, relevance, metadata}` |
| `POST /query/moe` | **Mixture of Experts** (5: macro, mercados, unit_economics, legal, estrategia) + GatingNetwork + **Radar Forense** (señales vivas) + freshness check + audit log | Lo anterior **+ `experts_activated`, `routing_reason`, `data_freshness`, `data_note`** |

En `validateai` hay **dos flujos de validación**; solo uno toca Bralidus:

- **`ai-validate/index.ts`** — el **wizard real** (score 5 dimensiones + 18 entregables: `market_sizing`,
  `unit_economics`, `risk_analysis`, `competitive_analysis`, `founder_fit`, etc.). **NO llama a Bralidus.**
  Tiene su propio RAG local (knowledge_base, competitors, playbooks GraphRAG, IPC BCCh, `SECTOR_BENCHMARKS`).
- **`assemble-mega-prompt/index.ts`** — flujo separado de **Due Diligence**. **Sí** llama a Bralidus vía
  `fetchBralidusPY` → `/query` (endpoint viejo), tier-gate, circuit breaker, `compressBralidus`.

## 2. Los 5 gaps

- **Gap A — El corazón no recibe nada.** El score que ve el usuario sale de `ai-validate`; Bralidus está ausente.
- **Gap B — Puerta débil.** La DD usa `/query`, no `/query/moe`. Pierde expertos, Radar Forense y `data_freshness`.
- **Gap C — Se tira la procedencia.** `compressBralidus` trunca a 1200 chars y solo expone títulos de alerta;
  el `metadata` del nodo (`ultimo_valor`, `ultima_fecha`, `unidad`, fuente) — lo que hace *comprobable* la
  afirmación — se descarta.
- **Gap D — No está en prod.** Bralidus corre local; en prod `BRALIDUS_URL` cae a `localhost:8000` → circuit
  breaker abre en silencio → **la integración actual no produce nada en producción.**
- **Gap E — No hay forma de comprobar que mejora.** Sin set de control no se demuestra el delta de score.

## 3. Principio rector: "respaldado" = cadena de procedencia

```
nodo Bralidus {document_title, ultimo_valor, ultima_fecha, fuente, relevance}
  → bloque de contexto con cita inline [FUENTE: X = valor (fecha)]
  → prompt exige citar la fuente en gaps/source_notes
  → JSON de salida lleva evidence[] estructurado
  → se persiste en validations.*.evidence
  → UI (EvidenceWall) lo renderiza con fecha + badge de frescura
```

## 4. Plan por fases

### Fase 0 — Prerrequisitos (desbloquea todo)
1. **Desplegar Bralidus a Railway** (`railway.toml` + `Dockerfile` ya existen; healthcheck `/health`).
   Aplicar antes `scripts/migration_vector_search_rpc.sql` (pgvector HNSW).
2. Secrets Supabase: `BRALIDUS_URL=https://<railway>`, `BRALIDUS_API_KEY=<token>` (mismo token en Railway env).
3. **Smoke test de contrato**: `POST /query/moe` con `startup_context` real; verificar que `nodes[].metadata`
   trae `ultimo_valor`/`ultima_fecha`. Define el shape que consumirán las edge functions.

### Fase 1 — Migrar DD a MoE + procedencia (quick win, 1 archivo)
*Solo `assemble-mega-prompt/index.ts`.*
1. `fetchBralidusPY`: `/query` → `/query/moe` (añade `max_experts`; recibe `experts_activated`, `data_freshness`).
2. Reescribir `compressBralidus`: bloque de evidencia citable por nodo top-k →
   `[FUENTE Bralidus · {experto}] {document_title}: {ultimo_valor} {unidad} ({ultima_fecha})`.
   Cap ~600 tokens (top-k), no truncado ciego.
3. Persistir `bralidus_evidence[]` (+ `experts_activated`, `data_freshness`) en `validations.due_diligence_score`.
4. System prompt: exigir cita de fuente+fecha al ajustar una dimensión por datos Bralidus.

### Fase 2 — Inyectar en el wizard `ai-validate` (el corazón)
Seam existente: bloque que enriquece `enrichedContext` por `prompt_type` (~líneas 1551-1638).

| prompt_type | Experto MoE | Campo inyectado |
|---|---|---|
| `market_sizing` | macro | `bralidus_macro_context` (ajusta SOM por ciclo) |
| `unit_economics` | unit_economics | `bralidus_benchmarks` (CAC/LTV/churn reales) |
| `risk_analysis` / `risk_checklist` | macro+mercados | `bralidus_risk_signals` (Radar Forense: TPM, spread crédito, quiebras CMF) |
| `governance_assessment` / `compliance_roadmap` | legal | `bralidus_legal_context` (CMF, Ley 21.521/21.719) |
| `fundraising_roadmap` | estrategia+unit_economics | `bralidus_capital_context` (Corfo, liquidez global) |
| `competitive_analysis` | estrategia | complemento al RAG local de competidores |

Una sola `fetchBralidusContext(promptType, ctx, tier)` mapea prompt→query→`max_experts`, gate por tier
(reusar `BRALIDUS_TIER`), degradación elegante (breaker abierto → prompt corre sin Bralidus).

### Fase 3 — Capa de comprobabilidad (UI + persistencia)
1. Extender salida de cada deliverable con `evidence[]`: `{claim, source:"bralidus", expert, indicator, value, date, freshness}`.
2. Persistir embebido en el JSON del deliverable (sin migración nueva).
3. **EvidenceWall real**: hoy muestra datos fake (mayor gap premium). Conectar a `evidence[]` + badge de frescura.

### Fase 4 — Verificación (que "mejora" sea demostrable)
1. **Golden set** (reusar Golden Validation MediConnect): correr cada idea con/sin Bralidus → diff por dimensión.
2. **Métrica de defensibilidad**: % de ajustes de score con `evidence[]` fechado (meta 100% en macro/legal).
3. **Audit**: `moe_routing_log` (Bralidus) + `bralidus_used: bool` en `ai_interactions`.

## 5. Friction Check + KPI Anchor

- **Latencia**: +0.5-2s/llamada MoE. Mitigación: `Promise.all` + circuit breaker (8-10s) + LRU de Bralidus.
- **Tokens/costo**: presupuesto ≤600 tokens/fuente, solo nodos sobre umbral de `relevance`, gate por tier (free=off).
- **Fiabilidad**: Railway caído = breaker abierto → degradación elegante + `/ping` health.
- **KPI ancla**: (a) % de dimensiones con evidencia citada y fechada (0% → 100% macro/legal);
  (b) conversión free→Basic atribuible al EvidenceWall real.

## 6. Estado de credenciales / infra (auditado 2026-06-11)

`.env` local de Bralidus tiene SET: `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `FRED_API_KEY`,
`OPENAI_API_KEY`, `OPENBB_ENABLED`. **El smoke test local de `/query/moe` no tiene bloqueador** (solo
requiere Supabase + OpenAI, ambos presentes).

**Acciones / confirmaciones pendientes para Fase 0 en prod:**
- [x] **`BRALIDUS_API_KEY` YA existe** en `.env` local (64 hex; auth Bearer activa). *Nota: la auditoría inicial
  lo reportó ausente — fue falso negativo del `while read` de bash (descarta la última línea sin newline final).*
  Para prod, reusar el mismo valor en Railway env + Supabase secrets.
- [ ] **Acceso Railway** (proyecto/CLI token/deploy rights) — escalar a admin humano de la cuenta Railway.
- [ ] **Escritura de secrets en Supabase** (dashboard o CLI) en el proyecto validateai para `BRALIDUS_URL` + `BRALIDUS_API_KEY`.
- [ ] Confirmar con DBA que `scripts/migration_vector_search_rpc.sql` **no** se ha aplicado todavía (prereq de Fase 0).

## 6b. Smoke test `/query/moe` — contrato VALIDADO (local, 2026-06-11)

Server actual (con `/ping`, `/query/moe`) levantado en `:8001`; el `:8000` preexistente era un build viejo
(sin `/ping`). KG: **687 nodos, 411 aristas**. Routing observado: `routing_method = "semantic+context+radar"`
(el Radar Forense SÍ se consulta; sin señales activas ahora → `data_freshness=null`).
`experts_activated` retorna `[{expert_id, expert_name, score, entities_contributed}]`.

**HALLAZGO CRÍTICO — `nodes[].metadata` tiene DOS shapes (la cadena de procedencia debe ser polimórfica):**

1. **Nodos financieros/macro** (FRED/yfinance/OpenBB) — *la evidencia citable y fechada*:
   ```json
   {"fuente":"OpenBB / FRED — ICE BofA","series_id":"BAMLH0A0HYM2","unidad":"%","frecuencia":"mensual",
    "url_fuente":"https://fred.stlouisfed.org/series/BAMLH0A0HYM2","ultima_fecha":"2026-06-08",
    "ultimo_valor":2.75,"observaciones":[{"date":"...","value":...}, ...]}
   ```
   → cita: `{document_title}: {ultimo_valor}{unidad} ({ultima_fecha}) — {fuente}, {url_fuente}`. Trae serie histórica.

2. **Nodos doctrina/Familia A** (benchmarks, frameworks, legal) — permanentes, **sin fecha**:
   ```json
   {"sprint":1,"dimension":"Unit Economics","entity_type":"BENCHMARK","entity_value":"LTV:CAC > 3:1","threshold":3.0}
   ```
   → cita: `{entity_value} · {dimension}` (+ `threshold`/`formula`). El contexto los marca `_Datos en proceso de actualización._`

**HALLAZGO OPERACIONAL:** con MoE puro (`max_experts=2`) sobre query fintech, los expertos legal+unit_economics
(scores 1.05/0.92) **desplazaron los nodos macro del top-k** — los 6 hits fueron doctrina GRAPH, ningún dato
financiero fechado pese a que la query pedía "tasa Fed / costo de fondos". Para que la procedencia surfacee
datos macro **fechados**, Fase 1 debe **forzar las entidades macro** (vía `entity_override`, como ya hace
`assemble-mega-prompt` con `BRALIDUS_MACRO_OVERRIDE`) o bumpear `top_k`/`max_experts`. Una 2da llamada con
`entity_override` a entidades macro devolvió exactamente el shape #1 (High Yield Spread 2.75% 2026-06-08, IPSA
10.453 pts 2026-06-10, etc.) — confirmado citable.

## 6c. Fase 1 — Código implementado (2026-06-11, pendiente deploy Fase 0)

Cambios en `assemble-mega-prompt/index.ts` (sin tocar otros archivos):
- **`/query` → `/query/moe`**: nuevo `callBralidusMoE()`.
- **Doble pull (`fetchBralidusBundle`)**: pro/premium hacen 2 llamadas concurrentes — MoE semántico
  (doctrina + Radar Forense) + macro forzado con `entity_override=BRALIDUS_MACRO_OVERRIDE` (datos fechados).
  basic solo el pull macro. Merge dedupe por `document_title` (mayor `relevance`). Resuelve el crowding-out.
- **Evidencia polimórfica (`nodeToEvidence`)**: shape `financial` (tiene `ultimo_valor`+`ultima_fecha`) →
  cita fechada con valor/unidad/fuente/URL; shape `doctrine` (tiene `entity_type`) → referencia sin fecha.
- **`compressBralidus` reescrita**: emite bloque `EVIDENCIA CITABLE` con líneas `[DATO aaaa-mm-dd] ...`
  y `[DOCTRINA] ...`, cap ~600 tokens por relevance. (Antes: truncado ciego a 1200 chars.)
- **System prompt**: regla #5 — exige citar indicador+valor+fecha al ajustar un score; prohíbe inventar
  fecha para ítems `[DOCTRINA]`.
- **Persistencia + respuesta**: `bralidus_evidence[]`, `bralidus_experts[]`, `bralidus_data_freshness`
  en `validations.due_diligence_score` y en el JSON de respuesta (insumo para EvidenceWall en Fase 3).

**Validación contra datos reales (harness Python replicando el bundle, 2026-06-11):** doble pull → 21 nodos
(8 financieros fechados + 13 doctrina). El bloque citable incluyó High Yield Spread 2,75% (2026-06-08, FRED),
Desempleo Chile 8,93% (2026-03-01, EconDB), IPSA 10.453 pts (2026-06-10), CPI USA, UNRATE 4,3%, etc. —
todos con URL de fuente. Sin deploy (Fase 0) no corre en prod; el circuit breaker degrada a vacío.
**Falta:** `deno check`/lint en CI (no hay deno local) antes del merge.

## 6d. Fase 2 — Código implementado (2026-06-11, rama feat/bralidus-wizard)

Inyección de Bralidus en el wizard `ai-validate`, con la orquestación en 4 capas aprobada.

**Refactor DRY:** todo el bridge Bralidus se movió a `supabase/functions/_shared/bralidus.ts`
(tipos, `callBralidusMoE`, `nodeToEvidence`, `compressBralidus`, `fetchBralidusBundle`,
`BRALIDUS_CITE_DIRECTIVE`). `assemble-mega-prompt` ahora importa de ahí (Fase 1 sin duplicar).

**Caché (migración `20260611010000_bralidus_context_cache.sql`):** tabla por 4-tupla
`(scope, industry, stage, geography)`, RLS deny-all, RPC `bump_bralidus_cache_hit`. TTL
lazy-on-read + UPSERT (sin pg_cron).

**Orquestación (`fetchBralidusContextForPrompt`):**
- Capa 1 — gating `BRALIDUS_BY_PROMPT`: prompts ausentes no llaman a Bralidus (retorno null sin red).
- Capa 2 — caché por perfil: read-on-read (`expires_at > now()`), miss → pull → UPSERT no bloqueante.
- Capa 3 — pull dirigido simple (sin doble pull): `macroForce` → entity_override macro; doctrina → `queryHint`.
- Capa 4 — disparo concurrente con el pre-pass Haiku en `ai-validate` → latencia oculta.
- Inyección: `enrichedContext.bralidus_context` + `ragSystemOverride` (+ `BRALIDUS_CITE_DIRECTIVE`);
  evidencia adjunta en `parsed._bralidus` (auditable, insumo EvidenceWall Fase 3); telemetría
  `bralidus_used`/`bralidus_cached`. Degrada a null ante cualquier fallo.

**Alcance acotado por validación empírica (2026-06-11) — NO los 6 prompts originales:**
- ✅ **Incluidos**: `market_sizing`, `risk_analysis`, `risk_checklist` (macro fechado), `unit_economics`
  (queryHint → enruta a experto `unit_economics`; nodos LTV:CAC/Payback/Burn/CAC correctos).
- ⏸️ **Diferidos** `governance_assessment`, `compliance_roadmap`, `fundraising_roadmap`,
  `competitive_analysis`: el smoke test mostró que los nodos-hub de relevancia 1.0 (benchmarks
  unit-econ) **dominan el top-k incluso con el experto legal/estrategia activo** → el retrieval no
  surfacea su doctrina específica (SpA, Ley 21.719, Corfo), y alimentarlos sería ruido. Además su
  SYSTEM_PROMPT ya es doctrina-rico. Re-habilitar requiere `entity_override` por experto (acoplar a
  títulos del KG) o señales del Radar Forense activas. Follow-up.

**Pendiente:** `deno check`/lint en CI (sin deno local); aplicar la migración en Supabase; deploy Fase 0.

## 7. Secuencia aprobada

**Fase 0 → Fase 1 primero** (directriz Mesa 2026-06-11): gestión de riesgo (validar infra en flujo acotado
sin tocar el wizard), quick win (arreglar Gap D + procedencia en DD justifica conversión free→Basic), y
fundación empírica (medir latencia/tokens reales antes de inyectar masivamente en Fase 2).
