# Bralidus Worker (`validateai-financial-worker`) — CLAUDE.md

FastAPI + APScheduler que alimenta el grafo de conocimiento (`knowledge_nodes`,
`knowledge_edges`) y las señales del radar (`radar_signals`) con datos públicos
chilenos.

**Proyecto Vercel:** `bralidus-api` → https://bralidus-api.vercel.app
**Base de datos:** Supabase `fcdhcntyvsydnvjwopfe` (la misma de Validus/Animus)

---

## 1. Cómo se despliega — LEER ANTES DE TOCAR NADA

**`bralidus-api` NO tiene integración Git.** Todos sus deployments son
`vercel deploy` manuales. Un `git push` **no** despliega nada.

```bash
cd validateai-financial-worker
vercel deploy --prod --yes
```

Lo mismo aplica a `mp-sync` (el servicio de ingesta de Mercado Público, que vive
en `validateai-developer-portal/services/mercado-publico`). El CI del portal
despliega el **frontend**, no ese servicio.

Esto ya causó un incidente: un hook se commiteó, se pusheó, el CI quedó verde y
el código nunca llegó a producción.

## 2. Cómo se disparan los jobs

El worker corre **serverless**: APScheduler no mantiene proceso vivo entre
invocaciones. Los jobs se disparan por HTTP desde GitHub Actions.

```bash
# Desde el repo del portal (tiene el CRON_SECRET guardado)
cd validateai-developer-portal
gh workflow run bralidus-api-cron.yml --ref master -f job=seia_sync
```

Jobs disparables: ver `_JOBS` en `api/jobs.py`. El endpoint es
`POST /jobs/run/{job_id}` con `Authorization: Bearer $CRON_SECRET`.

---

## 3. Estado real de cada extractor (auditado 2026-08-04/05)

Cuatro de seis extractores llevaban meses sin producir **y ninguno reportaba
error**. Esta tabla es el resultado de la auditoría; mantenerla al día.

| Job | Estado | Qué pasa |
|:---|:---|:---|
| `seia_sync` | ✅ **funciona** | Arreglado 2026-08-04. 30 nodos/corrida |
| `concursal_sync` | ✅ **funciona** | Arreglado 2026-08-05. 25 nodos, sólo empresas |
| `radar_refresh` | ✅ funciona | ~185 señales/semana |
| `fred_sync` | ✅ funciona | |
| `cmf_sync` | ⛔ **desactivado** | El recurso no existe en esa API |
| `bcch_sync` | ⛔ **desactivado** | Fuente tras protección anti-bot |
| `empleo_sync` | ⚠️ congelado | Sin producir desde 2026-06-13 |

### Los tres modos de fallo silencioso encontrados

Ninguno lanzaba excepción. Vale la pena conocerlos porque se repiten:

1. **El sitio migró** (SEIA, Concursal). El endpoint viejo responde 302 o 404, el
   cliente sigue el redirect, recibe 200, el parser no encuentra nada y el job
   concluye "0 resultados" como si fuera un dato.
2. **El recurso nunca existió** (CMF). Se escribió el extractor contra un
   endpoint que esa API no sirve. Nunca produjo un nodo en toda su historia.
3. **Protección anti-bot** (BCCh). Incapsula devuelve HTTP 200 con 212 bytes de
   desafío JavaScript. `raise_for_status()` pasa limpio.

### `cmf_sync` — desactivado

El extractor pide `hechos_esenciales` a
`api.cmfchile.cl/api-sbifv3/recursos/svs/api`, que redirige a `api.sbif.cl`
(dominio de la ex-SBIF, fusionada en la CMF en 2019) y muere.

La base correcta es `/api-sbifv3/recursos_api`, **pero esa API sólo sirve `uf`,
`utm`, `dolar` y `euro`** — verificado endpoint por endpoint. Los hechos
esenciales no están ahí y nunca estuvieron.

Los indicadores que sí sirve **ya llegan por otra vía**: `economic_knowledge`
tiene las filas de CMF al día. No hay hueco de datos.

Para revivirlo hay que escribir un scraper del sitio de la CMF, **y ese buscador
tiene captcha**. Requiere autorización del emisor, no código.

### `bcch_sync` — desactivado

Todo `www.bcentral.cl` está tras Incapsula, incluido el RSS.

**La vía oficial existe y ya se usa:** `si3.bcentral.cl/SieteRestWS` (Base de
Datos Estadísticos) responde bien, y `BDE_USER`/`BDE_PASS` ya están en el
ecosistema — `market-analyze` las usa. Sirve **series** (TPM, IPC), no
documentos. El dato numérico está cubierto; lo que se pierde es el texto de
comunicados y minutas, de donde salía la señal hawkish/dovish.

### ⚠️ Sobre `SCRAPERAPI_KEY`

Cuatro extractores tienen soporte de proxy vía esa variable. **No está
configurada, y no debe usarse para sortear Incapsula ni captchas.** Eso es eludir
un control de acceso puesto a propósito por el emisor, no una alternativa técnica
neutra. Animus vende inteligencia regulatoria; hacerlo saltándose al regulador es
un riesgo que no compensa la señal.

### `concursal_sync` — SÓLO EMPRESAS, por diseño

El Boletín Concursal se mudó a `boletinconcursal.cl` con un endpoint DataTables
(`POST /boletin/getRIP/`, requiere sesión + token CSRF; la página es pública, sin
login ni captcha).

**Se filtra `Empresa Deudora` en la extracción.** Medido sobre 100 registros, 70
son personas naturales con nombre y apellido en quiebra personal. El Boletín es
público por ley pero su finalidad es la publicidad legal; ingerirlo a un producto
comercial es otra finalidad, y la Ley 21.719 distingue eso.

El filtro va en la extracción y no aguas abajo para que el dato personal **no
entre a la base ni de paso**. No moverlo.

### Diario Oficial — 403 en todo el dominio

`diariooficial.interior.gob.cl` devuelve 403 incluso en la raíz, desde IP
residencial chilena. Su fallo está contenido y no rompe la extracción concursal.

---

## 4. Monitoreo de fallos silenciosos

### Cómo funciona

```python
from api.health_monitor import job_health
job_health.report("seia_sync", n_results=len(nodes))   # al final de CADA job
```

- El estado vive en la tabla **`job_health`** (Supabase), no en memoria.
- `job_health_report(job_id, results)` acumula y decide si alertar **en una sola
  operación atómica**: umbral de 3 corridas vacías consecutivas, anti-spam de 6 h.
- Al alertar: **Discord (canal `degradacion`)** + fila en `radar_signals`.
- La vista `job_health_resumen` responde "¿qué está muerto?" de un vistazo:
  `NUNCA PRODUJO` / `FALLO SILENCIOSO` / `SIN PRODUCIR HACE MAS DE 7 DIAS` / `ok`.

```sql
select * from job_health_resumen order by dias_sin_producir desc nulls first;
```

### Por qué NO puede volver a memoria

Hasta el 2026-08-04 el contador era un dict del proceso. Funcionó mientras el
worker corría persistente: hay 64 señales `health_monitor:cmf_sync` hasta el
2026-07-13.

El 2026-07-14 el worker se desplegó en Vercel y el 15 se le agregaron triggers
HTTP. Desde entonces cada invocación es un proceso nuevo: el contador vuelve a 0
siempre y el umbral quedó **matemáticamente inalcanzable**. Nadie rompió nada —
una migración de arquitectura invalidó el detector en silencio, y por eso cuatro
extractores llevaron meses muertos sin una alerta.

`JobHealthMonitor` **no tiene `__init__` a propósito**. Si alguien vuelve a
agregar estado de instancia, el detector deja de detectar sin que nada falle.

### El latido no es lo mismo que la salud

El canal `latido` (Cardiólogo en Discord) reporta que un job **terminó**. Por eso
`cmf_sync` se veía verde durante meses produciendo cero. La salud real —si
**sirvió**— va por `degradacion`.

---

## 5. Variables de entorno

Configuradas en el proyecto Vercel `bralidus-api`. Nombres verificados con
`vercel env ls production`.

| Variable | Para qué |
|:---|:---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Base de datos |
| `OPENAI_API_KEY` | Embeddings |
| `CRON_SECRET` | Autoriza `POST /jobs/run/*` |
| `OPS_WEBHOOK_URL`, `OPS_WEBHOOK_LATIDO`, `OPS_WEBHOOK_DEGRADACION` | Discord |
| `FRED_API_KEY` | Series FRED |
| `LICITUS_API_KEY`, `LICITUS_BASE_URL` | Licitus |
| `SPULSE_BASE_URL`, `SPULSE_INTERNAL_API_KEY` | S-Pulse (la URL lleva `/api`) |
| `BDE_USER`, `BDE_PASS` | API oficial del BCCh (en el proyecto de Validus) |

**Ojo con los nombres.** Los extractores de CMF y MP no producían porque
buscaban una variable con un nombre y la doc del propio archivo decía otro.
Ahora aceptan ambos:

- MP: `MP_API_KEY` **o** `MERCADO_PUBLICO_TICKET`
- CMF: `CMF_API_KEY` **o** `CMF_BEST_KEY`

`CMF_KEY` existe en Vercel y **no la lee nadie** — config muerta, conviene
borrarla.

---

## 6. Al agregar un extractor nuevo

1. Llamar `job_health.report(job_id, n)` en **ambos** caminos (éxito y `except`).
   Sin eso el job es invisible para el monitoreo.
2. Preferir endpoints JSON sobre scraping de HTML. Los sitios del Estado chileno
   están migrando a DataTables server-side: buscar `ajax: { url: ... }` en el
   HTML antes de escribir un parser.
3. Ojo con el encoding: varios sirven **latin-1 sin declararlo**. Con la
   inferencia de `requests` los nombres con tilde llegan corruptos.
4. Si el upsert va a `knowledge_nodes`, **deduplicar antes**: la clave es
   `(document_title, header_path)` y dos filas iguales en el mismo batch hacen
   fallar la sentencia entera con *"ON CONFLICT DO UPDATE command cannot affect
   row a second time"*.
5. Verificar el **efecto**, no el status. Un job puede devolver 200, terminar sin
   excepción y no haber traído nada.
