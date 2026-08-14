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
| `fred_sync` | 🟡 probablemente | Último dato CPI jun-2026, que es lo correcto un 05-ago. **Verificado a mano, no por monitoreo** |
| `embeddings_pendientes` | ✅ **funciona** | 0 de 774 nodos sin vector (verificado 2026-08-05) |
| `yfinance_sync` | ❓ sin verificar | Mensual. Sus nodos no llevan fecha en metadata |
| `cache_sweep` | ⚪ **no-op** | Barre un dict en memoria; en serverless siempre está vacío |
| `cmf_sync` | ⛔ **desactivado** | El recurso no existe en esa API |
| `bcch_sync` | ⛔ **desactivado** | Fuente tras protección anti-bot |
| `empleo_sync` | ⛔ **desactivado** | 2026-08-05. Señal mal construida + ceros falsos |

### Cobertura del monitoreo (auditada 2026-08-05 — MON-1)

**8 de los 9 jobs reportan a `job_health`.** Antes de esta auditoría eran 5:
`fred_sync`, `yfinance_sync` y `embeddings_pendientes` eran **invisibles** — no
aparecían en `job_health_resumen` ni podían disparar la alerta de fallo
silencioso.

Peor: `fred_sync` y `yfinance_sync` terminaban en un `except Exception:` que sólo
logueaba. Una corrida caída se veía **idéntica** a una sana: el latido decía
"terminó" y no había otra señal. Hoy ambos reportan `0` en el `except`.

Dos sutilezas que conviene no revertir:

- **`embeddings_pendientes` reporta `1` cuando no hay pendientes.** Ahí el cero
  es el resultado *sano* —todo vectorizado—, y reportarlo como 0 haría que el
  umbral de corridas vacías alertara justo cuando el job funciona perfecto.
- **`cache_sweep` NO reporta, a propósito.** Es un no-op en serverless: un cero
  es lo normal, y alertarlo sería ruido garantizado.

⚠️ **Que un job no esté en `job_health` no significa que esté sano.** La tabla
sólo tiene filas de jobs que corrieron **desde el 2026-08-04**, cuando se arregló
el detector. Un job ausente es un job que no ha corrido, o uno que nunca reportó.

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

**La regla es la misma para fuentes privadas** (decidido 2026-08-05, a raíz de
`empleo_sync` y Computrabajo). Cambia la naturaleza del riesgo —contractual en
vez de reputacional— pero el bloqueo es igual de deliberado. Si una fuente pone
un muro, la vía es pedir acceso, no rodearlo.

El soporte de proxy en los cuatro extractores queda marcado para borrarse: una
variable que existe y no debe usarse es una invitación a usarla.

### `empleo_sync` — DESACTIVADO el 2026-08-05, nodos borrados

**No estaba congelado desde junio.** Corrió el **2026-08-01**, cuatro días antes
de retirarlo. La creencia contraria venía de mirar `updated_at`, que en estos
nodos es inútil (ver más abajo).

Se retiró por dos motivos, y el segundo pesa más:

1. Raspa Computrabajo, que resiste el scraping — el propio docstring "recomienda"
   ScraperAPI. Choca con la regla de arriba.
2. **La señal estaba mal construida desde el origen.** Contaba coincidencias de
   un *buscador de texto* (`"minería cobre litio"`) y llamaba a eso "ofertas del
   sector minería". Eso mide cómo se redactan los avisos, no cuánta gente se
   contrata. Aunque el scraping funcionara perfecto, el número no significaba lo
   que decía significar.

**No fallaba en silencio: fallaba MINTIENDO.** `_count_listings` devuelve `0`
cuando el regex del contador no matchea, y `fetch_all_as_nodes` sólo saltea
cuando el valor es `< 0`. O sea que el cero se ingería como dato. La corrida del
2026-08-01 dejó **"Minería: 0 ofertas activas"** y **"Finanzas: 0"** en el grafo,
citables por el RAG como hechos.

**Desactivarlo no alcanzaba: había que borrar los nodos.** Tienen
`"permanent": False` porque se sobreescriben semanalmente, así que al morir el
job **no se borran** — se quedan con el último valor y sin `expires_at`. Los 8 se
borraron el 2026-08-05; ninguna arista los referenciaba.

Sus `radar_signals` sí expiraron solas (168 h). **Esa asimetría entre
`radar_signals` y `knowledge_nodes` aplica a todo extractor que se desactive:**
las señales se mueren, los nodos no.

### ⚠️ Regla de honestidad del contexto (`api/rag.py`)

Lo que `assemble_context` devuelve **entra directo al prompt de un LLM que corre
en el consumidor** (Validus, el MCP). Todo lo que se escriba ahí, el modelo lo
trata como hecho y se lo repite al usuario.

Tres reglas que salieron de encontrar una alucinación propia:

1. **No afirmar nada que no se haya verificado.** Hasta el 2026-08-05, todo nodo
   sin `ultimo_valor` entraba con `_Datos en proceso de actualización._`. Es
   falso: leyes, metodología y jurisprudencia no tienen valor numérico y no hay
   actualización en curso. **La ausencia de una afirmación es más honesta que una
   afirmación sobre la ausencia** — hoy un nodo sin serie no lleva línea de valor.
2. **El contexto vacío se declara como INSTRUCCIÓN, no como nota al pie.** Un
   modelo que sólo lee "no se encontraron nodos" responde igual desde su
   conocimiento paramétrico, y el usuario cree que salió del grafo.
3. **Una arista huérfana no es un hueco visible.** `search_hybrid_graphrag` trae
   vecinos con INNER JOIN, así que una arista hacia un nodo inexistente aporta
   cero filas **sin decirlo**. El grafo promete contexto que el join descarta, y
   el modelo llena el hueco. Ver la nota de aristas en el CLAUDE.md del portal.

### Integridad del grafo — tres triggers (migración 20260805000002)

`knowledge_edges` sigue enlazando por título, pero desde el 2026-08-05 la base
impone semántica de foreign key:

| Trigger | Qué hace |
|:---|:---|
| `trg_knowledge_edges_extremos` | Rechaza toda arista cuyos extremos no existan (`23503`) |
| `trg_knowledge_nodes_renombre` | Renombrar el **último** chunk de un título propaga el nuevo a sus aristas |
| `trg_knowledge_nodes_borrado` | Borrar el **último** chunk de un título borra sus aristas, en cascada |

**El tercero es destructivo por diseño.** Borrar un documento ahora se lleva sus
relaciones sin preguntar. Es lo correcto —una arista sin extremo no sirve y el
INNER JOIN ya la descartaba— pero conviene saberlo antes de borrar nodos a mano.

⚠️ **Un `document_title` es un DOCUMENTO, no una fila.** Los nodos vienen
troceados por sección: mismo `document_title`, distinta `header_path`. Al
2026-08-05 son 774 filas en 212 títulos, y **56 títulos multi-chunk concentran
354 de las 477 aristas**.

La versión original de las piezas 2 y 3 (aplicada y corregida el mismo día,
migración `20260805000003`) ignoraba eso y cascadeaba por título sin mirar los
hermanos: **borrar un chunk se llevaba las aristas de los otros 28**. Medido:
la limpieza de nodos vacíos que venía a continuación habría destruido 149
aristas. No explotó sólo porque no se borró ningún nodo en el medio.

Hoy la referencia se considera satisfecha mientras exista **al menos un** chunk
con ese título — que es la semántica de una FK contra una clave no única. Los
triggers son `AFTER … FOR EACH ROW`, y Postgres los encola hasta el final de la
sentencia: borrar los 29 chunks de una vez cascadea igual que hacerlo uno a uno.

Regresión permanente en `validateai/supabase/tests/knowledge_graph_cascada.sql`
(8 casos contra la base real, con rollback). Sus casos 1, 5 y 7 fallan contra
los triggers viejos: eso es lo que los hace valer.

**Lección, porque el error fue nuestro:** se escribió y probó el trigger con
nodos de una fila por título. Las 6 pruebas pasaron porque cubrían el caso
imaginado, no el que había en la base. Un test que sólo cubre el caso que
supusiste no dice nada del que no.

**Insertar una arista mala ahora REVIENTA.** Ese es el punto: era un fallo
silencioso y pasó a ser un error. Los cinco insertadores vivos se relevaron
antes de aplicarlo y ninguno viola la restricción — pero un job nuevo mal
escrito va a fallar en producción en vez de corromper el grafo callado.

Verificado contra la base: 6 de 6 pruebas (rechaza source y target inexistentes,
acepta válidas, el renombre propaga sin dejar huérfanas, el borrado cascadea).

### ⚠️ `updated_at` NO sirve para medir frescura

`bulk_insert_nodes` (`src/db/supabase_client.py`) upsertea sólo las claves del
dict del nodo, y `updated_at` no es una de ellas. **En un upsert que actualiza
una fila existente, `updated_at` conserva el valor del INSERT original — para
siempre.**

Por eso los nodos de empleo mostraban `updated_at = 2026-06-13` (su creación)
junto a `metadata.fecha = 2026-08-01` (su última corrida real). Mirar esa columna
llevó a creer que el job estaba muerto hacía dos meses cuando había corrido
cuatro días antes.

Distingue dos casos:

- **Categorías que crean nodos nuevos** (SEIA, Concursal): cada corrida inserta
  filas, así que `max(updated_at)` sí refleja la última corrida.
- **Categorías que sobreescriben un nodo fijo** (cualquier "snapshot"):
  `updated_at` queda clavado en la fecha de creación.

**Consecuencia abierta:** `api/data_freshness.py` mide con `max(updated_at)` por
categoría. Para las del segundo tipo reporta una antigüedad falsa. Hay que usar
`metadata->>'fecha'` cuando exista, o agregar `updated_at` al dict del nodo.

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

### `mp_attachments_downloader.py` — BORRADO el 2026-08-13

Prometía descargar los adjuntos de una licitación (bases, EETT, anexos) y dejar
un `manifest.json` con checksums para "ingesta directa en el Vector Vault / RAG".
**Sus dos vías reales estaban muertas y la tercera fabricaba los archivos.**

- `fetch_attachments_via_api` buscaba una clave `Adjuntos` que la API v1 **no
  tiene** (verificado el 2026-08-13: el detalle trae 52 campos y ninguno es de
  adjuntos), con `Items` —que son los productos pedidos— como alternativa.
- `fetch_attachments_via_web` raspaba `Details.aspx` / `FichaLicitacion.html`
  buscando `<a href>` a PDFs. Hoy esas páginas no sirven enlaces así.
- Al no encontrar nada, **inventaba dos adjuntos**:
  `Bases_Administrativas_y_Tecnicas_<codigo>.pdf` y
  `Anexo_1_Formulario_Oferta_<codigo>.pdf`, ambos apuntando a la **página HTML**
  del proceso. Y si la descarga fallaba, escribía un *stub* de texto con ese
  mismo nombre `.pdf`, le calculaba un SHA-256 y lo anotaba en el manifest con
  `"note": "Documento referenciado de Mercado Público"`.

Como ninguna vía real producía, el fallback inventor era **el único camino que se
ejecutaba**. El resultado era un manifest que declaraba N archivos con checksum
donde cada uno era una página HTML o un stub — con el nombre de un documento
legal que nadie había leído.

Es el modo de fallo de `empleo_sync` llevado un paso más allá: no reportaba cero,
**reportaba documentos**. Un checksum no vuelve verdadero a un archivo inventado;
sólo lo hace parecer auditado.

Se salvó por un detalle: era un CLI suelto (`__main__` propio), no lo importaba
ningún job, y nada de eso llegó al grafo por vía automática.

**No hay ruta autorizada a los adjuntos hoy** — las cuatro vías están medidas en
`validateai/docs/SOLICITUD_CHILECOMPRA_ADJUNTOS.md`, junto con la solicitud
formal a ChileCompra. Quien vuelva a escribir esto: la ausencia de un adjunto se
declara, no se rellena.

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
