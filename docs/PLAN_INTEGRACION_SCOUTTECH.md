# Plan detallado — cierre de la integración Scouttech (S-Pulse ↔ Bralidus ↔ Validus)

> Estado: 2026-07-15. Documento vivo. Cubre lo que **ya está en producción** (baseline) y el
> trabajo **pendiente**, priorizado y con pasos concretos + verificación por ítem.

---

## 0. Baseline — qué está VIVO en producción

| Pieza | URL / proyecto | Estado |
|---|---|---|
| S-Pulse API | `https://api.nexus.scouttech.lat` (Vercel `nexus-api`) | ✅ AuraDB `5f61af10`, 1002 empresas, doble auth |
| S-Pulse UI | `https://nexus.scouttech.lat` (Vercel `nexus`) | ✅ login ecosistema (Google + email) |
| S-Pulse cron | `.github/workflows/cron.yml` (repo S-Pulse) | ✅ GitHub Actions |
| Bralidus API | `https://api.bralidus.scouttech.lat` (Vercel `bralidus-api`) | ✅ FastAPI, `/health`+`/spulse/*`+`/query/moe` |
| Bralidus UI | `https://bralidus.scouttech.lat` (Vercel `bralidus`) | ✅ SPA, OAuth `/auth/callback` OK |
| Integración S-Pulse↔Bralidus | env `SPULSE_*` en `bralidus-api` | ✅ verificado E2E (datos reales de Aura) |
| Validus→Bralidus | secrets `BRALIDUS_URL`/`BRALIDUS_API_KEY` (Supabase Edge) | ✅ seteados |

**Cadena completa funcional:** `Validus → bralidus-api → S-Pulse → AuraDB`.

---

## 1. [ALTA] Validus puebla `company_rut` → activa la parte S-Pulse por-empresa

**Por qué:** hoy Validus llama a Bralidus para inteligencia **macro** (`/query/moe`), pero NO manda
`company_rut`, así que la inyección de relaciones societarias de S-Pulse
(`build_relationship_context` en Bralidus) nunca se dispara. Sin esto, S-Pulse está desplegado
pero su valor por-empresa no llega al usuario.

**Contexto técnico (verificado):**
- `validateai/supabase/functions/_shared/bralidus.ts::callBralidusMoE` ya forwardea el body verbatim.
- Los builders `fetchBralidusBundle` / `fetchTargetedBundle` **NO** agregan `company_rut` ni `tenant_id`.
- Bralidus (`api/schemas.py`) ya acepta `StartupContext.company_rut` y `QueryRequest.tenant_id`.
- **Trampa de caché:** el wizard cachea el bundle por perfil (`industry/stage/geo`). Meter data
  por-empresa ahí **envenena la caché**. → El consumidor correcto es el **path Due Diligence**
  (per-validación, sin caché de perfil), no el wizard.

**Pasos:**
1. **Definir la fuente del RUT** de la startup en Validus. Candidatos: Founder Profile, un input
   nuevo en el flujo DD, o el propio dossier. Decisión de producto — resolver primero.
2. En el **path DD** (no en el wizard cacheado), extender el builder para agregar
   `startup_context.company_rut` + `tenant_id` al body de `callBralidusMoE`.
3. Dejar el wizard intacto (o cachear con key que incluya el RUT sólo si se decide cachear por-empresa).
4. `tenant_id`: usar el identificador compartido del ecosistema (token de identidad), como define
   el modelo de tenancy.

**Verificación:** una validación DD con RUT real → la respuesta de Bralidus trae la sección de
relaciones S-Pulse; confirmar en logs de `bralidus-api` que pegó a `/spulse/companies/{rut}/*`.

---

## 2. [MEDIA] Scheduler de Bralidus (9 jobs) → cron externo

**Por qué:** en Vercel serverless el APScheduler está deshabilitado (guard `VERCEL=1`). Los 9 jobs
de ingesta/radar no corren → la data macro (FRED, yfinance, CMF, SEIA, radar de señales) se queda
estática. Hoy sólo `POST /ingest` (FRED+yfinance) tiene trigger HTTP.

**Jobs y schedules actuales** (`validateai-financial-worker/api/scheduler.py`):

| Job id | Schedule original | Frecuencia |
|---|---|---|
| `fred_sync` | dom 03:00 | semanal |
| `yfinance_sync` | día 1, 04:00 | mensual |
| `cache_sweep` | `*/2h` | cada 2 h |
| `radar_refresh` | `*/30min` | cada 30 min |
| `cmf_sync` | 9/13/17:15 Santiago | 3×/día hábil |
| `seia_sync` | cada 3 días 08:00 | c/3 días |
| (mercado público) | lun-vie 07:30 Santiago | días hábiles |
| + 2 más | — | (enumerar de scheduler.py) |

**Pasos:**
1. **A1 — Exponer triggers HTTP.** Añadir router `POST /jobs/run/{job_id}` en `api/app.py`,
   protegido por `CRON_SECRET` (Bearer), que invoca la función del job correspondiente (patrón
   idéntico al `src/routes/cron.js` de S-Pulse). Extraer cada job a función invocable si aún no lo es.
2. **A2 — Driver de cron.** GitHub Actions programado (repo del monorepo o uno dedicado): un workflow
   con varios `schedule` (UTC) o varios jobs, mapeando cada schedule → `curl` al endpoint con el
   `CRON_SECRET`. GH Actions soporta granularidad de minutos (radar cada 30 min OK). **No** Vercel
   Cron (Hobby limita a 2 crons diarios) ni Cloudflare (cuenta Free sin triggers libres).
3. **A3 — Timeouts.** Verificar que los jobs pesados (yfinance batch 12 tickers, SEIA scraping)
   entren en el `maxDuration` de la función (hoy sin `vercel.json functions` explícito → default;
   subir a 300 si hace falta). Si superan, trocear o mover ese job a un runner sin timeout (GH Actions
   corre el trabajo pesado ahí mismo en Python, no vía HTTP).
4. **A4 — `CRON_SECRET`** como env de `bralidus-api` (Vercel) + secret del repo de GH Actions.

**Verificación:** `curl -H "Authorization: Bearer $CRON_SECRET" .../jobs/run/fred_sync` → 200 y
`/health` muestra la data fresca; sin el secret → 401.

---

## 3. [MEDIA] Seguridad — rotar secretos expuestos durante el setup

Durante la puesta en marcha se compartieron/mostraron secretos en texto (chat/terminal). Buena
higiene: **rotarlos** ahora que todo funciona.

| Secreto | Dónde vive | Acción |
|---|---|---|
| `NEO4J_PASSWORD` (Aura `5f61af10`) | S-Pulse `.env` + Vercel `nexus-api` | Rotar en Aura → actualizar env |
| `BRALIDUS_API_KEY` | `bralidus-api` + Validus Edge secret | Rotar → actualizar ambos |
| `INTERNAL_API_KEY` (S-Pulse) | `nexus-api` + cron GH secret | Rotar → actualizar ambos |
| `CRON_SECRET` | `nexus-api` + GH secret | Rotar si se agrega el cron de Bralidus |

**Nota:** rotar en pares (el que produce y el que consume) para no romper la cadena.

---

## 4. [BAJA] Higiene de git / repos

1. **Push del commit `62991f2`** (cambios de `bralidus-api`: `vercel.json`, scheduler guard,
   `.vercelignore`) — está commiteado local en el monorepo `startups`. ⚠️ el remote del working copy
   apunta a `Denarius.git` (revisar que sea el repo correcto antes de pushear).
2. **S-Pulse PR #3** (login ecosistema): confirmar merge a `main`.
3. **Bralidus PR #1** (SPA rewrite): ✅ mergeado (verificado, `/auth/callback`→200).
4. Alinear el `.vercel/project.json` local de `validateai-financial-worker` (quedó apuntando a
   `bralidus-api`, correcto).

---

## 5. [CONTINUO] Hardening operacional

- **Observabilidad:** activar logs/observability en los proyectos Vercel (`nexus-api`, `bralidus-api`);
  revisar `/health` de ambos como probe. Considerar un uptime check externo.
- **Costos:** OpenAI (embeddings por `/query`), Vercel functions (invocaciones + duración), AuraDB
  Free (se **pausa/borra por inactividad** — el cron de S-Pulse la mantiene viva; monitorear límites
  de tamaño del grafo). yfinance/curl_cffi: rate limits.
- **Caché de Bralidus:** hoy `hit_rate=0.0`; con tráfico real, validar que la caché por perfil funciona
  y no se envenena (ver ítem 1).
- **CORS/rate limiting:** `ALLOWED_ORIGINS` de `bralidus-api` = `bralidus.scouttech.lat`; sumar
  `validus.scouttech.lat` si el frontend de Validus llegara a llamar directo (hoy llama vía Edge, sin Origin).

---

## Secuencia sugerida

1. **Ítem 1 (company_rut)** — es lo que convierte todo el despliegue en valor real de S-Pulse. Requiere
   una decisión de producto (fuente del RUT) → arrancar por ahí.
2. **Ítem 3 (rotar secretos)** — rápido y de bajo riesgo, cierra la exposición del setup.
3. **Ítem 2 (scheduler cron)** — cuando la data macro estática empiece a molestar.
4. **Ítem 4 (git)** — cuando quieras consolidar el historial.
5. **Ítem 5** — continuo.

## Verificación global (smoke del ecosistema)
```
GET  https://api.nexus.scouttech.lat/api/health                → 200
GET  https://api.bralidus.scouttech.lat/health                 → spulse "alcanzable"
POST https://api.bralidus.scouttech.lat/query/moe (Bearer)     → RAG real
UI   https://nexus.scouttech.lat  /  https://bralidus.scouttech.lat  → login OK
```
