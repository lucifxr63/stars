# Inventario de secretos — dónde vive cada credencial

**Este archivo NO contiene valores y nunca debe contenerlos.** Sólo dice qué lee
cada credencial y dónde está guardada, para que una rotación sea un
procedimiento de minutos y no una cacería.

Levantado el 2026-08-05 leyendo el código (`Deno.env.get`, `os.getenv`,
`process.env`, esquema zod de `env.ts`, `secrets.*` de GitHub Actions).

> ⚠️ **Lo que este inventario NO puede saber.** Es el mapa de quién **lee** cada
> variable. No verifica qué está efectivamente **configurado** en cada proyecto
> Vercel / Supabase / Cloudflare — eso requiere `vercel env ls`,
> `supabase secrets list` y el dashboard de Cloudflare. Antes de revocar nada,
> contrastar contra esas tres fuentes.

---

## 🔴 Antes de tocar la service role: leer esto

**El proyecto tiene claves de dos generaciones mezcladas.**

| Clave | Formato observado | Dónde |
|:---|:---|:---|
| anon / publishable | `sb_publishable_...` | `validateai-developer-portal/CLAUDE.md:39` |
| service role | `eyJ...` (JWT legacy) | `validateai-financial-worker/.env.example` |

Si la service role sigue siendo una **JWT legacy**, está firmada con el JWT
secret del proyecto, y rotarla significa rotar ese secret. Eso **invalida todas
las claves legacy de una vez y cierra las sesiones activas de todos los
usuarios** — no es "actualizar una variable".

La alternativa segura es migrar la service role a una **secret key nueva**
(`sb_secret_...`), que se rota y revoca de forma independiente y admite convivir
con la vieja mientras se propaga.

**Verificar en el dashboard de Supabase qué tipo es antes de decidir.** El
`.env.example` puede estar desactualizado — el mismo archivo todavía dice
"En Railway", y el worker vive en Vercel desde julio.

---

## Las cuatro credenciales a rotar (SEC-1)

### 1. `SUPABASE_SERVICE_ROLE_KEY` — la de mayor impacto

Salta RLS por diseño y es la misma base para Validus, Animus, Bralidus y el vault.

| Consumidor | Cómo la obtiene | ¿Hay que tocarlo al rotar? |
|:---|:---|:---|
| **40 Edge Functions** de `validateai/supabase/functions/` | **Auto-inyectada por Supabase** | **No.** La plataforma la provee sola |
| 1 Edge Function de `facturaia/` | Auto-inyectada | No |
| **`bralidus-api`** (worker) — `src/config.py` la exige con `_require()` | Variable del proyecto Vercel | **Sí** — y además `vercel deploy --prod` |
| GitHub Actions `validateai/sync-uf-daily.yml` | `secrets.SUPABASE_SERVICE_ROLE_KEY` del repo | **Sí** |
| Scripts locales (`validateai/scripts/*`, `validateai-developer-portal/scripts/*`, `cashflow/launch/*`) | `.env.local` de cada dev | Sí, pero no bloquea prod |

**Que las Edge Functions la reciban automáticamente es la mejor noticia del
inventario:** 41 de los 45 consumidores no requieren ninguna acción.

⚠️ **Trampa de nombres.** `validateai/scripts/inapi_ingest/supabase_client.py`
lee **`SUPABASE_SERVICE_KEY`** (sin `_ROLE`). Si se rota y sólo se actualiza el
nombre largo, ese script queda con la clave vieja y falla recién cuando alguien
lo corra.

✅ **`mp-sync` NO usa la service role** — se conecta por Postgres directo
(`BRALIDUS_DATABASE_URL` / `LICITUS_DATABASE_URL`). No hay que tocarlo.

**Verificación (efecto, no status):**
```bash
curl -X POST "$BRALIDUS/jobs/run/fred_sync" -H "Authorization: Bearer $CRON_SECRET"
# debe producir nodos, no sólo responder 200
```

---

### 2. `OPENAI_API_KEY` — embeddings

| Consumidor | Dónde está guardada | Tocar |
|:---|:---|:---|
| `bralidus-api` — `src/config.py` la exige con `_require()` | Variable del proyecto Vercel | **Sí** + redeploy |
| Edge Functions (`ai-validate` como proveedor alternativo, `assemble-mega-prompt` para embeddings) | Secret de Supabase | **Sí** (`supabase secrets set`) |
| `validateai/supabase/config.toml:95` → `openai_api_key = "env(OPENAI_API_KEY)"` | Entorno local del CLI | Sólo dev |
| Scripts de seed e ingesta INAPI | `.env.local` | Sólo dev |

⚠️ El worker la exige con `_require()`: **sin ella no arranca**. Rotar mal deja
`bralidus-api` caído, no degradado.

**Verificación:** `POST /api-v1/rag/query` debe devolver resultados semánticos.

---

### 3, 4, 5. Webhooks de Discord — **están en 5 lugares distintos**

Es la credencial más dispersa del ecosistema. Un canal usado por tres runtimes
y dos almacenes de CI.

| Consumidor | Canales que lee | Dónde |
|:---|:---|:---|
| `bralidus-api` — `api/ops_alert.py` | `URL`, `LATIDO`, `DEGRADACION` | Vercel (worker) |
| **`mp-sync`** — `src/app/env.ts:175-185` | `URL`, `LATIDO`, `FRESCURA`, `DEGRADACION`, `DEPLOYS`, `NEGOCIO`, `PJUD`, `BCN` — **8** | Vercel (mp-sync) |
| Edge Functions — `_shared/opsAlert.ts` | `URL`, `LATIDO`, `DEGRADACION`, `NEGOCIO` | Secrets de Supabase |
| GitHub Actions raíz — `deploy-functions.yml` | `DISCORD_DEPLOYS_WEBHOOK` | Secrets del repo `startups` |
| GitHub Actions portal — `ci-cd.yml` | `DISCORD_DEPLOYS_WEBHOOK` | Secrets del repo del portal |

⚠️ **El nombre cambia entre CI y runtime**: `DISCORD_DEPLOYS_WEBHOOK` en Actions,
`OPS_WEBHOOK_DEPLOYS` en los servicios. Es el mismo webhook con dos nombres.

⚠️ **`mp-sync` lee 8 canales; el worker sólo 3.** Rotar pensando en "los tres
webhooks" deja cinco canales de `mp-sync` apuntando a webhooks revocados. Y como
`sendOpsAlert` es fire-and-forget, **fallarían en silencio**: el sync seguiría
corriendo y los avisos simplemente dejarían de llegar.

**Verificación:** disparar un job de cada servicio y confirmar que llega el
latido. No basta con que el deploy quede verde.

---

## Resto del inventario

Fuera del alcance de SEC-1, pero mapeado para no repetir la cacería.

### Secretos de GitHub Actions

| Secreto | Repo | Para qué |
|:---|:---|:---|
| `SUPABASE_ACCESS_TOKEN` | `startups` | Desplegar Edge Functions |
| `DISCORD_DEPLOYS_WEBHOOK` | `startups` + portal | Avisos de deploy |
| `SUPABASE_SERVICE_ROLE_KEY` | `validateai` | Cron de UF diaria |
| `MP_SYNC_CRON_SECRET` | portal | Dispara jobs de `mp-sync` |
| `BRALIDUS_CRON_SECRET` | portal | Dispara jobs del worker |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | portal | Deploy del frontend |
| `CLOUDFLARE_API_TOKEN` | PYMENGINE backend **y** frontend | Deploy de Licitus |
| `CRON_SECRET` | S-Pulse | Cron de nexus |

### Variables de servicio

| Variable | Servicio |
|:---|:---|
| `CRON_SECRET` | `bralidus-api` y `mp-sync` (uno distinto cada uno) |
| `MERCADO_PUBLICO_TICKET` / `MP_API_KEY` | `mp-sync`, worker |
| `BRALIDUS_DATABASE_URL`, `LICITUS_DATABASE_URL` | `mp-sync` |
| `FRED_API_KEY` | worker |
| `LICITUS_API_KEY`, `LICITUS_BASE_URL` | worker |
| `SPULSE_BASE_URL`, `SPULSE_INTERNAL_API_KEY` | worker (la URL lleva `/api`) |
| `BDE_USER`, `BDE_PASS` | `market-analyze` (Supabase) |
| `ANTHROPIC_API_KEY`, `AI_PROVIDER` | Edge Functions |
| `SERPAPI_KEY`, `REDDIT_CLIENT_ID/SECRET` | `premium-validate` |
| `FINTOC_SECRET_KEY`, `SII_APIGATEWAY_KEY` | Edge Functions |
| `CMF_KEY` | Vercel — **no la lee nadie. Borrar** |
| `SCRAPERAPI_KEY` | Soportada por 4 extractores, sin configurar y **no debe usarse** |

---

## Procedimiento de rotación

El orden importa: **actualizar todos los destinos ANTES de revocar la vieja.**

1. **Decidir el modelo de claves de Supabase** (sección roja de arriba). Si hay
   que migrar a `sb_secret_...`, eso es un mini-proyecto propio, no un paso.
2. **Contrastar este inventario contra la realidad:**
   ```bash
   vercel env ls production          # en bralidus-api y en mp-sync
   npx supabase secrets list
   gh secret list                    # en cada uno de los 4 repos
   ```
3. **Rotar en el emisor** (Supabase / OpenAI / Discord).
4. **Actualizar todos los destinos**, con las tres trampas presentes:
   - `SUPABASE_SERVICE_KEY` sin `_ROLE` en el script de INAPI.
   - `DISCORD_DEPLOYS_WEBHOOK` vs `OPS_WEBHOOK_DEPLOYS`.
   - Los **8** canales de `mp-sync`, no los 3 del worker.
5. **Redesplegar a mano lo que no toma variables en caliente.**
   `bralidus-api` y `mp-sync` **no tienen integración Git**: `vercel deploy --prod`
   desde cada carpeta. Un `git push` no despliega nada.
6. **Verificar por efecto**, job por job:
   ```sql
   select * from job_health_resumen;        -- worker (Supabase)
   select * from mp_job_health_resumen;     -- mp-sync (Licitus)
   ```
7. **Recién ahí, revocar la anterior.**

---

## Lo que este inventario deja claro

- **41 de los 45 consumidores de la service role no requieren acción** porque
  Supabase la auto-inyecta. El trabajo real es mucho menor de lo que parecía.
- **Los webhooks de Discord son el problema, no la service role.** Están en 5
  almacenes, con dos nombres distintos, y su fallo es silencioso por diseño.
- **La decisión sobre el tipo de clave de Supabase es el verdadero bloqueador**,
  y es una decisión, no una tarea.
