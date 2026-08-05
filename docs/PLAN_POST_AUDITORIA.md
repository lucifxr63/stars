# Plan post-auditoría — rumbo a partir del 2026-08-05

Continuación de la auditoría del 4–5 de agosto (commits `bf0deca`..`8e53a1d`). La
auditoría dejó cuatro extractores arreglados o desactivados, un detector de
fallos silenciosos que vuelve a funcionar, y cuatro CLAUDE.md que describen el
sistema real. Este documento define qué sigue.

---

## Norte

**Verificar el efecto, no el status.** Todo lo que sigue se ordena por una sola
pregunta: *¿qué parte del sistema todavía puede estar produciendo cero sin que
nadie se entere?*

La auditoría encontró tres modos de fallo silencioso (sitio migrado, recurso
inexistente, protección anti-bot) y un cuarto que es peor porque es nuestro: **el
código que trata "cero resultados" como un resultado válido**. Aparece al menos
en tres lugares distintos del ecosistema. Cerrar esa clase de defecto es la
columna vertebral del plan.

---

## Fases

| Fase | Qué cierra | Criterio de salida |
|:---|:---|:---|
| **0. Seguridad** | Credenciales expuestas sin rotar | Las cuatro credenciales rotadas y verificadas en prod |
| **1. Silencios abiertos** | `sync-compra-agil` y `empleo_sync` | Ambos producen dato verificado, o quedan desactivados con motivo escrito |
| **2. Cobertura del monitoreo** | Lo que el detector todavía no ve | Ningún job de ingesta puede producir cero sin alertar |
| **3. Trampas estructurales** | Deploy sin Git, config muerta | `git push` despliega todo, o falla ruidosamente |
| **4. Decisiones, no código** | PJUD, CMF, BCCh | Cada una con resolución escrita y fecha |

Las fases 0 y 1 son secuenciales. La 2 depende de lo que se aprenda en la 1. Las
3 y 4 corren en paralelo.

---

# FASE 0 — Seguridad

> Lleva abierta toda la sesión anterior y es lo único con riesgo real.

### SEC-1 · Rotar OpenAI, service role y webhooks de Discord

**Contexto.** Cuatro credenciales quedaron marcadas para rotar y siguen vivas:
`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, y los tres webhooks de Discord
(`OPS_WEBHOOK_URL`, `OPS_WEBHOOK_LATIDO`, `OPS_WEBHOOK_DEGRADACION`).

La service role es la de mayor impacto: **salta RLS por diseño** y es la misma
base que usan Validus, Animus, Bralidus y el vault. No hay `.env` trackeado en
git (verificado: sólo `.env.example`), así que la exposición es de sesión, no de
repositorio — pero rotar sigue siendo lo correcto y es barato.

**Orden importa.** La service role está en más de un proyecto Vercel. Rotarla sin
inventariar antes deja servicios caídos:

1. Inventariar dónde vive cada una:
   ```bash
   for p in bralidus-api mp-sync validateai bralidus; do
     echo "== $p"; vercel env ls production --scope <team> 2>/dev/null
   done
   ```
   Más los secrets de GitHub Actions del portal y de `startups`, y los de
   Cloudflare (Licitus, nexus).
2. Rotar en el emisor (Supabase → API settings; OpenAI → dashboard; Discord →
   regenerar webhook por canal).
3. Actualizar **todos** los destinos antes de revocar la vieja.
4. Revocar la anterior.
5. Redesplegar lo que no toma variables en caliente — **`bralidus-api` y
   `mp-sync` no tienen integración Git: hay que `vercel deploy --prod` a mano.**

**Criterio de aceptación**
- [ ] Las cuatro credenciales nuevas están activas y las viejas revocadas.
- [ ] `POST /jobs/run/fred_sync` responde 200 y produce nodos → la service role nueva funciona en el worker.
- [ ] Un job cualquiera manda latido a Discord → los webhooks nuevos funcionan.
- [ ] `POST /api-v1/rag/query` devuelve resultados → los embeddings funcionan con la key nueva.
- [ ] Existe un inventario escrito de dónde vive cada credencial (`docs/INVENTARIO_SECRETOS.md`), sin valores.

**Verificación.** No basta con que el deploy quede verde. Cada checkbox de arriba
es un efecto observable.

**Esfuerzo.** 1–2 h, la mayor parte inventario.

---

# FASE 1 — Los dos silencios que quedaron abiertos

### ING-1 · `sync-compra-agil` con cero resultados — ✅ RESUELTO 2026-08-05

**Ver la sección "Resultado de ING-1" más abajo: la hipótesis de este ticket era
parcialmente incorrecta y el diagnóstico real fue otro.** Se conserva el texto
original porque documenta la escalera que llevó al hallazgo.

<details>
<summary>Hipótesis original (parcialmente errada)</summary>

**Prioridad: la más alta después de SEC-1.** No es sólo un extractor caído:
bloquea `mp_extraer_ofertas()`, y con eso `/mercado-publico/ofertas` y
`/precios` — las dos features que se construyeron el 5 de agosto.

**Lo que ya está confirmado por lectura del código:**

En [run-status.ts:52](../validateai-developer-portal/services/mercado-publico/src/modules/sync/domain/run-status.ts#L52):

```ts
if (attempted === 0) return 'success'; // no había nada que hacer
```

Una corrida que no encontró nada es indistinguible de una que no tenía nada que
hacer. Por eso "falla con 0 encontradas" no aparece como fallo en ningún panel.
El comentario es razonable para un backfill de un día feriado, y es exactamente
lo que ocultó tres días de ingesta detenida antes.

El bucle de [sync-compra-agil.job.ts:554](../validateai-developer-portal/services/mercado-publico/src/jobs/sync-compra-agil.job.ts#L554)
corta al primer `found === 0`, así que **los 27 minutos no se explican por el
código de este job**. O el tiempo lo consumen los reintentos del `HttpClient` (3
intentos con backoff de 2 s creciente, timeout de 60 s por request → hasta ~3
min por página), o el camino que corre es el Workflow de Cloudflare con sus
propios reintentos por step. Eso hay que medirlo, no suponerlo.

**Escalera de diagnóstico** — de la capa más externa a la más interna, sin
tocar código hasta el paso 4:

1. **La API, cruda.** Un `curl` a `api2.mercadopublico.cl/v2/compra-agil` con el
   ticket de producción y una ventana de cambios de 24 h. Mirar
   `paginacion.total_resultados` y el `success` del envelope.
   → Si devuelve 0: el problema es de fuente o de credencial, no nuestro.
   → Si devuelve N > 0: el problema está entre la API y el job.
2. **El ticket.** `unwrap()` traduce `401/403` a un error explícito, pero un
   ticket válido con permisos recortados puede devolver `success: OK` y una
   lista vacía. Comparar el ticket que usa `mp-sync` contra el que usa la API v1
   (que sí funciona: 38.305 filas frescas).
3. **La ventana.** `buildIncrementalWindow` vs `buildDateWindow`. Si el cron
   corre sin `incrementalHours`, cae al modo por fecha de publicación, que
   intersecta dos ventanas y puede vaciar el resultado. Verificar qué modo usa
   el disparador real (el Workflow, no `runSyncCompraAgilJob` — ese lo llaman
   sólo los scripts de backfill).
4. **Los estados.** `estados` vacío = todos. Si el cron pasa `['Publicada']` y
   la API renombró el estado, el filtro devuelve 0 sin error.

</details>

---

## Resultado de ING-1 — lo que realmente pasaba

**Corrección al diagnóstico inicial.** Este plan afirmaba que la corrida de 27
minutos quedaba enmascarada como `success` por `run-status.ts:52`. Es falso: esa
corrida se registró como **`failed`**, correctamente. El defecto de
`attempted === 0 → 'success'` es real y sí disparó en producción, pero en otra
corrida (2026-08-01 09:50, `found = 0`, 6 segundos, en verde). Son dos problemas
distintos y se arreglaron los dos.

### Lo que la escalera descartó

| Paso | Resultado |
|:---|:---|
| 1. API cruda | ✅ sana — 10.000 en modo cambios, 4.429 por fecha |
| 2. Ticket | ✅ válido, acepta ambos modos |
| 3. Ventana | ✅ las dos formas devuelven datos |
| 4. Estados | ✅ el cron no filtra por estado |

**Nada de lo que el ticket sospechaba estaba roto.**

### Hallazgo 1 — el fallo era indiagnosticable por diseño

Las **13 corridas fallidas** de `sync-compra-agil` tienen `error_details = []`.
Todas. El mensaje de la excepción se escribía a stdout de una invocación
serverless que nadie lee tres días después, y `completeCompraAgilDate` nunca le
pasaba `errorCodes` ni `errorDetails` al repositorio.

Lo que lo confirma: **`sync-licitaciones` sí lo guarda, en 31 de 38 fallos.** La
capacidad existía, el repositorio incluso manda el primer error a Discord al
marcar `failed`. En este job el cableado nunca se hizo.

Las dos corridas largas duraron **1641 y 1643 segundos** — 27,35 y 27,38 min.
Idénticas. Eso no es una falla variable: es una escalera de timeouts
determinista, quemando reintentos contra algo que no iba a responder, y
terminando sin dejar una sola pista.

### Hallazgo 2 — la API tiene un techo de 10.000 y no lo dice

Medido el mismo instante, mismo ticket:

| Ventana de cambios | `total_resultados` | Páginas |
|---:|---:|---:|
| 3 h | 0 | 0 |
| 6 h | 18 | 1 |
| 26 h | **10.000** | 200 |
| 72 h | **10.000** | 200 |

Una ventana tres veces más ancha devuelve el mismo número: es un tope, no un
conteo. Y la **página 201 responde `success: OK` con cero items** — no un 400, no
un error.

**Esto casi se convierte en pérdida de datos silenciosa.** El modo incremental de
26 h estaba escrito, documentado en 40 líneas como "estrictamente mejor para el
cron diario"… y era código muerto: `COMPRA_AGIL_INCREMENTAL_HOURS` no la lee
nadie y `incrementalHours` no lo pasa ningún caller. Activarlo tal cual —que era
el plan de ING-1b— habría hecho que el job ingiriera 10.000 de un universo mayor,
cortara en `offset >= found` con un `found` falso, y **reportara éxito**.

### Hallazgo 3 — retrabajo por triplicado

El cron manda `BODY='{}'`, así que `skipAlreadySynced` nunca se activa y
`lookback = 2` re-sincroniza 3 fechas cada noche. Cada fecha se sincronizó entre
2 y 4 veces: `2026-07-29` cuatro veces, 8.233 filas para una fecha con 3.822
procesos. El upsert es idempotente así que el dato está bien — lo que se quema es
cuota y tiempo.

### Lo que se cambió

| Archivo | Qué |
|:---|:---|
| `sync-compra-agil.job.ts` | `errorCodes`/`errorDetails` viajan al `sync_log`; detección del techo (`capReached`) que fuerza `partial` y avisa; fallos por proceso acumulados (tope 50) |
| `sync-compra-agil.workflow.ts` | El `catch` guarda el mensaje además de loguearlo — es el camino que corre en prod |
| `run-status.ts` | Estado `empty`: una corrida vacía deja de ser exitosa |
| `sync-log.repository.ts` | Alerta por racha de 3 vacías, evaluada en la base |
| `job-health.ts` | `sync-compra-agil` y 3 jobs más entran al semáforo — no estaban |
| `026_sync_logs_empty_status.sql` | `CHECK` + vista `mp_job_health_resumen` |

**Estado:** ✅ typecheck 0 · ✅ 9/9 tests · ✅ build · ✅ migración aplicada y
verificada contra la base real (racha 1→2→3 dispara `FALLO SILENCIOSO`, se
resetea al producir).

**Pendiente manual:** `vercel deploy --prod` desde `services/mercado-publico`.
La CLI de Vercel no está instalada y el servicio **no tiene integración Git**.

### Lo que queda abierto de ING-1

- [x] **Partir la ventana en tramos bajo el techo** — ver ING-5.
- [ ] Confirmar qué excepción producía los 27 min. Ahora que el error se guarda, el próximo fallo lo dirá solo.

**Esfuerzo consumido.** ~3 h.

---

### ING-5 · Troceado de ventana — ✅ IMPLEMENTADO 2026-08-05

El arreglo real del retrabajo, y lo que permite activar el modo incremental sin
truncar.

#### El problema que resuelve

Una ventana grande pedida de una sola vez topa en 10.000 y la API no avisa. Con
el bucle cortando en `offset >= found`, una ventana con 14.000 procesos ingiere
10.000 y reporta éxito.

```
Antes:     [ ————————— 26 h ————————— ]   → topa en 10.000, el resto no existe
Troceado:  [3h][3h][1.5h][45m][45m][3h][6h]  → cada tramo bajo el techo
```

#### Por qué el tramo no puede ser de tamaño fijo

La actividad se concentra en horario hábil chileno. Medido a las 02:20 de Chile:
6 h → **18** resultados. La misma ventana de 6 h a media mañana topa. Cualquier
tamaño fijo es demasiado chico de madrugada (decenas de consultas para nada) o
demasiado grande de día (trunca).

Por eso el troceado es **adaptativo**: búsqueda binaria sobre el tiempo. Se
pregunta cuántos hay en un tramo; si llegó al techo, se parte al medio y se
repite. Un tramo que vuelve por debajo del techo es confiable.

#### Decisiones que conviene no revertir

| Decisión | Por qué |
|:---|:---|
| Los tramos **comparten** el instante de corte | Si la API trata ambos extremos como inclusivos, un proceso se ingiere dos veces — y el upsert es idempotente. Restar un milisegundo abre un hueco por el que ese proceso no entra **nunca**. Ante la duda, repetir antes que perder |
| Piso de 15 min | Topar el techo en 15 min exige ~11 cambios/segundo sostenidos. Si pasa, es un problema de la fuente y hay que verlo, no seguir partiendo |
| Lo que no baja del techo se marca `truncado` y **alerta** | Es el escenario que este mecanismo existe para no tragarse |
| Presupuesto de 60 sondeos | Cada sondeo gasta cuota diaria |
| Los tramos vacíos se descartan | Sin eso, una corrida de madrugada pagina decenas de veces sobre nada |
| `buildIncrementalWindow` **se eliminó** | Quedó inalcanzable. Un camino que ya no se recorre es lo que este servicio viene pagando caro |

#### El hallazgo del camino

Al probar contra la API real apareció la cuota agotada — y **el script de sondeo
la tragó como un cero**, porque leía `payload?.paginacion?.total_resultados ?? 0`
sobre una respuesta `success: NOK` con código 429.

Si esa lectura estuviera en producción, la ventana entera se daría por vacía, el
sync no ingeriría nada y cerraría en verde. Es exactamente el fallo silencioso
que todo este trabajo persigue, apareciendo en la herramienta hecha para
combatirlo.

El código de producción está a salvo porque `compraAgilClient.list` **lanza**
ante `NOK`. Eso ahora está protegido por dos tests (`un sondeo que falla PROPAGA
— jamás se convierte en cero`) y por una nota en `planificarTramos`: que la sonda
lance es lo único que separa *"no hay nada"* de *"no pudimos preguntar"*.

De paso se agregó el manejo de cuota agotada **al planificar**: antes la
excepción habría reventado el step de planificación y marcado la corrida como
error, cuando no hay nada roto — se acabó la cuota del día. Ahora cierra limpio,
igual que los slices.

#### Verificación

**21 tests en verde**, incluidos los casos que contra la API real no se pueden
provocar a voluntad: sin huecos entre tramos, orden cronológico, actividad
concentrada, fuente patológica que siempre devuelve el techo, presupuesto de
sondeos agotado, y sonda que falla.

**Falta la corrida real de punta a punta.** La cuota diaria de la API estaba
agotada al momento de probar (se restablece al cambiar el día calendario), así
que el troceado está verificado contra distribuciones sintéticas pero **no
todavía contra Mercado Público**. Es lo primero que hay que mirar tras el
deploy.

---

### ING-2 · `sync-compra-agil` no puede volver a reportar `success` con cero

Arreglo estructural del defecto que ING-1 destapa. **Separado a propósito**: hay
que arreglarlo aunque ING-1 resulte ser un problema de la fuente.

`deriveRunStatus` necesita distinguir dos casos que hoy colapsa en uno:

- *No había nada que hacer* — la ventana estaba vacía y sabemos que estaba vacía
  (`total_resultados === 0` **y** es un rango donde eso es esperable).
- *No encontramos nada* — pedimos y volvimos con las manos vacías.

La forma más honesta es no inferirlo del contador: pasar `found` explícito a
`deriveRunStatus` y devolver un estado nuevo — `empty` — que el panel y el canal
de ops muestren distinto de `success`.

**Criterio de aceptación**
- [ ] `deriveRunStatus({succeeded:0, failed:0, found:0})` **no** devuelve `success`.
- [ ] Un test cubre el caso: corrida sin resultados ≠ corrida exitosa.
- [ ] Tres corridas consecutivas vacías del mismo job alertan al canal `degradacion`, igual que hace `job_health` en el worker.
- [ ] Los otros cuatro jobs que usan `deriveRunStatus` siguen pasando sus tests (el umbral del 5% de ruido upstream no se toca).

**Depende de.** Nada, pero conviene hacerlo *después* de ING-1 para que el
arreglo se valide contra un caso real.
**Esfuerzo.** 2 h.

---

### ING-3 · `empleo_sync` — ✅ EJECUTADO 2026-08-05

**Corrección de hecho: NO estaba congelado desde junio. Corrió el 2026-08-01.**

Este plan (y el CLAUDE.md del worker) decían "sin producir desde 2026-06-13".
Era falso, y el error tiene una causa que vale más que el dato: se miró
`updated_at`, y **`bulk_insert_nodes` nunca escribe esa columna**. En un upsert
que actualiza una fila existente, `updated_at` conserva el valor del INSERT
original para siempre. Los nodos mostraban `updated_at = 2026-06-13` (creación)
junto a `metadata.fecha = 2026-08-01` (última corrida real).

Lo corrobora `prev_count: 29` en un nodo con `count: 27` — ese campo se lee del
nodo existente, así que hubo varias corridas.

**Consecuencia abierta:** `api/data_freshness.py` mide frescura con
`max(updated_at)` por categoría. Para toda categoría de tipo "snapshot" que
sobreescribe un nodo fijo, eso reporta una antigüedad falsa. Es un medidor de
frescura que no puede medir frescura.

**Y no fallaba en silencio: fallaba mintiendo.** `_count_listings` devuelve `0`
cuando el regex no matchea y `fetch_all_as_nodes` sólo saltea con `< 0`, así que
el cero se ingería como dato. La corrida del 2026-08-01 dejó **"Minería: 0
ofertas activas"** y **"Finanzas: 0"** en el grafo, citables por el RAG.

#### Ejecutado

- [x] Sale de `_JOBS` (`api/jobs.py`) y del scheduler, con el motivo escrito.
- [x] **Los 8 nodos `Señal Empleo` borrados** de `knowledge_nodes` — respaldados antes; 0 aristas los referenciaban.
- [x] Verificado: 0 nodos en la categoría; el único con tag `empleo` que queda es "Desempleo USA" de FRED, que es otra cosa.
- [x] CLAUDE.md del worker corregido.

<details>
<summary>Análisis original</summary>

**Decisión tomada: se borra, sin reemplazo 1:1.**

**Lectura del código — hipótesis fuerte, no confirmada.**
[empleo_extractor.py](../validateai-financial-worker/src/extractors/empleo_extractor.py)
raspa HTML de Computrabajo y cuenta con un regex:

```python
m = re.search(r"([\d.,]+)\s*(?:empleos|ofertas|resultados)", html, re.IGNORECASE)
if m: ...
return 0          # ← no encontró el contador: devuelve 0, no error
```

Y aguas arriba, en `fetch_all_as_nodes`:

```python
if count < 0:
    continue      # ← "fuente no disponible, skip silencioso"
```

Hay **dos** salidas silenciosas encadenadas. El `except` devuelve `-1` y el
caller lo saltea; y si la petición sale bien pero el HTML cambió, el regex no
matchea y devuelve `0` — que se ingiere como si Computrabajo tuviera cero
ofertas de minería. La segunda es peor: no es ausencia de dato, es dato falso.

Además el docstring dice *"Proxy rotation vía ScraperAPI recomendado para esta
fuente"* — o sea, se escribió sabiendo que la fuente resiste el scraping. Esa
recomendación choca de frente con la decisión ya tomada sobre `SCRAPERAPI_KEY`.

**Pero el motivo de fondo es anterior al scraping.** La señal estaba mal
construida desde el origen: contaba coincidencias de un **buscador de texto**
(`"minería cobre litio"`, `"desarrollador software tecnología"`) y llamaba a eso
"ofertas del sector minería". Eso mide cómo se redactan los avisos, no cuánta
gente se contrata. Aunque el scraping funcionara perfecto, el número no
significaba lo que decía significar.

Se borra por eso, no sólo por la política de fuentes.

**Criterio de aceptación**
- [ ] Sale de `_JOBS` en `api/jobs.py`, como `cmf_sync` y `bcch_sync`.
- [ ] La tabla de extractores del CLAUDE.md del worker dice por qué.
- [ ] **Los ocho nodos `Empleo — X — Snapshot` se borran de `knowledge_nodes`.**
- [ ] Una consulta al RAG sobre empleo sectorial ya no devuelve conteos de junio.

**El tercer punto es el que importa y no es obvio.** Los nodos tienen
`"permanent": False` porque se sobreescriben semanalmente — si el job muere, el
nodo **no se borra**: se queda con el último valor bueno, sin `expires_at`, y el
RAG lo cita hoy como si fuera de esta semana. El job lleva dos meses congelado y
ese dato sigue vivo.

```sql
-- Antes de borrar, ver qué está citando el RAG:
select document_title, metadata->>'fecha', metadata->>'count'
from knowledge_nodes where category = 'Señal Empleo';
```

Contraste útil: las `radar_signals` que producía el mismo extractor **sí** tienen
`expires_at` (168 h) y ya murieron solas. La diferencia entre las dos tablas es
exactamente por qué una necesita limpieza manual y la otra no.

**Depende de.** Nada. Decidido.
**Esfuerzo.** 1 h.

</details>

---

### ING-4 · La señal sectorial, rehecha sobre dato propio

**No es el reemplazo de `empleo_sync`: es una feature con diseño propio.** Se
separa a propósito para que no herede la premisa del extractor que se borra.

La pregunta que `empleo_sync` decía responder — *¿este sector se expande o se
contrae?* — sigue siendo buena. Lo que estaba mal era la fuente.

**Dos caminos, no excluyentes:**

**(B) Fuente oficial — barato, y el enchufe ya está puesto.**
`market-analyze` ya tiene credenciales BDE del Banco Central funcionando **y ya
integra INE** (`rapps.ine.cl:9292`). Y en
[market-analyze/index.ts:13](../validateai/supabase/functions/market-analyze/index.ts#L13)
hay un placeholder vacío esperando justamente esto:

```ts
const SECTOR_SERIES: Record<string, { id: string; label: string }[]> = {}
// "pendiente de validación"
```

La ENE del INE da ocupados por rama de actividad económica. Verificar el catálogo
cuesta un comando: `function=SearchSeries&frequency=MONTHLY&searchParam=ocupados`.
**Límite honesto:** mensual con ~45 días de rezago. No es un indicador adelantado
y no debe presentarse como tal — ese fue el error original.

**(C) Dato propio — diferenciado.**
38.305 filas frescas a diario en `licitaciones_mercado_publico`, con UNSPSC,
montos, y desde el 2026-08-05 competencia y dispersión de precios. Volumen de
compra pública por sector, oferentes por proceso y tasa de adjudicación **sí**
son adelantados, y nadie más los tiene normalizados así.

**Recomendación: C.** B se puede sumar después como contraste macro.

**Criterio de aceptación**
- [ ] La señal declara su rezago y su fuente en el propio nodo. Un dato mensual nunca se presenta como semanal.
- [ ] Se valida contra un período conocido antes de publicarla (¿marcó la contracción de un sector que efectivamente se contrajo?).
- [ ] Si no se puede validar, no se publica. Una señal sectorial que nadie verificó es lo que acabamos de borrar.

**Depende de.** ING-1 (la ingesta de compra ágil tiene que estar viva).
**Esfuerzo.** Diseño primero; no estimable hasta tener el criterio de validación.

---

# FASE 2 — Que el monitoreo cubra lo que todavía no ve

El detector de `job_health` sólo mira el worker de Bralidus. **`mp-sync` es otro
servicio, en otro repo, con otro runtime, y no está bajo ese detector** — que es
precisamente donde apareció el silencio de ING-1.

### MON-4 · `refresh-opportunities` nunca terminaba — ✅ RESUELTO 2026-08-05

Lo encontró `mp_job_health_resumen` en su primera consulta, minutos después de
crearla. Corre cada 6 h y llevaba **6,8 días sin producir**.

**27 corridas fallidas seguidas desde el 2026-07-30, todas con `total_found = 0`,
`total_processed = 0` y `error_details = []`.** Duraciones de 5 a 8 horas con un
cron que dispara cada 6.

#### El job no fallaba: nunca terminaba

`refresh-opportunities` **sí** captura errores (`errorDetails: [{ fatal: error }]`
en su `catch`). Que las 27 filas tuvieran `[]` significa que `complete()` nunca
se llamó — ni por éxito ni por excepción.

Quien las marcó `failed` fue `clearStaleRunning`, que barre las 'running' de más
de 2 h y deja `metadata.stale_cleared = true`. **31 de las 42 fallas históricas
del job tienen esa marca.** El proceso moría por presupuesto de función; la
corrida siguiente encontraba la fila huérfana y la marcaba fallida.

Y las "duraciones" de 5–8 horas no eran tiempo de ejecución: eran el tiempo que
la huérfana pasó ahí tirada hasta que alguien la barrió.

#### Por qué moría — medido contra producción

La API v1 de Mercado Público rechaza el endpoint de **detalle** con
`HTTP 429 · Codigo 10500` *"Hemos detectado que existen peticiones simultáneas"*.
Secuencial, sobre `3960-50-L126`, el 2026-08-05:

| Espera entre requests | Éxito |
|---:|---:|
| 200 ms — **lo que usaba el job** | 50% (3 de 6) |
| 600 ms | 87% |
| 1000 ms | 75% |
| 1500 ms | 100% (8 de 8) |

Con 200 ms, la mitad rebota; el cliente reintenta 3 veces con backoff de 5 s, y
150 candidatos así no entran en ningún presupuesto.

**Lo más caro del hallazgo: esto ya estaba diagnosticado.** El 2026-07-29 se midió
exactamente lo mismo para `enrich-ordenes`, se documentó en 15 líneas y se
arregló con `ENRICH_DELAY_MS = 2500`. `refresh-opportunities` golpea el mismo tipo
de endpoint y se quedó con los 200 ms. El conocimiento estaba escrito; no se
aplicó donde también hacía falta.

#### Lo que se cambió

| Qué | Por qué |
|:---|:---|
| `REFRESH_DELAY_MS = 2500` | Mismo valor ya establecido para el mismo endpoint. Se elige el conservador entre dos mediciones que coinciden en la dirección |
| `REFRESH_TIME_BUDGET_MS = 240_000` | **Acota por reloj, no por cantidad.** El límite real es la latencia de MP, que varía: un tope de items calibrado hoy se vuelve a pasar el día que la API esté lenta |
| Corte por 429 (`esThrottling`) | Cuando MP satura, seguir sólo quema tiempo. Mismo patrón que enrich-ordenes |
| `aborted` + `found` en `deriveRunStatus` | Una corrida contenida es `partial`, no `success` |
| Migración 027 | `mp_job_health_resumen` separa **huérfana** de **fallo real** |

La migración 027 es la que convierte este diagnóstico en capacidad permanente.
Buscar la excepción de una huérfana es buscar algo que no existe: son dos
problemas con dos arreglos distintos y el status los mostraba igual.

```
job_name                  dias  huerf  fallos  diagnostico
refresh-opportunities      6.8     26       2  NUNCA TERMINA (huerfanas)
enrich-ordenes             0.0      5       2  NUNCA TERMINA (huerfanas)
```

**Estado:** ✅ typecheck · ✅ 9/9 tests · ✅ build · ✅ migración 027 aplicada.

#### Abierto

- [ ] Si el backlog de candidatos supera lo que entra en 240 s, el arreglo real es trocear en steps de Workflow como `sync-compra-agil`, no subir el techo.

---

### MON-5 · `enrich-ordenes` — misma enfermedad, otro origen ✅ RESUELTO 2026-08-05

Lo destapó la migración 027 junto con `refresh-opportunities`: 5 huérfanas en 7
días. **Pero el diagnóstico resultó ser distinto**, y vale la pena la
distinción.

`refresh-opportunities` estaba mal calibrado por descuido — heredó los 200 ms de
los listados. `enrich-ordenes` estaba **bien** calibrado: alguien midió, dejó
15 líneas de justificación y estimó 252 s por pasada. **La medición era
correcta** — el p50 real sobre 492 corridas es 255 s.

Lo que la calibración no cubría es la **varianza**:

| | |
|---:|---:|
| p50 | 255 s |
| p90 | **400 s** |
| techo de la función | 300 s |

En un día normal la pasada usa el 85% del presupuesto; en uno lento se pasa, el
proceso muere sin llegar a `complete()` y queda huérfana. Y como el step muere
con `maxRetries = 1`, **corta la cadena de 10 pasadas del workflow**: una pasada
que se pasa por 20 segundos cuesta las nueve que venían detrás.

**La lección no es "estaba mal calculado". Es que un tope por CANTIDAD no puede
proteger contra una latencia que varía — por más bien calculado que esté.**

#### Lo que se cambió

| Qué | Por qué |
|:---|:---|
| `ENRICH_TIME_BUDGET_MS = 250_000` | Red de seguridad por reloj: corta limpio antes de que lo maten |
| `ENRICH_OC_MAX_ITEMS` 90 → 80 | ≈226 s al ritmo medido de 2,83 s/ítem. Deja el presupuesto como red y no como cepo: si saltara en toda corrida, `partial` sería la norma y el estado dejaría de significar algo |
| `totalProcessed` = lo recorrido | Decía el tamaño del lote. Si se cortó a mitad, eso esconde justo lo que hay que ver |
| `TIME_BUDGET_EXCEEDED` ≠ `HIGH_FAILURE_RATE` | Etiquetar un corte por presupuesto como problema de calidad manda a buscar donde no está |

Cuesta ~11% de caudal por disparo. Irrelevante al lado de lo que costaban las
huérfanas: cada una se llevaba hasta nueve pasadas encadenadas (~4.000 OCs en
los 7 días medidos).

**Estado:** ✅ typecheck · ✅ 9/9 tests · ✅ build.

**Ojo al desplegar:** `ENRICH_OC_MAX_ITEMS` se cambió en el **default** del
esquema. Si está seteada explícitamente en el proyecto Vercel, el cambio no tiene
efecto — hay que actualizarla ahí. No figura en el `.env` local, lo que sugiere
que se usa el default, pero **eso hay que confirmarlo con `vercel env ls`.**

---

### RAG-1 · Aristas huérfanas y alucinaciones — ✅ 2026-08-05

Dos problemas que resultaron ser el mismo: **el grafo prometía contexto que no
entregaba, y el prompt afirmaba cosas falsas.**

#### El mecanismo

`search_hybrid_graphrag` trae los vecinos con un **INNER JOIN**:

```sql
from knowledge_nodes kn
join knowledge_edges ke on kn.document_title = ke.target_title
where ke.source_title = any(extracted_entities)
```

`knowledge_edges` enlaza por **título**, sin foreign key. Una arista hacia un
nodo inexistente **no falla: aporta cero filas en silencio.** El modelo recibe un
contexto parcial indistinguible de uno completo, y completa el hueco con
conocimiento paramétrico. Eso es la alucinación, y el origen es nuestro.

#### La causa en el generador

`sync-jurisprudencia-grafo` creaba **nodos** con topes (`TOP_TIPOS=12`,
`TOP_SALAS=7`, `TOP_MATERIAS=12`) y **aristas** con un umbral distinto y sin tope
(`n > 500 AND 20%`). Los conjuntos no coincidían por construcción.

38 aristas huérfanas creadas el 2026-08-03 — **la feature más reciente**. La
mitad de `RESUELVE_MATERIA` y `SE_LITIGA_VIA` apuntaba al vacío, incluidas
materias como **Bancos, AFP y Carabineros**.

#### La limpieza, y por qué no reparé todo

78 huérfanas → **19**. Con un criterio explícito:

| | Qué se hizo | Por qué |
|:---|:---|:---|
| **3 títulos** (6 aristas) | ✅ reparados | Misma cadena con otra puntuación (`Product Market Fit` → `Product-Market Fit`). No hay criterio en juego |
| **5 títulos** (15 aristas) | 🗑 borradas | El concepto no existe como nodo (similitud < 0.4). La arista era ruido |
| **38 aristas de PJUD** | 🗑 borradas | El job corregido regenera las válidas |
| **8 títulos** (19 aristas) | ⏸ **intactas** | Similitud 0.57–0.92. **Emparejar por parecido sería inventar la relación** |

El último grupo es la decisión de fondo. `Fundraising Etapas VC` se parece 0.917
a `Fundraising — Etapas y VC`, pero "parecido" no es "es". Afirmar esa relación
en un grafo que alimenta a un LLM es fabricar doctrina — lo dice el comentario
del propio job. **Quedan para criterio humano** (respaldadas en el scratchpad).

#### La alucinación que inyectábamos nosotros

En `api/rag.py`, todo nodo sin `ultimo_valor` numérico entraba al prompt con:

```
_Datos en proceso de actualización._
```

**Es falso.** La mayoría de esos nodos —leyes, metodología, jurisprudencia— no
tiene ni va a tener valor numérico, y no hay ninguna actualización en curso. El
modelo lo leía y se lo repetía al usuario de buena fe.

Ahora un nodo sin serie simplemente no lleva línea de valor: **la ausencia de una
afirmación es más honesta que una afirmación sobre la ausencia.**

Y el caso vacío pasó de nota al pie a **instrucción**: antes decía "no se
encontraron nodos relevantes", que un modelo puede leer y responder igual desde
su conocimiento general. Ahora ordena explícitamente decir que no se dispone de
la información y no estimar.

#### Que no vuelva a pasar

El generador ahora **descarta las aristas cuyos extremos no son nodos**, cuenta
cuántas descartó y **avisa a `degradacion`** con los títulos faltantes. Descartar
en silencio habría cambiado un problema por otro: el desajuste significa que los
topes de nodo se quedaron cortos, y eso hay que verlo para corregir la
calibración.

**Estado:** ✅ typecheck · ✅ sintaxis · datos limpios y respaldados. El arreglo
del generador y el de `rag.py` necesitan deploy.

#### Abierto

- [ ] Decidir sobre los 8 títulos dudosos: ¿se reparan a mano o se borran?
- [ ] `knowledge_edges` no tiene FK ni normaliza títulos. Mientras enlace por texto libre, esto vuelve. Un `document_title` normalizado o un id resolvería la clase entera.

---

### MON-1 · Cobertura de `job_health` — ✅ AUDITADO 2026-08-05

**4 de los 9 jobs eran invisibles para el detector.** `fred_sync`,
`yfinance_sync`, `embeddings_pendientes` y `cache_sweep` no llamaban a
`job_health.report()`, así que no aparecían en `job_health_resumen` y **no podían
disparar la alerta de fallo silencioso** por diseño.

Peor: `fred_sync` y `yfinance_sync` terminaban en un `except Exception:` que sólo
logueaba a stdout. Una corrida caída era **indistinguible** de una sana.

`yfinance_sync` corre **una vez al mes**: sin reporte, una corrida fallida no se
notaba hasta la siguiente, o sea 30 días después.

#### Estado real, verificado por efecto

| Job | Veredicto | Evidencia |
|:---|:---|:---|
| `embeddings_pendientes` | ✅ funciona | **0 de 774** nodos sin vector |
| `fred_sync` | 🟡 probablemente | Último CPI = junio 2026, que es lo correcto un 5-ago (el de julio sale ~12-ago) |
| `yfinance_sync` | ❓ sin verificar | Sus nodos no llevan fecha en metadata |
| `cache_sweep` | ⚪ **no-op** | Barre un dict en memoria |

**Que para juzgar `fred_sync` haya hecho falta razonar sobre el calendario de
publicación de FRED es, en sí mismo, el hallazgo.** No hay forma de responder
"¿esto funciona?" desde el monitoreo.

`cache_sweep` merece nota aparte: barre `cache._cache`, un dict **del proceso**.
Desde que el worker es serverless cada invocación arranca con el dict vacío, así
que el job siempre encuentra cero. No está roto — el problema que resolvía dejó
de existir. **Es el mismo patrón que dejó inservible al detector de fallos
silenciosos:** estado de proceso que sobrevivía en un deploy persistente y dejó
de hacerlo al migrar.

#### Lo que se cambió

- `fred_sync`, `yfinance_sync`, `embeddings_pendientes` reportan en **ambos** caminos.
- Los `except` de FRED y yfinance reportan `0` en vez de sólo loguear.
- `embeddings_pendientes` reporta **`1`** cuando no hay pendientes: ahí el cero es el resultado *sano*, y reportarlo como 0 alertaría justo cuando funciona bien.
- `cache_sweep` **no** reporta, documentado como decisión: un cero es lo normal y alertarlo sería ruido garantizado.

**Cobertura: 5 → 8 de 9.** Sintaxis validada.

#### Abierto

- [ ] `yfinance_sync` sigue sin verificar. Sus nodos no llevan fecha; hay que agregarle una a la metadata o esperar la corrida del 1 de septiembre y mirar si reporta.
- [ ] **La tabla `job_health` sólo tiene 3 filas** (`cmf_sync`, `concursal_sync`, `radar_refresh`) porque sólo registra lo que corrió desde el 2026-08-04. Un job ausente NO significa sano.

---

<details>
<summary>Planteo original de MON-1</summary>

### Auditar la cobertura real de `job_health`

Comprobar que **cada** job de `_JOBS` llama a `job_health.report()` en los dos
caminos. La auditoría arregló los que fallaban; nadie verificó los que no
fallaban.

```sql
select * from job_health_resumen order by dias_sin_producir desc nulls first;
```

**Criterio de aceptación**
- [x] Los jobs de `_JOBS` reportan a `job_health` (8 de 9; `cache_sweep` es excepción documentada).
- [x] `yfinance_sync`, `cache_sweep` y `embeddings_pendientes` tienen estado conocido y escrito.
- [x] Los jobs desactivados (`cmf_sync`, `bcch_sync`) salieron del scheduler y no generan ruido.

**Esfuerzo.** 1 h.

</details>

---

### MON-2 · Extender el detector a `mp-sync`

`mp-sync` tiene `sync_logs`, `reporte-frescura.job.ts` y `sendOpsAlert`, pero no
tiene el equivalente del umbral de N corridas vacías consecutivas. ING-2 lo
resuelve para un job; esto lo generaliza.

**Criterio de aceptación**
- [ ] Existe una consulta o vista que responde "¿qué job de `mp-sync` no produce hace más de N días?", análoga a `job_health_resumen`.
- [ ] La condición de alerta se evalúa **en la base**, no en memoria del proceso — misma razón que en el worker: en serverless cada invocación es un proceso nuevo y el contador vuelve a cero.
- [ ] Se prueba forzando: un job que no encuentra nada tres veces seguidas dispara la alerta en `degradacion`.

**Depende de.** ING-2.
**Esfuerzo.** 3 h.

---

### MON-3 · Un chequeo semanal que mire el dato, no el job

Los dos detectores anteriores miran corridas. Este mira el resultado: ¿la tabla
canónica creció esta semana? ¿el grafo tiene nodos con fecha de esta semana? ¿el
RAG devuelve algo fechado en los últimos 7 días?

Es la red de seguridad para la clase de fallo que ninguno de los otros dos ve:
el job corre, reporta bien, inserta filas — y las filas son basura o duplicados.

**Criterio de aceptación**
- [ ] Un job semanal publica en Discord un resumen: filas nuevas por tabla, nodos nuevos por categoría, y la fecha del dato más reciente de cada fuente.
- [ ] El resumen se manda **siempre**, incluso cuando todo está bien — un canal que sólo habla cuando algo se rompe deja un silencio indistinguible de "todo bien".

**Esfuerzo.** 2–3 h.

---

# FASE 3 — Las trampas estructurales

### INF-1 · `bralidus-api` y `mp-sync` sin integración Git

La trampa que ya costó un incidente: código commiteado, CI verde, nunca en
producción. Está documentada en tres CLAUDE.md — la documentación reduce el
riesgo, no lo elimina.

**Opciones, en orden de preferencia:**

| Opción | Qué implica | Costo |
|:---|:---|:---|
| **A.** Conectar los proyectos Vercel a Git | El deploy vuelve a ser consecuencia del push. Ojo: `mp-sync` vive en un subdirectorio del portal → configurar Root Directory | Bajo, es la correcta |
| **B.** Un workflow de GitHub Actions que corra `vercel deploy --prod` al mergear | Mantiene el estado actual pero lo automatiza | Medio |
| **C.** Un check de CI que falle si el commit toca esos directorios y no hay deploy posterior | No arregla nada, sólo grita | Bajo, pero es un parche |

Recomiendo **A**. La razón por la que hoy no están conectados no está
documentada en ningún lado; si hay una, aparecerá al intentarlo.

**Criterio de aceptación**
- [ ] Un cambio trivial (un comentario) pusheado a `main` aparece en producción de ambos servicios sin intervención manual.
- [ ] Se verifica **en el servicio corriendo**, no en el dashboard de Vercel.
- [ ] Los CLAUDE.md que hoy advierten sobre esto se actualizan — una advertencia obsoleta es peor que ninguna.

**Esfuerzo.** 2 h si no hay sorpresas.

---

### LIMP-1 · Retirar el scorer hawkish/dovish

Cierra DEC-3. `bcch_sync` ya está desactivado, así que esto no cambia
comportamiento: deja el código diciendo la verdad sobre lo que el producto hace.

Hoy hay 198 líneas que sugieren una capacidad de análisis de tono que no llega a
ningún consumidor. La próxima persona que lea el repo va a asumir que existe.

**Criterio de aceptación**
- [ ] `src/extractors/bcch_sentiment.py` borrado.
- [ ] La rama de sentimiento sale de `bcch_extractor.py` (líneas ~324, ~376–390).
- [ ] `MACRO_ALERT` sigue produciéndose desde `classifier.py` — verificado con una corrida de `radar_refresh`, no por lectura.
- [ ] El CLAUDE.md del worker no menciona hawkish/dovish como capacidad viva.

**A diferencia de ING-3, acá no hay que limpiar datos viejos:** las
`radar_signals` que producía tienen `expires_at` (168 h) y ya expiraron solas.
Esa diferencia entre `radar_signals` y `knowledge_nodes` conviene tenerla
presente cada vez que se desactive un extractor.

**Esfuerzo.** 1 h.

---

### INF-2 · Limpiar configuración muerta

Pequeño, pero cada variable fantasma es una pista falsa para la próxima
auditoría.

- [ ] Borrar `CMF_KEY` de Vercel — no la lee nadie (verificado).
- [ ] Decidir qué pasa con `SCRAPERAPI_KEY`: hoy no está configurada y hay cuatro extractores con soporte de proxy que la esperan. O se borra el soporte, o queda con un comentario que explique por qué existe y no se usa. Ver DEC-2.
- [ ] Consolidar los nombres duales (`MP_API_KEY`/`MERCADO_PUBLICO_TICKET`, `CMF_API_KEY`/`CMF_BEST_KEY`) a uno solo, después de confirmar cuál está realmente configurado en prod.

**Esfuerzo.** 1 h.

---

# FASE 4 — Puntos a resolver (no son código)

Estos bloquean trabajo y **no los puedo cerrar yo**. Cada uno necesita una
decisión o una respuesta externa.

### DEC-1 · Dictamen del abogado sobre PJUD

**Estado.** Esperando. Documento: `validateai/docs/PJUD_VALIDACION_EXPERTO.md`.

**Qué desbloquea.** Las tres lecturas de PJUD y las advertencias que hoy viajan
dentro de la respuesta del MCP. Si el dictamen invalida alguna lectura, hay que
retirarla del producto, no sólo anotarla.

**Qué necesito de vos.** La respuesta, o una fecha límite después de la cual
asumimos la lectura más conservadora y seguimos.

---

### DEC-2 · Fuentes que exigen eludir un control de acceso — ✅ RESUELTO 2026-08-05

**Resolución: opción (a). Misma regla para todos.** El bloqueo es deliberado
venga de un regulador o de un privado; cambia la razón del riesgo
(reputacional vs. contractual), no la conducta.

Consecuencias, ya reflejadas en el backlog:
- `empleo_sync` se desactiva (ING-3).
- El soporte de `SCRAPERAPI_KEY` se borra de los cuatro extractores (INF-2).
- No se reabre sin una autorización explícita del emisor.

<details>
<summary>Contexto original de la decisión</summary>

**El patrón se repite en cuatro lugares:** CMF (captcha en el buscador), BCCh
(Incapsula), Diario Oficial (403 en todo el dominio), Computrabajo
(`empleo_sync`, con ScraperAPI "recomendado" en el propio docstring).

La postura ya escrita en el CLAUDE.md del worker es que **no** se usa ScraperAPI
para sortear Incapsula ni captchas: es eludir un control puesto a propósito por
el emisor, y Animus vende inteligencia regulatoria. Hacerlo saltándose al
regulador es un riesgo que no compensa la señal.

**La decisión pendiente es si esa postura aplica también a fuentes privadas**
(Computrabajo no es un regulador). Mi recomendación: sí, misma regla, distinta
razón — ahí el riesgo es contractual (términos de servicio) en vez de
reputacional, pero el bloqueo es igual de deliberado.

Las tres opciones que había sobre la mesa: (a) misma regla para todos, (b) regla
distinta para privados, (c) buscar autorización formal emisor a emisor.

</details>

**Queda abierto (c) como vía futura**, no como bloqueo: pedir acceso formal a
CMF y BCCh es lento, pero es lo único que revive esas fuentes sin deuda.

---

### DEC-3 · La señal hawkish/dovish — ✅ RESUELTO 2026-08-05

**Resolución: se retira.** Ver `LIMP-1`.

La pregunta era si la señal formaba parte de la promesa comercial. **La respuesta
la dio el rastreo del código, no la conversación: nunca salió del worker.**

| Dónde vive | Referencias |
|:---|:---|
| `src/extractors/bcch_sentiment.py` | el scorer completo (198 líneas) |
| `src/extractors/bcch_extractor.py:383` | único consumidor |
| Validus, `api-v1`, portal, MCP | **cero** |

Era un insumo interno de scoring que producía `MACRO_ALERT` para fintech,
crédito y proptech, y que además gastaba Haiku para resolver la "zona gris" de
un consumidor que no existía.

**No se pierde el tipo de señal.** `MACRO_ALERT` sigue produciéndose:
[classifier.py:197](../validateai-financial-worker/api/radar/classifier.py#L197)
tiene su propio camino por keywords (`"fed sube tasa"`, `"hawkish fed"`,
`"fomc sube"`) alimentado por FRED, que funciona. Se pierde una de las fuentes
que lo disparaban, no la capacidad.

---

# Backlog ordenado

| # | ID | Tarea | Fase | Bloquea a | Esfuerzo |
|:--|:---|:---|:---|:---|:---|
| 1 | **SEC-1** | Rotar las cuatro credenciales + inventario | 0 | — | 1–2 h |
| 2 | **ING-1** | Diagnosticar `sync-compra-agil` (0 encontradas) | 1 | ofertas/precios, ING-4 | 2–4 h |
| 3 | **ING-2** | `deriveRunStatus`: cero ≠ éxito | 1 | MON-2 | 2 h |
| 4 | **ING-3** | Desactivar `empleo_sync` + **borrar los nodos rancios** | 1 | — | 1 h |
| 5 | **LIMP-1** | Retirar el scorer hawkish/dovish | 3 | — | 1 h |
| 6 | **MON-1** | Auditar cobertura de `job_health` | 2 | — | 1 h |
| 7 | **INF-1** | Deploy por Git en `bralidus-api` y `mp-sync` | 3 | — | 2 h |
| 8 | **MON-2** | Detector de corridas vacías en `mp-sync` | 2 | — | 3 h |
| 9 | **INF-2** | Limpiar config muerta + borrar soporte ScraperAPI | 3 | — | 1 h |
| 10 | **MON-3** | Reporte semanal del dato, no del job | 2 | — | 2–3 h |
| 11 | **ING-4** | Señal sectorial sobre dato propio | 1 | — | diseño |
| 12 | **DEC-1** | Dictamen PJUD | 4 | producto | externa |

**Resueltos el 2026-08-05:** DEC-2 (misma regla para todas las fuentes con
control de acceso) y DEC-3 (la señal hawkish/dovish se retira).

**Ruta crítica:** SEC-1 → ING-1 → ING-2 → MON-2. Todo lo demás es paralelizable.

**Si sólo hay tiempo para tres cosas:** SEC-1, ING-1, ING-2. La primera es
riesgo real; las otras dos devuelven a producción la feature que se construyó
ayer y evitan que el mismo silencio vuelva.

**ING-3 sube en la lista respecto de la primera versión de este plan.** No por
el job muerto —eso puede esperar— sino porque hay ocho nodos con conteos de
junio que el RAG está citando hoy sin fecha. Es dato falso sirviéndose en
producción, y se arregla con un `delete`.

---

## Lo que NO vamos a hacer, y por qué

- **No revivir CMF ni BCCh con scraping.** Requiere autorización del emisor, no
  código. Está decidido y no se reabre sin DEC-2(c).
- **No mover el filtro `Empresa Deudora` del extractor concursal aguas abajo.**
  Va en la extracción para que el dato personal no entre a la base ni de paso —
  70 de cada 100 registros del Boletín son personas naturales en quiebra
  personal, y la Ley 21.719 distingue la finalidad de publicidad legal de la
  comercial.
- **No devolver `JobHealthMonitor` a estado de instancia.** No tiene `__init__`
  a propósito. Un contador en memoria en serverless vuelve a cero en cada
  invocación y el umbral queda matemáticamente inalcanzable — así estuvieron
  cuatro extractores muertos durante meses.
- **No agregar rutas de datos antes del `app.use` de middlewares en
  `api-v1/index.ts`.** Quedan publicadas sin cuota ni registro y nada falla para
  avisarlo.
- **No publicar en npm desde la raíz del monorepo.** Sólo desde
  `animus-engine-mcp/`.

---

## Cómo se verifica que este plan se cumplió

No por tickets cerrados. Por esto:

```sql
-- Ningún job sin producir hace más de 7 días, sin explicación escrita.
select * from job_health_resumen order by dias_sin_producir desc nulls first;
```

```bash
# Cada endpoint que vende datos devuelve datos de esta semana.
curl -s -H "x-api-key: $KEY" "$BASE/mercado-publico/ofertas?limit=1" | jq '.meta'
curl -s -H "x-api-key: $KEY" "$BASE/mercado-publico/compra-agil?limit=1" | jq '.meta.source'
```

Y una pregunta que se responde a mano, mirando: **¿queda algún camino por el que
un job pueda producir cero durante un mes sin que suene nada?** Si la respuesta
es sí, el plan no terminó.

---

*Escrito el 2026-08-05, continuando la auditoría de `bf0deca`..`8e53a1d`.*
