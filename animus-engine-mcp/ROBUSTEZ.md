# Análisis de robustez — animus-engine-mcp 0.1.0

Estado: publicado en npm y funcionando (14/14 herramientas verificadas desde el
registro contra producción). Esto es lo que le falta para aguantar uso real,
ordenado por lo que primero le va a romper la experiencia a alguien.

Todo lo de acá está medido sobre el código publicado, no supuesto.

---

## P0 — lo que va a golpear al primer usuario externo

### 1. No hay timeout: una petición colgada cuelga la herramienta para siempre

```
$ grep -cE 'AbortController|setTimeout|retry|signal' src/client/raasClient.ts
0
```

`fetch` sin `signal` no tiene timeout por defecto. Si el gateway queda colgado
—Edge Function fría, Supabase degradado, la red del usuario— la llamada nunca
vuelve. Claude Desktop se queda girando sin decir nada y el usuario no sabe si
esperar o reiniciar.

Es el peor fallo de los tres porque **no produce ningún mensaje**: es
indistinguible de "el modelo se colgó".

Arreglo: `AbortController` con presupuesto por herramienta. ~30 s para las de
datos, más holgado para `intel_query` y `rag_search` que hacen trabajo de LLM
(hoy tardan y devuelven 25 kB). Al vencer, un error que diga *qué* expiró.

### 2. Los dos errores que el usuario nuevo SÍ va a ver no están traducidos

El cliente propaga el cuerpo crudo:

```ts
throw new Error(`Animus RaaS API Error (HTTP ${response.status}) on GET ${path}: ${errText}`)
```

Los dos casos garantizados en un usuario nuevo son justamente los que quedan
ilegibles:

| Situación | Lo que ve hoy | Lo que necesita |
|---|---|---|
| Key mal copiada o revocada | `HTTP 401 ... {"error":"Invalid API key or session token"}` | "Tu ANIMUS_API_KEY es inválida o fue revocada. Genera otra en animus.scouttech.lat" |
| Cuota agotada | `HTTP 429 ... {"code":"RATE_LIMIT_MONTHLY",...}` | "Agotaste N de M créditos del plan X. Se reinicia el 1 del mes." |
| Ráfaga | `HTTP 429 RATE_LIMIT_BURST` | El backend ya manda `retry_after_seconds`: esperar una vez y reintentar solo |
| Fuente caída | `HTTP 503 SOURCE_UNAVAILABLE` | "La fuente no responde. No se devuelven datos inventados." |

El gateway ya emite códigos estructurados y encabezados de cuota. El MCP los
tira a la basura y entrega el JSON crudo.

### 3. Las respuestas queman el contexto del modelo

Medido en la verificación previa a publicar:

```
animus_intel_query          25.455 chars   (~7.000 tokens)
animus_mp_oportunidades     22.806 chars
animus_licitus_compra_agil  22.805 chars
```

Tres llamadas y se fue buena parte de la ventana. Dos causas acumulativas:

- Todas las herramientas hacen `JSON.stringify(result, null, 2)`. La indentación
  infla entre 20 % y 30 % sin aportar nada: **lo lee un modelo, no una persona**.
- No hay `page_size` por defecto. `animus_mp_oportunidades` sin parámetros trae
  todo lo que el backend quiera darle.

Arreglo: quitar la indentación, poner tope por defecto (10–20 ítems) y decir en
`meta` cuántos quedaron fuera y cómo pedir el resto. En las de PJUD ya existe
paginación en el backend; falta que el MCP la use por defecto en vez de a pedido.

---

## P1 — corrección de los datos, que es de lo que vive el producto

### 4. Las advertencias de interpretación no viajan con los datos

Este es el hallazgo más importante y el menos obvio.

Sabemos tres cosas que hacen que estos datos se lean mal, y están escritas en el
README y en `PJUD_VALIDACION_EXPERTO.md`. **El modelo que llama la herramienta no
lee ninguno de los dos.** Sólo ve la descripción de la herramienta y la
respuesta.

Las tres:

1. Ingresos, inventario y términos son series **disjuntas**. Restar ingresos
   menos términos no da causas pendientes (2024 arroja 153 % "resuelto").
2. `animus_pjud_causa` devuelve un **arreglo**: una causa puede tener varios
   términos con resultados distintos (Civil 289-2023: *Inadmisible* en 2023 y
   *Rechazado* en 2025).
3. `pct_revocados` es, en los hechos, una cifra sobre **recursos de protección**:
   694.025 de los 794.935 términos (87,3 %) son ese único tipo de recurso. Y no
   es estable: 17 % (2020) → 80 % (2022) → 20 % (2025).

Si un modelo pide tendencias y publica "la Corte Suprema revoca el 56 % de las
causas", eso es exactamente el fallo que le estamos pidiendo al experto que
detecte — y el MCP no hace nada para evitarlo.

Arreglo: meter la advertencia en `meta.advertencia` de **la respuesta**, no sólo
en la descripción. El modelo ve la respuesta siempre; la descripción compite con
otras 13 herramientas.

Es barato (unas líneas por handler) y es lo único de esta lista que afecta si lo
que se publica es **cierto** y no sólo si funciona.

### 5. La versión vuelve a mentir

```
src/index.ts:65    version: '1.0.0'
package.json:3     "version": "0.1.0"
```

El handshake MCP le informa 1.0.0 al cliente. Es la misma clase de bug que ya
corregí en `X-Client` del cliente HTTP: un número escrito a mano que nadie
sincroniza. Cuando alguien reporte "me falla en la 1.0.0", no vamos a saber qué
tiene instalado.

Arreglo: una sola constante derivada de `package.json`, y que el build falle si
divergen.

---

## P2 — proceso, para que lo anterior no se repita

### 6. Cero CI sobre el MCP

```
workflows que mencionan el MCP: 0
```

`test_mcp_stdio.js` existe en el repo y **no lo corre nadie**.

Esto no es teórico: el bug del `bin` (`"./dist/index.js"`, que npm descartaba
dejando el paquete sin ejecutable) llegó hasta el intento de publicación. Sólo
no salió porque el 2FA falló primero. Nada lo habría detectado, porque nada
probaba el **artefacto empaquetado** — sólo el código fuente.

Arreglo: un workflow que haga `npm pack`, instale el tarball en un directorio
limpio, y ejercite `tools/list` más dos `tools/call` contra una key de prueba.
Es exactamente lo que hice a mano antes de publicar; automatizarlo cuesta poco y
cubre la clase entera de fallos "compila pero el paquete no sirve".

### 7. Publicar sigue dependiendo de una credencial de larga vida

La 0.1.0 se publicó con un token granular con escritura sobre todos los paquetes
y bypass de 2FA. Ese token ya fue revocado, pero el próximo publish repite el
patrón: crear token, pegarlo, publicar, acordarse de borrarlo.

Arreglo: **Trusted Publishing** — GitHub Actions publica vía OIDC, sin token
almacenado en ninguna parte. De regalo viene `--provenance`, que le pone a npm
un badge verificable de qué commit y qué workflow produjeron el tarball. Para un
paquete que la gente instala con `npx -y` y que habla con una API con
credenciales, esa cadena de confianza vale.

### 8. Sin reintentos

Un 502 pasajero de Supabase Edge tumba la llamada entera. Los GET son
idempotentes y `intel/query` y `rag/query` son de lectura pese a ser POST, así
que reintentar es seguro. Va en P2 y no antes porque sin timeout (punto 1) un
reintento puede empeorar las cosas: hay que arreglarlos en ese orden.

---

## Qué haría primero

Si hay que elegir, **los puntos 1, 2 y 4**.

- 1 y 2 son la diferencia entre "no funciona" y "no funciona *y no sé por qué*",
  y el experto los va a tocar esta semana: si copia mal la key, hoy recibe un
  volcado de JSON.
- 4 es el único que afecta si lo que el sistema afirma es verdad. Los demás son
  de disponibilidad; ese es de correctitud, que es lo que estamos vendiendo.

El 6 va inmediatamente después, porque es lo que impide que la lista vuelva a
crecer sin que nos enteremos.
