# Plan — Calidad del contenido que llega al modelo

Levantado el 2026-08-05, continuación del hilo de alucinaciones abierto en
`PLAN_POST_AUDITORIA.md` (RAG-1).

---

## El principio que ordena todo

**Nada entra al prompt afirmando algo que no verificamos.**

Un modelo trata como hecho todo lo que recibe en su contexto. Cada defecto de
abajo es una afirmación falsa que *nosotros* inyectamos: no las alucina el
modelo, las lee.

---

## Diagnóstico — medido, no estimado

Sobre 774 nodos de `knowledge_nodes`:

| Hallazgo | Cantidad | Recuperable por el RAG |
|:---|---:|:---|
| Contenido útil = **0 caracteres** | ~~36~~ → **49** | **Sí, los 49 tienen embedding** |
| Prefijo de plantilla `"Relacionado con: …"` | 44 | Sí |
| Andamiaje `"Asked on … against NotebookLM notebook"` | 30 | Sí |
| **Frontmatter YAML como contenido** (`--- titulo: … ---`) | **5** | Sí |
| Contenido útil entre 1 y 120 caracteres | 9 | Sí |
| Nodo literal `Test` / *"Test content para validacion chilena"* | 1 | Sí |

⚠️ **Los 36 originales estaban mal contados** (corregido el 2026-08-05 al tomar
la línea base de CAL-6a). El filtro de la primera medición sólo descontaba
`"Relacionado con: , , ,"`, así que un chunk cuyo contenido entero era
`"Relacionado con: , , Asked on … against NotebookLM notebook"` se contaba como
**no vacío**. Y el frontmatter YAML no se buscó: apareció leyendo una salida
real del RAG, no consultando la base.

Las cifras de este plan valen lo que valga su definición de "contenido útil".
La definición vive ahora en una sola función —`contenido_util()` en
`scripts/rag_baseline.py`— para que medir y limpiar no puedan divergir.

### Qué son exactamente los chunks vacíos

**Todos tienen `header_path = 'Introduccion'`** y se crearon el 2026-06-12.

El modelo de datos trocea un documento en secciones: misma `document_title`,
distinta `header_path`. `Ley 21.521 Fintech Chile — Regulación Completa` existe
**29 veces**; su contenido real son 17.137 caracteres repartidos en esos chunks.
**El chunk "Introduccion" de 36 documentos quedó con sólo la basura de
plantilla.**

Verificado: **36 de 36 tienen un chunk hermano con contenido real.** Ninguno es
la única copia de nada.

### Por qué importa

Los títulos son el núcleo del producto:

```
Ley 21.521 Fintech Chile — Regulacion Completa      → chunk vacío, recuperable
Ley 21.719 Proteccion de Datos Personales Chile     → chunk vacío, recuperable
Marco Regulatorio Fintech Chile — CMF y UAF         → chunk vacío, recuperable
Constitucion SpA Chile — Guia Completa              → chunk vacío, recuperable
Regulacion Laboral para Startups Chile              → chunk vacío, recuperable
Vesting y Contratos Societarios para Startups       → chunk vacío, recuperable
Product-Market Fit, Unit Economics, Mom Test, …     → +29 más
```

El mecanismo, **corregido con lo medido en CAL-6a** — la primera versión de este
párrafo decía que el encabezado llega sin nada debajo, y es falso:

```
### Ley 21.719 Proteccion de Datos Personales Chile [VECTOR] — normativa
Relacionado con: , , , Asked on 2026-05-24T… against NotebookLM notebook
```

El encabezado promete normativa de protección de datos y debajo hay **una lista
de relaciones vacía**, no un hueco. Eso es peor que el vacío: un hueco visible
invita a decir "no tengo el dato", esto se lee como contenido y no señala nada.
El modelo completa con conocimiento paramétrico y el usuario recibe regulación
inventada con formato de cita.

Y no es ruido incidental. `_build_embed_text` vectoriza
`f"{document_title}. {content}"`, así que con `content` vacío **el vector del
chunk es el del título** — un match más puro a una pregunta con forma de título
que cualquier chunk real, cuyo vector está diluido por párrafos de detalle. En
la línea base el chunk basura sale **#1**, por encima de todos los chunks reales
de su propio documento.

Es el mismo mecanismo que las aristas huérfanas, por otra vía.

---

# FASE 0 — Un defecto que introduje hoy

### CAL-0 · `trg_knowledge_nodes_borrado` no entiende documentos troceados

✅ **HECHO — migración `20260805000003`, aplicada y verificada en producción.**
8 de 8 pruebas contra la base real. Detalle al final del ticket.

El trigger de cascada (migración `20260805000002`) borra aristas así:

```sql
delete from public.knowledge_edges
 where source_title = old.document_title
    or target_title = old.document_title;
```

**Incondicional.** Pero `knowledge_edges` referencia el **título**, y un título
corresponde a *N chunks*. Borrar un solo chunk se lleva **todas las aristas del
documento**, aunque los otros 28 chunks sigan ahí.

No explotó todavía porque no se borró ningún nodo desde que se aplicó. Pero
CAL-1 borra 36 chunks: **ejecutar CAL-1 antes de arreglar esto destruiría las
aristas de 36 documentos.**

**Arreglo:** cascadear sólo si no queda ningún nodo con ese título.

```sql
if not exists (
  select 1 from public.knowledge_nodes where document_title = old.document_title
) then
  delete from public.knowledge_edges where ...;
end if;
```

**Criterios de aceptación**
- [x] Borrar un chunk de un documento con varios chunks **no** toca sus aristas.
- [x] Borrar el **último** chunk de un documento sí borra sus aristas.
- [x] Prueba contra la base real con rollback, cubriendo ambos casos.
- [x] El grafo sigue en 0 huérfanas después.

**Resultado esperado:** la cascada pasa a tener la semántica correcta para el
modelo de datos real, no para el que yo supuse.

**Lección:** escribí y probé el trigger con nodos de una sola fila por título.
El modelo troceado existía en la base y no lo miré. Un test que pasa sobre el
caso que imaginaste no dice nada del caso que no.

**Esfuerzo.** 1 h.

---

#### Resultado medido

El radio era mayor de lo que decía este ticket cuando se escribió:

| Medición | Valor |
|:---|---:|
| Nodos / títulos | 774 / 212 |
| Títulos multi-chunk | **56** |
| Aristas en esos títulos | **354 de 477 (74 % del grafo)** |
| Aristas que CAL-1 habría destruido | **149** |

**La pieza 2 tenía el mismo defecto y no estaba en el ticket.** Renombrar un
chunk arrastraba las aristas de todo el documento al título nuevo, dejando sin
relaciones a los chunks que conservaban el viejo. Se arregló con el mismo
criterio.

**Y un tercer defecto, distinto, en esa misma función:** `knowledge_edges` tiene
`unique_edge (source_title, target_title, relation_type)`. Si al renombrar X→Y
ya existía la arista equivalente bajo Y, el `UPDATE` violaba la restricción y el
renombre **reventaba**. Reproducido contra los triggers de producción antes de
tocarlos. Tras el renombre esas dos filas son la misma arista, así que ahora se
descarta la duplicada antes de propagar — dejar que falle no protegía ningún
dato, sólo bloqueaba el renombre.

**Verificación.** `validateai/supabase/tests/knowledge_graph_cascada.sql`, 8
casos contra la base real con rollback. Se corrió **tres veces**:

1. Con el arreglo dentro de la transacción → 8/8 pasan.
2. **Control con los triggers viejos** → los casos 1 y 5 **fallan** (borrar 1 de
   3 chunks dejaba el documento en 0 aristas) y el 7 **aborta** con `unique_edge`.
   Sin este paso sólo sabríamos que el arreglo pasa sus propias pruebas, no que
   las pruebas detecten el defecto.
3. Aplicada la migración, de nuevo contra las funciones ya desplegadas → 8/8.

Base intacta: 774 nodos, 477 aristas, 0 huérfanas, cero residuo de prueba.

---

# FASE 1 — Sacar del RAG lo que no dice nada

### CAL-1 · Los chunks vacíos (36 → **49**)

✅ **HECHO — 2026-08-05.** Opción A. 49 filas borradas, respaldo completo en
`public.knowledge_nodes_respaldo_cal1`. Resultado medido al final del ticket.

Depende de **CAL-0**. No ejecutar antes.

Tres opciones, en orden de preferencia:

| Opción | Qué implica |
|:---|:---|
| **A. Borrar los 36** | El contenido vive en los chunks hermanos. No se pierde nada, y con CAL-0 arreglado las aristas quedan intactas |
| **B. Quitarles el embedding** | Dejan de ser recuperables pero siguen en la tabla. Menos limpio, reversible |
| **C. Completar el contenido** | Requiere regenerar la introducción de 36 documentos. Caro y no aporta: la introducción no es dato |

**Recomendada: A**, con respaldo previo.

**Criterios de aceptación**
- [x] Respaldo de las filas completas (incluido `embedding`) antes de borrar. **49/49 con embedding.**
- [x] `contenido_util(content) = ''` devuelve **0**.
- [x] El grafo sigue en **0 aristas huérfanas**.
- [x] Los documentos conservan sus chunks con contenido: `Ley 21.521…` quedó en **28 filas**, como predecía el plan.
- [x] Una consulta al RAG sobre los temas afectados devuelve **contenido**.

**Resultado esperado:** ningún nodo recuperable sin contenido. El RAG deja de
poder entregar un título sin nada debajo.

**Esfuerzo.** 1 h.

---

#### Resultado medido

| | Antes | Después |
|:---|---:|---:|
| Nodos | 774 | **725** |
| Títulos | 212 | **212** |
| Aristas | 477 | **477** |
| Nodos sin contenido útil | 49 | **0** |
| Aristas huérfanas | 0 | **0** |

**212 títulos antes y después**: ningún documento perdió su última fila. Y las
**149 aristas** de los 44 documentos afectados siguen ahí — ése es CAL-0
funcionando sobre datos reales, no sobre un caso de prueba.

**El efecto en el contexto que recibe el modelo** (`antes` vs `despues_cal1`):

| Métrica | Antes | Después |
|:---|---:|---:|
| Consultas con al menos un nodo basura | **8 de 12** | **0** |
| Encabezados sin contenido útil | 15 | **0** |
| Nodos con contenido real | 57 de 72 | **72 de 72** |
| Caracteres útiles entregados al modelo | 62.506 | **75.843 (+21 %)** |

**El hallazgo que no esperaba: la basura no sólo ensuciaba, DESPLAZABA.** Al
ocupar lugares del presupuesto de `top_k`, empujaba conocimiento real fuera del
contexto. Por eso borrar 49 filas *agregó* un 21 % de contenido sin generar
nada. En `mom-test` el modelo pasó de **1 chunk útil a 6**, y entró
`Mom Test — Regla de No Presentar`, que es exactamente lo que la pregunta pedía
y antes no llegaba.

---

### CAL-2 · El prefijo de plantilla y el andamiaje

✅ **CERRADO SIN TRABAJO — CAL-1 se lo llevó entero.** Verificado después de
borrar: **0** nodos con `Relacionado con:`, **0** con `NotebookLM`, **0** con
frontmatter YAML.

La premisa del ticket era falsa. Decía "tras CAL-1 quedan los que **sí** tienen
contenido real detrás", y no queda ninguno: **todo nodo que llevaba plantilla o
andamiaje lo llevaba como contenido ÚNICO**. Los 44 con plantilla, los 30 con
NotebookLM y los 5 de frontmatter eran el mismo conjunto de 49, solapado.

Consecuencia práctica: no hay contenido que modificar, así que **no hubo que
revectorizar nada** y el gasto de OpenAI previsto para este ticket es cero. La
regla de invalidar el embedding al cambiar contenido sigue valiendo para CAL-3 y
para cualquier limpieza futura — simplemente acá no hubo caso.

*(Texto original del ticket, conservado porque explica por qué era un defecto:)*

39 nodos con `"Relacionado con: , , ,"`, 30 con `"Asked on … against NotebookLM
notebook"`. Tras CAL-1 quedan los que **sí** tienen contenido real detrás.

Son dos defectos distintos:

- **Relaciones vacías interpoladas.** Una plantilla armó `"Relacionado con: {a},
  {b}, {c}"` con valores vacíos. Misma familia que las aristas huérfanas:
  relaciones prometidas que no existen, escritas en el texto.
- **Andamiaje del proceso.** `"Asked on … against NotebookLM notebook"` es una
  marca de la herramienta de ingesta, no conocimiento. Está dentro de lo que se
  le manda al modelo como si lo fuera.

**Criterios de aceptación**
- [ ] Cero nodos con `Relacionado con:` seguido de coma.
- [ ] Cero menciones a `NotebookLM` en `content`.
- [ ] El contenido real de cada nodo queda **intacto** — comparación de longitud antes/después por fila.
- [ ] **El embedding se invalida (`NULL`) en todo nodo cuyo contenido cambie**, y `embeddings_pendientes` lo revectoriza.

**El último criterio no es opcional.** Dejar el vector viejo sobre texto nuevo
es la peor combinación: el nodo se recupera por un significado que ya no tiene.
El job de jurisprudencia ya hace exactamente esto (`embedding = CASE WHEN
content IS DISTINCT FROM EXCLUDED.content THEN NULL …`).

**Resultado esperado:** el contexto que llega al modelo contiene sólo
conocimiento, sin restos del proceso que lo produjo.

**Esfuerzo.** 2 h (1 de limpieza + revectorización).

---

### CAL-3 · El nodo `Test` y los casi vacíos

🟡 **PARCIAL — 2026-08-05.** El ticket resultó ser mucho más grande de lo que
decía: no son 14 nodos cortos, es una familia de defectos que sólo se ve leyendo
el contenido. Hecho: la documentación interna. Abierto: `Test`, los 9 cortos y
un hallazgo nuevo y más grave (títulos que no corresponden al contenido).

---

#### CAL-3a · Documentación interna del producto dentro del grafo ✅

**No estaba en el plan.** Apareció al clasificar los nodos cortos: varios no
eran conocimiento del dominio chileno sino **especificaciones internas de
Validus**, recuperables por el RAG y servidas por una API que se cobra.

La cadena de exposición es real: `animus-engine-mcp` —publicado en npm— llama
`POST /api/v1/intel/query`, que en `routes/intel.ts` es un **proxy real** hacia
el `/query` del worker, que es el que lee `knowledge_nodes`. (`/api/v1/rag/query`
es otro corpus —`knowledge_base`, `rag_playbooks`, `tenant_vectors`— y no toca
esta tabla.)

**Medido, no supuesto.** Con la pregunta *"¿Cómo diseño un paywall para mi
producto?"* por el camino real de recuperación:

```
1. 0.5808 INTERNO  Wizard Rapido Optimizado — ICP y Paywall Visual
2. 0.5797 INTERNO  Wizard Rapido Optimizado — ICP y Paywall Visual
3. 0.5677 INTERNO  Wizard Rapido Optimizado — ICP y Paywall Visual
4. 0.5474          playbook-validacion
5. 0.5433 INTERNO  Wizard Rapido Optimizado — ICP y Paywall Visual
6. 0.5422 INTERNO  Wizard Rapido Optimizado — ICP y Paywall Visual
```

**5 de 6 lugares.** Lo que quedaba expuesto: metas de conversión
(`quick→paid: >2%`), la mecánica del paywall (*"bloqueo selectivo para demostrar
valor y empujar upgrade"*), la regla de fricción, y el costo de inferencia
(*"Claude Haiku ~$0.10/request vs $1.00 con Opus"*).

Y peor: un nodo titulado **`CAC Customer Acquisition Cost — SaaS B2B`**, de 9.381
caracteres, cuyo contenido entero es una respuesta de NotebookLM que **inventaría
nuestra documentación interna** — nombra `AUDITORIA_BACKEND_FRONTEND` ("análisis
de endpoints, código muerto y problemas de arquitectura") y `CLAUDE.md`. Sobrevivió
a CAL-1 porque tiene miles de caracteres "útiles": el filtro detecta restos de
plantilla, no un texto que habla de otra cosa.

**Qué se hizo** (21 chunks, respaldo completo en
`public.knowledge_nodes_respaldo_internos`):

| Documento | Acción | Por qué |
|:---|:---|:---|
| `Wizard Rapido Optimizado — ICP y Paywall Visual` | **borrado entero** (14 chunks) | Los 14 son spec interna. Sin valor de dominio |
| `CAC Customer Acquisition Cost — SaaS B2B` | **borrado** (1 chunk) | Inventario de documentación interna. No contiene nada sobre CAC |
| `Data Storytelling Engine — Market Signals…` | **6 chunks borrados de 11** | Se conservan TPM, UF, IPC, USD/CLP y la fuente `mindicador.cl`, que sí son dominio |

**⚠️ Anular el embedding NO habría servido.** Era la mitigación obvia —
reversible, no borra nada— y es falsa: `fetch_nodes_pending_embedding` devuelve
**todos** los nodos con `embedding` nulo, y el job `embeddings_pendientes` los
revectoriza. La mitigación habría durado hasta la siguiente corrida.

Eso además invalida retroactivamente la **Opción B de CAL-1** ("quitarles el
embedding, menos limpio pero reversible"): no era reversible, era temporal. Si se
hubiera elegido, los 49 nodos habrían vuelto a ser recuperables solos y la
línea base habría "empeorado" sin que nadie tocara nada.

**Resultado**

| | Antes | Después |
|:---|---:|---:|
| Nodos | 725 | **704** |
| Títulos | 212 | **210** |
| Aristas | 477 | **465** |
| Huérfanas | 0 | **0** |

Las 12 aristas que se fueron son exactamente las de los dos documentos que
desaparecieron enteros — su cascada **debe** correr. `Data Storytelling`
conservó sus 5 chunks de dominio y no perdió aristas propias: las 2 que sí
perdió iban hacia los dos documentos borrados, que es lo correcto.

Verificado en la recuperación: la consulta del paywall ya no devuelve **ningún**
nodo interno, y *"¿Cómo calculo el CAC de mi startup SaaS?"* ahora devuelve
`CAC — Costo de Adquisición de Cliente`, `Benchmark LTV:CAC > 3:1` y
`Payback Period` — conocimiento real que el nodo inventario venía desplazando.
Las 12 consultas de referencia siguen en 72/72 nodos con contenido: sin
regresión.

---

#### CAL-3b · Lo que sigue abierto

Un nodo titulado `Test`, categoría `normativa`, contenido *"Test content para
validacion chilena"* — recuperable en producción.

Más 14 nodos con menos de 120 caracteres útiles, varios cuyo "contenido" es una
lista de nombres de otros nodos (`"Playbook de Validacion de Ideas, Producto IA
y Blue Ocean"`). Eso no es conocimiento: es una relación mal guardada.

**Criterios de aceptación**
- [ ] `Test` borrado.
- [ ] Cada uno de los 14 clasificado como: contenido legítimamente corto / relación disfrazada de contenido / basura.
- [ ] Los de la segunda categoría se convierten en **aristas** o se borran — no se dejan como texto.
- [ ] Queda escrito el umbral por debajo del cual un nodo no debería ser recuperable.

**Resultado esperado:** una regla explícita, no un juicio caso a caso.

**Esfuerzo.** 2 h.

---

# FASE 2 — Que no vuelva

### CAL-4 · Encontrar y arreglar el generador

✅ **El filtrado, HECHO y verificado en CI** — submódulo
`validateai-knowledge-vault`, commit `7f09452`, pusheado el 2026-08-05.

⛔ **Pero la ingesta no llega: el pipeline vault → grafo está roto, y no por
este cambio.** Ver *"El sync no puede escribir"* al final del ticket.

#### El generador es `sync_obsidian_ast.ts`

El vault de Obsidian es la **fuente** de estos nodos, no una copia. Su commit
`49d3452` se llama *"Sprint 7 nodes — Wizard Rápido, Capital Efficiency, Data
Storytelling"*: los documentos internos que hubo que retirar de producción
salieron de ahí.

Eso también quiere decir que **nada de lo borrado se perdió**. Las tres notas
siguen en el vault, versionadas.

#### El umbral era el origen exacto de los 49

```ts
if (content.length > 20) { nodes.push(...) }     // antes
```

`"Relacionado con: , , ,"` mide **22 caracteres**. Pasaba como contenido. Hoy el
umbral se aplica sobre `contenidoUtil()`, espejo de `public.contenido_util(text)`.

**La confirmación no es un argumento, es una medición:** el `--dry-run` retiene
**exactamente 49 chunks**, los mismos 49 que hubo que borrar de producción, y
todos con `header_path = 'Introduccion'`.

#### El vault ahora declara audiencia

```yaml
audiencia: interna          # la nota entera se queda en el vault
secciones_no_publicar:      # o sólo estas secciones
  - "Prompt type: market_signals"
```

`audiencia: interna` corta **antes** de recorrer el AST, así que tampoco publica
sus `[[WikiLinks]]` — si no, quedarían aristas hacia un documento que nunca va a
existir.

El nivel de sección no es un lujo: la nota del Data Storytelling Engine explica
la TPM, la UF y el IPC —conocimiento útil para un fundador— al lado del color
del botón que los muestra. Publica 5 de sus 11 secciones, que son exactamente
las que quedaron en producción.

#### Un defecto encadenado que sólo apareció al probar

Las 7 notas con la sección `Answer` mal titulada, al retenerla, publicaban
**cero nodos pero sí sus aristas**, con `source_title` apuntando a un documento
inexistente. Con `trg_knowledge_edges_extremos` vivo, eso no corrompe el grafo:
**hace fallar el lote entero** con `foreign_key_violation`. Ahora una nota que
no publica ningún nodo tampoco publica aristas.

Se agregó `--dry-run`, que era lo que faltaba para poder probar el filtrado sin
escribir en la base, y todo lo retenido se reporta por consola.

| | |
|:---|---:|
| A publicar | 522 nodos, 135 aristas |
| Retenido | 1 nota interna, 15 secciones, **49 chunks sin contenido útil** |

#### El sync no puede escribir — y hace rato

El push del 2026-08-05 corrió en GitHub Actions y **el filtrado dio idéntico al
`--dry-run`**: 522 nodos, 135 aristas, 1 nota interna, 15 secciones, 49 chunks.
Esa parte está verificada en CI, no sólo en mi máquina.

**Pero la ingesta falló y el grafo no cambió en nada:** 697 nodos, 203 títulos,
424 aristas, `updated_at` sin mover, 0 de los documentos que no deben volver.
Falló entero, sin estado parcial.

**El error, con el status que faltaba:**

```
Enviando a .../functions/v1/api-v1/vault/ingest...
ERROR en ingest: HTTP 504 Gateway Timeout
  content-type: (ninguno)
  cuerpo: (vacío)
```

160 segundos exactos, dos veces. Sin `content-type` y sin cuerpo: eso no es una
respuesta de la aplicación, es el gateway cortando.

##### La causa, medida

Sondeando el endpoint desde afuera con una clave **inválida** —que debería
rechazar en el acto— sale un escalón nítido:

| Cuerpo | Respuesta |
|---:|:---|
| 21 KB | `401` en 1,7 s |
| 131 KB | `401` en 0,6 s |
| 438 KB | `401` en 0,7 s |
| 548 KB | `401` en 0,6 s |
| **626 KB** | **nunca responde** |

**El sync manda 626 KB.** Y el corte ocurre *antes* de la autenticación: con esa
misma clave inválida, cualquier tamaño por debajo del umbral devuelve `401` en
menos de un segundo. El cuerpo no llega a leerse entero, la conexión queda
colgada y a los 160 s el gateway devuelve 504.

⚠️ **Corrección.** Mi primera hipótesis fue que la causa era el stub 501 de
`ingestVaultHandler` (`routes/ingest.ts`), o el cierre de acceso del 2026-08-04
que exige API key. **Las dos estaban mal**: un 501 responde al instante y con
cuerpo JSON, y un 401 también. La petición no llega a ninguno de los dos.

##### Por qué ahora y no antes

La última corrida exitosa fue el **2026-06-12**. No hubo ninguna entre esa y la
de hoy, así que el vault cruzó el umbral de tamaño en algún momento del medio y
nadie se enteró: **no hubo una corrida que fallara**, simplemente no hubo
corridas.

##### Lo que NO se puede concluir todavía

Que la ingesta funcionaría con un cuerpo más chico. Nada llegó nunca al handler,
así que no sabemos qué hace el desplegado. El repositorio dice que
`POST /vault/ingest` es un **stub 501 desde el 2026-07-29** — pero eso está sin
verificar contra producción.

**El arreglo obvio es trocear el envío, y no es seguro hacerlo a ciegas:**
`docs/INGESTA_PIPELINE.md` describe la ingesta como *"DELETE + INSERT por
`source='obsidian_vault'` y prefijo de título"*. Si cada petición borra antes de
insertar, mandar en lotes dejaría **sólo el último lote**. Hay que leer el
handler desplegado antes de trocear.

##### Consecuencia para este plan

El riesgo de que "el próximo sync recree lo borrado" **hoy no existe**: el sync
no llega a escribir. Marcar las notas sigue siendo lo correcto para cuando la
ingesta vuelva, pero no era algo a punto de deshacer la limpieza.

##### Consecuencia para el producto, más grande que este plan

El vault de Obsidian es donde se escribe el conocimiento y **no llega al grafo**.
Ticket propio, y no de calidad de contenido.

---

*(Texto original del ticket:)*

Los 36 vacíos se crearon el **2026-06-12** con `header_path = 'Introduccion'`.
El andamiaje de NotebookLM apunta a un pipeline de ingesta con fecha
`2026-05-24`.

Mientras el generador siga produciendo esto, la limpieza es un parche.

**Criterios de aceptación**
- [ ] Identificado el código que produjo el prefijo y el andamiaje.
- [ ] Corregido, o documentado como retirado si ya no se usa.
- [ ] Un chunk sin contenido útil **no se inserta** — la validación va en el generador, no aguas abajo.

**Resultado esperado:** el pipeline no puede volver a crear un nodo vacío
recuperable.

**Esfuerzo.** 2–3 h (depende de dónde esté).

---

### CAL-5 · Guardarraíl en la base

Análogo a los triggers de integridad de aristas: la base impide el estado malo
en vez de confiar en que nadie lo produzca.

**Opciones a evaluar:**
- `CHECK` que rechace `content` vacío o sólo-plantilla.
- Trigger que ponga `embedding = NULL` si el contenido no supera un mínimo útil —
  **más suave y probablemente mejor**: el nodo existe pero deja de ser
  recuperable, sin romper inserts legítimos de chunks cortos.

**Criterios de aceptación**
- [ ] Un nodo con contenido vacío no puede quedar con embedding.
- [ ] Los generadores actuales siguen funcionando (relevamiento previo, como se hizo con las aristas).
- [ ] Verificado contra la base con rollback.

**Resultado esperado:** "nodo recuperable sin contenido" pasa a ser un estado
imposible, no una convención.

**Esfuerzo.** 2 h.

---

# FASE 3 — Verificar el efecto

### CAL-6 · Probar el RAG antes y después

✅ **CAL-6a HECHO.** Línea base tomada el 2026-08-05, antes de tocar nada.
`validateai-financial-worker/scripts/rag_baseline.py`, salida en
`scripts/rag_baseline_out/antes.json`. Corregí el diagnóstico con lo medido —
ver más abajo.

Todo lo anterior es hipótesis hasta que se mida en la salida.

**Criterios de aceptación**
- [x] Un conjunto de ~10 consultas de referencia sobre los temas afectados (Ley Fintech, Ley de Datos, PMF, Unit Economics, constitución de SpA…). **12 consultas.**
- [x] Ejecutado **antes** de la limpieza, guardado.
- [ ] Ejecutado **después**, comparado.
- [ ] Documentado: cuántas devolvían un encabezado sin contenido antes, y cuántas después (esperado: 0).

**Resultado esperado:** evidencia de que el contexto mejoró, no la suposición de
que mejoró. **Verificar el efecto, no el status.**

**Esfuerzo.** 2 h.

---

#### Línea base — 2026-08-05, antes de tocar nada

Se mide el **Markdown que `assemble_context` le pone al modelo**, no la respuesta
del LLM: ahí está el defecto y es determinista. Los embeddings de las 12
consultas quedan cacheados y se reutilizan en la corrida "después", para que una
diferencia no pueda venir del vector de la pregunta.

| Métrica | Antes |
|:---|---:|
| Consultas con al menos un nodo basura | **8 de 12** |
| Encabezados sin contenido útil | **15** |
| Nodos recuperados | 72 |
| Nodos basura recuperados | **15 (21 %)** |
| Encabezados literalmente sin cuerpo | 0 |

#### Tres correcciones al diagnóstico, todas por haber medido

**1. El encabezado NO llega vacío. Llega con basura debajo — y eso es peor.**

Este plan decía que el modelo recibe "un encabezado y ningún texto". Falso. La
métrica "encabezado sin cuerpo" dio **0 en las 12 consultas**. Lo que recibe es:

```
### Mom Test — Framework Entrevistas de Validacion [VECTOR] — metodologia
Relacionado con: , , , Asked on 2026-05-24T09:33:34.628Z against NotebookLM notebook
```

Un encabezado que promete un framework de entrevistas, y debajo la afirmación de
una lista de relaciones **vacía**. Un hueco visible invita a decir "no tengo el
dato"; esto se lee como contenido y no señala nada.

**2. Son 49, no 36.** Con la definición de contenido útil aplicada de verdad:
44 con plantilla o andamiaje, más **5 nodos que son puro frontmatter YAML**
(`--- titulo: … fechaactualizacion: … ---`). Esa familia **no estaba en el
diagnóstico**: apareció al leer la salida real de la consulta `mom-test`.

**3. El chunk vacío no es ruido incidental: sale PRIMERO.**

`_build_embed_text` vectoriza `f"{document_title}. {content}"`. Con `content`
vacío, **el vector del chunk es el del título**, así que es un match más puro a
una pregunta con forma de título que cualquier chunk real, cuyo vector está
diluido por párrafos de detalle. Medido:

```
¿Cómo me afecta la Ley 21.719 de protección de datos personales?
  1. rel=0.6823  útil=    0   Ley 21.719 Proteccion de Datos Personales  ← BASURA
  2. rel=0.6792  útil=  838   Ley 21.719 Proteccion de Datos Personales

¿A qué programas de CORFO puede postular mi startup?
  1. rel=0.7393  útil=    0   Programas CORFO para Startups Chile        ← BASURA
  2. rel=0.7242  útil=  658   Programas CORFO para Startups Chile
```

**Le gana a los chunks reales de su propio documento** y se queda con el primer
lugar de un presupuesto de 6. Cada consulta regulatoria recuperó el chunk vacío
del documento exacto por el que preguntaba: Ley 21.719, CMF/UAF, SpA, laboral,
CORFO. El nodo menos capaz de responder es el que mejor rankea.

**Peor caso: `mom-test`, 5 de 6 nodos basura.** Para "¿cómo hago entrevistas de
validación sin sesgar al entrevistado?" —pregunta central del producto— el
modelo recibe un solo chunk con conocimiento real.

Esto sube la prioridad de CAL-2 y CAL-3: no son limpieza cosmética detrás de
CAL-1, son la mayor parte del daño medido.

---

## Orden y dependencias

```
CAL-0 (defecto del trigger)  ──►  CAL-1 (borrar vacíos)  ──┐
                                                            ├─►  CAL-6 (verificar)
CAL-6 (línea base ANTES)  ──►  CAL-2, CAL-3  ──────────────┘
                                    │
                                    └──►  CAL-4 (generador)  ──►  CAL-5 (guardarraíl)
```

**La línea base de CAL-6 hay que tomarla ANTES de tocar nada.** Sin eso no se
puede demostrar la mejora, sólo afirmarla.

| # | Ticket | Bloquea a | Esfuerzo |
|:--|:---|:---|:---|
| 1 | ~~**CAL-0** — arreglar la cascada del trigger~~ ✅ | CAL-1 | 1 h |
| 2 | ~~**CAL-6a** — línea base del RAG~~ ✅ | la verificación | 1 h |
| 3 | ~~**CAL-1** — borrar los vacíos (49)~~ ✅ | — | 1 h |
| 4 | ~~**CAL-2** — prefijo y andamiaje~~ ✅ sin trabajo, CAL-1 lo cubrió | — | 0 h |
| 5 | **CAL-3** — `Test`, casi vacíos y contenido mal titulado | — | 🟡 3a hecho |
| 6 | ~~**CAL-4** — el generador~~ ✅ sin desplegar | CAL-5 | 2–3 h |
| 7 | **CAL-5** — guardarraíl en la base | — | 2 h |
| 8 | **CAL-6b** — verificación final | — | 1 h |

**Total estimado: 12–13 h.**

---

## Resultado esperado del plan completo

1. **Ningún nodo recuperable sin contenido.** Hoy hay 36, todos con embedding, y todos son documentos centrales del producto.
2. **Ningún resto del proceso de ingesta en el contexto del modelo.** Hoy hay 39 con prefijo de plantilla y 30 con andamiaje de NotebookLM.
3. **El estado malo es imposible de crear**, no sólo está limpiado.
4. **Evidencia medida** de que las consultas sobre normativa chilena devuelven contenido y no un encabezado vacío.

## Riesgos y decisiones abiertas

- **CAL-1 es destructivo.** Se borran 36 filas. Mitigado con respaldo completo y con la verificación de que los 36 tienen chunk hermano con contenido — pero es un borrado.
- **CAL-2 modifica contenido y obliga a revectorizar.** Eso gasta OpenAI. 39 nodos es despreciable, pero hay que contarlo.
- **CAL-3 pide criterio.** Dónde termina "contenido corto legítimo" y empieza "basura" no sale de una consulta.
- **CAL-5 puede endurecer de más.** Un `CHECK` estricto rompería inserts legítimos; por eso la opción de anular el embedding es preferible al rechazo.

## Lo que este plan NO hace

- No toca la migración de `knowledge_edges` a ids con FK, que sigue pendiente como causa raíz de fondo.
- No reescribe el contenido de ningún nodo. Limpiar restos de plantilla no es lo mismo que generar conocimiento: si un documento tiene poco contenido real, eso es un problema de ingesta y se trata en CAL-4, no rellenándolo.
