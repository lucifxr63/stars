# Plan de integración: Licitus → Bralidus

**Fecha:** 2026-07-18
**Autor del estudio:** Claude (Opus 4.8)
**Ejecutor previsto:** Fable
**Decisiones ya tomadas por el usuario:**
- Alcance del primer paso: **Doc + panel vivo** en `bralidus.scouttech.lat`.
- Tratamiento de la key: **aceptar ambas** (`VALIDATEAI_API_KEY` existente + nueva `BRALIDUS_API_KEY`) en el middleware de Licitus, migración sin downtime.

---

## 0. Hallazgo que motiva todo (contexto imprescindible)

El nombre `VALIDATEAI_API_KEY` en `PYMENGINE/backend/.env` **confunde el sentido del flujo**.
No es Licitus llamando a ValidateAI. Es el **secreto de entrada** que Licitus exige a quien
consuma su API B2B `/v1/*`. Es decir:

- **Licitus = proveedor** (expone `/v1/*`, ya listo, en `api.licitus.scouttech.lat`).
- **ValidateAI (Validus) = consumidor previsto… que nunca se cableó.** Sus Edge Functions
  (`chilecompra-fetch`, `chilecompra-calcular`, `market-analyze`) golpean Mercado Público
  **directamente**; no existe ningún `pymengine-fetch`/cliente Licitus en `validateai/supabase/functions/`.

Conclusión operativa: la integración está **provisionada pero dormida**. Este plan la
**reasigna a Bralidus** como consumidor, reutilizando el contrato `/v1` tal cual (no se
reconstruye nada del lado de Licitus salvo aceptar una key adicional).

### Evidencia (archivos de referencia)
- `PYMENGINE/backend/src/infrastructure/http/api-key.middleware.ts:15-30` — auth de **entrada**.
- `PYMENGINE/backend/src/app/routes.ts:25-28` — monta `/v1/*` tras `rateLimit` + `apiKeyMiddleware`.
- `PYMENGINE/backend/src/modules/integration-api/presentation/integration-api.routes.ts` — endpoints.
- `PYMENGINE/backend/src/modules/integration-api/presentation/integration-api.controller.ts:27-28` —
  *"El contrato /v1 devuelve JSON plano (sin el wrapper {success, data})… ValidateAI consume esta forma."*

---

## 1. Contrato que Licitus ya expone (lo que Bralidus va a consumir)

Base URL: `https://api.licitus.scouttech.lat/v1`
Auth: header `Authorization: Bearer <key>` **o** `x-api-key: <key>`.
**Forma de respuesta: JSON plano, SIN envoltura `{success, data}`** (⚠️ diferencia clave
vs. S-Pulse, que sí envuelve — el cliente Licitus NO debe desenvolver).

| Método / Path | Query params | Devuelve |
|---|---|---|
| `GET /v1/proveedor/:rut` | `periodo_meses` (1–24, def 12) | Actividad OCs, buyer_intelligence, categorías, data_quality. `404 {error, message, rut}` si el RUT no tiene actividad. |
| `GET /v1/mercado/benchmarks` | `unspsc?`, `region?`, `periodo_meses` (def 12) | Volumen, percentiles p25/mediana/p75, contratos, top_compradores. `404 {error:"sin_datos"}` si no hay datos. |
| `GET /v1/mercado/activas` | `unspsc?`, `region?`, `monto_min?`, `cierre_desde_horas` (def 168), `limit` (1–100, def 20) | Lista de licitaciones activas. |

Schemas de respuesta completos: ver `docs/PYMENGINE_VALIDATEAI_INTEGRATION_V2.md` (§"Schema revisado").

> **Solape a vigilar:** Validus ya tiene su propio `GET /api/v1/data/chilecompra/metricas`
> (métricas M1–M10 de un proveedor, calculadas por `chilecompra-calcular` desde su propia
> ingesta de Mercado Público). Licitus `/v1/proveedor/:rut` es una fuente **paralela** y más
> rica (OCs reales de `purchase_orders`). El plan NO fusiona ambas; solo documentar la
> distinción para no duplicar en la UI. Decidir a futuro cuál es canónica.

---

## 2. Arquitectura objetivo (patrón espejo de S-Pulse)

```
Browser (bralidus.scouttech.lat / DeveloperPortal)
   │  (Validus API key del developer, modelo existente del portal)
   ▼
api-v1 Edge Function (validateai/supabase/functions/api-v1)   ← nuevo route /data/licitus/*
   │  (BRALIDUS_API_KEY como Supabase secret, server-side)
   ▼
BralidusPY FastAPI (validateai-financial-worker, Railway)     ← nuevo /licitus/* proxy
   │  (LICITUS_API_KEY como Railway env, server-side)
   ▼
Licitus /v1/* (api.licitus.scouttech.lat)                     ← ya existe; solo acepta 2ª key
```

**Por qué el hop por `api-v1` y no browser→BralidusPY directo:** el secreto de BralidusPY
(`BRALIDUS_API_KEY`) no puede vivir en el bundle del navegador. El portal ya usa
`${VITE_SUPABASE_URL}/functions/v1/api-v1` como gateway autenticado (ver
`Bralidus/src/pages/DeveloperPortal.tsx:190-191`). Reutilizamos ese modelo.

El patrón exacto a replicar en BralidusPY está en:
- `validateai-financial-worker/src/clients/spulse_client.py`
- `validateai-financial-worker/api/spulse.py`
- `validateai-financial-worker/api/app.py:39,126` (registro del router)
- `validateai-financial-worker/src/config.py:24-30` (config S-Pulse)

---

## 3. Trabajo por repositorio

### 3.1 Licitus — `E:\DEV\Respos\Trabajo\PYMENGINE\backend` (repo git propio)

**Objetivo:** aceptar `BRALIDUS_API_KEY` además de `VALIDATEAI_API_KEY`, sin downtime.
Cambio mínimo, aditivo.

1. **`src/app/env.ts`** (junto a la línea 126):
   - Añadir `BRALIDUS_API_KEY: z.string().min(16).optional()`.
2. **`src/infrastructure/http/api-key.middleware.ts`**:
   - Recolectar las keys válidas configuradas: `[env.VALIDATEAI_API_KEY, env.BRALIDUS_API_KEY].filter(Boolean)`.
   - Si el array está vacío → `AppError.internal('Inter-system API key not configured')`.
   - Aceptar si la key entrante hace `safeEqual` contra **cualquiera** de las configuradas
     (mantener comparación en tiempo constante para cada candidata; no cortar temprano de
     forma que filtre timing sobre cuál coincidió — iterar todas).
3. **`.env` / `.env` de prod (Cloudflare `wrangler.jsonc` vars o secrets):**
   - Añadir `BRALIDUS_API_KEY=<nuevo secreto generado>` (32+ bytes hex, como el `_PROD` actual).
   - **No** eliminar `VALIDATEAI_API_KEY` todavía (migración sin downtime; se retira en una
     fase posterior una vez confirmado que nadie más lo usa — está dormido, así que es seguro
     pero lo dejamos por prudencia).
4. **CORS:** las llamadas a `/v1/*` son server-to-server (desde BralidusPY), no browser →
   no requiere tocar `CORS_ORIGIN`.
5. **Tests:** `PYMENGINE/backend/tests` — extender el test del middleware para cubrir: acepta
   key A, acepta key B, rechaza key inválida, 500 si ninguna configurada.
6. **Doc:** actualizar el comentario `// ValidateAI inter-system API key` en `env.ts` para
   reflejar que ahora es multi-consumidor (Validus + Bralidus).

> Nota: NO se renombra `VALIDATEAI_API_KEY` a nivel de código en este paso (rompería prod).
> La eliminación de la confusión se logra vía la nueva key + comentarios; el rename total es
> deuda para una fase de limpieza posterior.

---

### 3.2 BralidusPY — `startups/validateai-financial-worker` (mismo monorepo `startups`)

**Objetivo:** cliente + router proxy `/licitus/*`, espejo de S-Pulse. **Sin** inyección en
`/query` en este primer paso (eso es Fase 2 opcional — ver §5).

1. **`src/config.py`** (tras el bloque S-Pulse, líneas 24-30):
   ```python
   # ── Licitus — Inteligencia de Mercado Público (host↔Licitus, opcional) ─────────
   LICITUS_BASE_URL: str = os.getenv("LICITUS_BASE_URL", "").rstrip("/")  # ej: https://api.licitus.scouttech.lat/v1
   LICITUS_API_KEY: str = os.getenv("LICITUS_API_KEY", "")
   LICITUS_TIMEOUT_S: float = float(os.getenv("LICITUS_TIMEOUT_S", "8"))
   ```

2. **`src/clients/licitus_client.py`** (nuevo, calcar de `spulse_client.py` con estas diferencias):
   - Auth header: `Authorization: Bearer {api_key}` (Licitus acepta Bearer o x-api-key).
   - **⚠️ Respuesta plana:** `_get` devuelve `resp.json()` directo — **NO** hace
     `payload.get("data")` ni valida `payload["success"]` (Licitus no envuelve).
   - Degradación a `None` ante 404/4xx/5xx/timeout/JSON malformado (misma filosofía que S-Pulse).
   - Reintentos con `tenacity` solo en `(requests.Timeout, requests.ConnectionError)`.
   - Validación de RUT reutilizando `src/utils/rut.py` (`is_valid_rut`, `normalize_rut`) para
     `get_proveedor`.
   - Métodos:
     - `is_enabled() -> bool` (True si `LICITUS_BASE_URL`).
     - `health() -> bool` (Licitus no tiene `/v1/health` documentado — usar una llamada barata
       como `/mercado/activas?limit=1` y considerar OK si status < 500, o simplemente reportar
       `is_enabled()`; decidir en implementación).
     - `get_proveedor(rut, periodo_meses=12) -> dict | None`.
     - `get_benchmarks(unspsc=None, region=None, periodo_meses=12) -> dict | None`.
     - `get_activas(unspsc=None, region=None, monto_min=None, cierre_desde_horas=168, limit=20) -> list[dict] | None`.
   - Singleton perezoso al final: `licitus = LicitusClient()`.

3. **`api/licitus.py`** (nuevo, calcar de `api/spulse.py`):
   - `router = APIRouter(prefix="/licitus", tags=["licitus"], dependencies=[Depends(require_api_key)])`.
   - Helper `_or_503(data)` idéntico.
   - Endpoints proxy:
     - `GET /licitus/health` → `{ enabled, ok }`.
     - `GET /licitus/proveedor/{rut}` con query `periodo_meses`.
     - `GET /licitus/mercado/benchmarks` con query `unspsc?, region?, periodo_meses`.
     - `GET /licitus/mercado/activas` con query `unspsc?, region?, monto_min?, cierre_desde_horas, limit`.
   - Mensaje de degradación genérico (`_UNAVAILABLE = "Licitus no disponible o sin datos para este recurso."`).

4. **`api/app.py`:**
   - `from api.licitus import router as licitus_router` (junto a la línea 39).
   - `app.include_router(licitus_router)` (junto a la línea 126).
   - En el healthcheck de servicios (`~línea 730-745`, donde se reporta `spulse`), añadir un
     bloque análogo para `licitus` (enabled / reachable / error).

5. **Env de BralidusPY (Railway):**
   - `LICITUS_BASE_URL=https://api.licitus.scouttech.lat/v1`
   - `LICITUS_API_KEY=<misma nueva key generada en §3.1.3>`

6. **Tests:** `validateai-financial-worker/tests` (o donde vivan) — cliente degrada a None en
   4xx/5xx/timeout; parseo de respuesta plana (sin wrapper); RUT inválido corta antes del round-trip.

---

### 3.3 Gateway `api-v1` — `validateai/supabase/functions/api-v1` (repo `startups`)

**Objetivo:** exponer los datos de Licitus al navegador con el modelo de auth existente del
portal (Validus API key), sin filtrar `BRALIDUS_API_KEY`.

1. **`api-v1/routes/data.ts`** (donde ya vive `chilecompra/metricas`):
   - Añadir sub-rutas bajo `/api/v1/data/licitus/*` que hagan `fetch` server-side a BralidusPY:
     - `GET /api/v1/data/licitus/proveedor/:rut`
     - `GET /api/v1/data/licitus/mercado/benchmarks`
     - `GET /api/v1/data/licitus/mercado/activas`
   - Cada una llama a `${BRALIDUS_BASE_URL}/licitus/...` con
     `Authorization: Bearer ${BRALIDUS_API_KEY}` (secretos de Supabase).
   - Propagar rate-limit / auth del developer como el resto de `api-v1`.
2. **Secrets de Supabase (proyecto `fcdhcntyvsydnvjwopfe`):**
   - `BRALIDUS_BASE_URL` (URL Railway de BralidusPY, ya debería existir para spulse/query).
   - `BRALIDUS_API_KEY` (ya debería existir; confirmar).
3. Verificar que el router de `api-v1` monta correctamente el nuevo namespace (revisar
   `api-v1/index.ts` o el dispatcher de rutas).

> Alternativa más simple si se acepta que el panel viva SOLO dentro del portal autenticado:
> saltarse `api-v1` y que el panel llame directo a BralidusPY **si** BralidusPY expusiera un
> modo de auth apto para browser (no lo tiene hoy → `require_api_key` con secreto). Por eso
> se recomienda el hop por `api-v1`. Decidir con Fable si se prefiere minimizar cambios de repo.

---

### 3.4 Frontend `bralidus.scouttech.lat` — `E:\DEV\Respos\Trabajo\Bralidus` (repo git propio)

El "apartado para Licitus" vive dentro de `/dashboard` → `DeveloperPortal`
(`src/pages/DeveloperPortal.tsx`), que es la página que renderiza la ruta protegida
(`src/App.tsx:54-61`).

**Parte A — Documentación (estático):**
1. En `DeveloperPortal.tsx`, extender el array `API_DOCS` (`~línea 104`) con 3 entradas nuevas
   (`/api/v1/data/licitus/proveedor/:rut`, `.../mercado/benchmarks`, `.../mercado/activas`),
   con `params`, `responseExample` y `errorCodes` tomados de §1 y del doc V2.
   - Color sugerido para la familia Licitus: naranjo `#F59E0B` (ya usado para chilecompra) o
     uno nuevo distintivo (p. ej. `#22C55E`) para diferenciar la fuente. Definir con diseño.
2. Opcional: nueva entrada en `ServiceModal.tsx` describiendo "Licitus API" como servicio del
   ecosistema (calcar de la entrada BralidusPY existente, `ServiceModal.tsx:115-155`).

**Parte B — Panel vivo:**
3. Añadir al array `ENDPOINTS` del playground (`~línea 193`) las 3 rutas Licitus para que el
   "probador" existente las ejecute contra `${BASE}/data/licitus/...` (`BASE` ya es
   `${SUPABASE_URL}/functions/v1/api-v1`, línea 191). Esto da panel vivo **con reuso total**
   del componente de playground actual — es el camino de menor esfuerzo y coherente con el portal.
4. (Opcional, mayor esfuerzo) un componente dedicado `src/components/LicitusPanel.tsx` (calcar
   `BralidusPanel.tsx`) con inputs (RUT / UNSPSC / región) y render de resultados formateados
   en vez del JSON crudo del playground. Recomendado solo si se quiere UX de producto, no de doc.
5. Registrar el nuevo panel/sección en la navegación del `DeveloperPortal` (revisar cómo el
   portal organiza sus tabs/secciones actuales antes de insertar).

**Env del frontend:** ninguno nuevo (usa `VITE_SUPABASE_URL` existente).

---

## 4. Variables de entorno — resumen

| Repo / entorno | Variable | Valor | Estado |
|---|---|---|---|
| Licitus `.env` + prod (CF) | `BRALIDUS_API_KEY` | nuevo secreto (32B hex) | **crear** |
| Licitus | `VALIDATEAI_API_KEY(_PROD)` | actual | **mantener** (dormido, retirar luego) |
| BralidusPY (Railway) | `LICITUS_BASE_URL` | `https://api.licitus.scouttech.lat/v1` | **crear** |
| BralidusPY (Railway) | `LICITUS_API_KEY` | = `BRALIDUS_API_KEY` de Licitus | **crear** |
| BralidusPY (Railway) | `LICITUS_TIMEOUT_S` | `8` (opcional) | opcional |
| Supabase (`api-v1`) | `BRALIDUS_BASE_URL`, `BRALIDUS_API_KEY` | existentes | **confirmar** |

> La misma cadena de secreto se usa en dos lados: es el `BRALIDUS_API_KEY` que Licitus valida
> a la entrada, y el `LICITUS_API_KEY` que BralidusPY presenta a la salida. Un solo secreto,
> dos nombres según el punto de vista (patrón idéntico a `SPULSE_INTERNAL_API_KEY`).

---

## 5. Fase 2 (opcional, NO en este paso)

Inyectar señales de Licitus en el contexto GraphRAG de `/query`, igual que S-Pulse hace con
`build_relationship_context` (`api/spulse.py:79-150`, invocado en `api/app.py:224,366`):
- Nuevo `build_procurement_context(rut, ...)` en `api/licitus.py` que arme un bloque Markdown
  ("Actividad en Compras Públicas") desde `get_proveedor` + `get_benchmarks`.
- `_maybe_append_licitus(...)` análogo a `_maybe_append_spulse` en `app.py`.
- Requiere que Validus forwardee `company_rut` en `startup_context` (ya lo hace para S-Pulse
  según `project_spulse_integration` / `project_company_identity`).

---

## 6. Orden de ejecución recomendado

1. **Licitus** (§3.1) — aditivo, desplegable solo, sin romper nada. Generar y guardar el secreto.
2. **BralidusPY** (§3.2) — cliente + proxy; probar `/licitus/health` y `/licitus/mercado/activas?limit=1`
   contra Licitus prod con el secreto.
3. **Gateway api-v1** (§3.3) — probar `/api/v1/data/licitus/mercado/activas` desde el playground.
4. **Frontend** (§3.4) — docs + playground; luego panel dedicado si se quiere.
5. **Verificación end-to-end:** RUT real con actividad (proveedor conocido de Mercado Público)
   → confirmar que el dato viaja Browser→api-v1→BralidusPY→Licitus y vuelve renderizado.

---

## 7. Riesgos / decisiones abiertas para Fable

- **`/licitus/health`:** Licitus no expone health en `/v1`. Definir estrategia (llamada barata
  vs. solo `is_enabled`).
- **Solape con `chilecompra/metricas`** (§1 nota): decidir si Licitus reemplaza o convive con
  la fuente propia de Validus. No fusionar en este paso.
- **Hop por api-v1 vs. directo:** confirmado recomendado el hop (secreto server-side). Si Fable
  prefiere minimizar repos tocados, discutir alternativa (pero evitar exponer `BRALIDUS_API_KEY`
  en el browser — no negociable).
- **Rate limiting:** Licitus rate-limita `/v1/*` ANTES de la auth (`routes.ts:27`). El panel
  vivo debe manejar 429 con gracia.
- **Retiro futuro de `VALIDATEAI_API_KEY`:** fase de limpieza posterior, fuera de alcance.
