# Plan T3.5 — Modularizar `premium-validate` (runbook)

Mismo enfoque, doctrina y red de seguridad que la desmonolitización de `ai-validate`
(ver historial: cors/prompts/benchmarks/rag/aiProvider/persist).

## Estado actual
`supabase/functions/premium-validate/index.ts` = **408 líneas**. Monolito:
- env consts (ANTHROPIC, SUPABASE, REDDIT_CLIENT_ID/SECRET, SERPAPI) — líneas 4–9
- CORS (`ALLOWED_ORIGINS` + `corsHeaders` + helper `json`) — 11–34  *(dup de `_shared/cors.ts`)*
- **Agente Reddit** (`RedditPost`, KV token cache, `getRedditTokenCached`,
  `fetchFreshRedditToken`, `inferSentiment`, `fetchRedditReal`, `fetchReddit`) — 36–143
- **Agente Trends** (`fetchTrendsReal`, `fetchTrends`) — 145–187
- **Síntesis AI** (`ValidationContext`, `SYNTHESIS_SYSTEM_PROMPT`, `synthesize`) — 188–261
- handler `serve()` — 262–408 (**146 líneas**)

Solo importa `createClient`. No reusa `_shared`.

## Doctrina de verificación (idéntica a ai-validate)
- **byte-identical**: `sha256` del bloque antes/después (construir por *slicing* con `sed`, no retipear).
- env consts relocadas **verbatim**; deps internas importadas.
- `deno check` + `deno test` + **deploy + smoke** (preflight 200 + POST sin auth → 401).
- Un **PR por wave**; el auto-deploy redepliega `premium-validate` al cambiar su dir.

## Decisión de ubicación: co-located (NO `_shared`)
Reddit/Trends/síntesis son **específicos** de premium-validate (sin reuso) → módulos
**co-located** (`premium-validate/reddit.ts`, `trends.ts`, `synthesis.ts`). Ventajas:
- El auto-deploy ya trackea cambios en el dir de la función (sin el tema de "importadores de `_shared`").
- Supabase bundlea los archivos locales importados al desplegar la función.

**Pero** el CI `deno test` hoy solo corre `_shared/*.test.ts` → ver **W0**.

---

## W0 — Habilitar tests co-located en CI (hacer primero)
Extender `.github/workflows/deno-check.yml`: agregar un step que corra
`deno test --allow-env` también sobre los **dirs de función cambiados** (no solo `_shared/`).
Así los tests de `premium-validate/*.test.ts` gatean en CI. Generaliza para toda función.
- PR chico, sin tocar código de funciones. Verif: que el step exista y no rompa.

## W1 — Reusar `_shared/cors.ts` (dedup CORS)
- Reemplazar `ALLOWED_ORIGINS` + `corsHeaders` inline por
  `import { getCorsHeaders } from '../_shared/cors.ts'` y adaptar call sites.
- **Nota:** `cors.ts` incluye `http://localhost:5174` que premium no tenía → amplía
  los orígenes permitidos (inocuo, de hecho lo alinea con ai-validate).
- El helper `json()` es premium-specific → dejarlo inline (adaptado a `getCorsHeaders`),
  o mover a `_shared/http.ts` si se quiere reusar.
- ⚠️ Cambiar `premium-validate` a importar `../_shared/cors.ts` lo vuelve **importador de
  `_shared`** → el auto-deploy lo incluirá en cambios de `_shared` (correcto).
- Verif: deno check + deploy + smoke.

## W2 — Agente Reddit → `premium-validate/reddit.ts`
- Mover líneas 36–143 (interface + KV + token cache + sentiment + fetch).
- Relocar `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` verbatim al módulo.
- Exportar `fetchReddit` (lo usa el handler) y `inferSentiment` (para test).
- byte-identical (golden hash de 36–143).
- **Test** `reddit.test.ts`: `inferSentiment(title, score)` — función pura (mapea a
  positive/negative/neutral según keywords + score).

## W3 — Agente Trends → `premium-validate/trends.ts`
- Mover 145–187. Relocar `SERPAPI_KEY` verbatim. Exportar `fetchTrends`.
- La math de trayectoria (`upward`/`downward`/`stable` según first6 vs last6) es **pura**
  → extraer a `trajectoryOf(values: number[])` + test (casos: subida, bajada, estable, vacío).

## W4 — Síntesis → `premium-validate/synthesis.ts`
- Mover `SYNTHESIS_SYSTEM_PROMPT` (data pura), `ValidationContext`, `synthesize`
  (188–261). Relocar `ANTHROPIC_API_KEY`. Exportar `synthesize`.
- byte-identical. (synthesize es un call Claude propio — NO reusa aiProvider.ts, que está
  atado a los prompt types de ai-validate.)

## Resultado esperado
`index.ts` ~150 líneas (handler + orquestación). 3 módulos co-located + helpers puros
testeados. Tests corriendo en CI vía W0.

## Riesgos / notas
- premium-validate es el **flujo premium** (Reddit + Trends + síntesis), autenticado y
  con costo de tokens. El smoke (preflight + 401) confirma que carga; el path real
  requiere usuario premium (no cubierto por smoke).
- **Reddit secrets NO están en prod** (`REDDIT_CLIENT_ID/SECRET` ausentes) → `fetchReddit`
  lanza/degrada hoy. El refactor **no** cambia eso (ver `docs/REDDIT_ACTIVATION.md`).
- Orden sugerido: **W0 → W1 → W2 → W3 → W4**. Cada uno su PR, CI verde, deploy+smoke.
