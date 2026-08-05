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
| Contenido útil = **0 caracteres** | **36** | **Sí, los 36 tienen embedding** |
| Prefijo de plantilla `"Relacionado con: , , ,"` | 39 | Sí |
| Andamiaje `"Asked on … against NotebookLM notebook"` | 30 | Sí |
| Contenido útil entre 1 y 120 caracteres | 14 | Sí |
| Nodo literal `Test` / *"Test content para validacion chilena"* | 1 | Sí |

### Qué son exactamente los 36 vacíos

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

El mecanismo: el vector search recupera el chunk vacío, `assemble_context` lo
inyecta como `### Ley 21.521 Fintech Chile — Regulación Completa [VECTOR] —
normativa` **sin contenido debajo**, y el modelo ve un encabezado que promete
normativa fintech chilena y nada que leer. Completa el hueco con conocimiento
paramétrico y el usuario recibe regulación inventada con formato de cita.

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

### CAL-1 · Los 36 chunks vacíos

Depende de **CAL-0**. No ejecutar antes.

Tres opciones, en orden de preferencia:

| Opción | Qué implica |
|:---|:---|
| **A. Borrar los 36** | El contenido vive en los chunks hermanos. No se pierde nada, y con CAL-0 arreglado las aristas quedan intactas |
| **B. Quitarles el embedding** | Dejan de ser recuperables pero siguen en la tabla. Menos limpio, reversible |
| **C. Completar el contenido** | Requiere regenerar la introducción de 36 documentos. Caro y no aporta: la introducción no es dato |

**Recomendada: A**, con respaldo previo.

**Criterios de aceptación**
- [ ] Respaldo de las 36 filas completas (incluido `embedding`) antes de borrar.
- [ ] `select count(*) from knowledge_nodes where <contenido útil> = 0` devuelve **0**.
- [ ] El grafo sigue en **0 aristas huérfanas**.
- [ ] Los 36 documentos conservan sus chunks con contenido: `Ley 21.521…` sigue teniendo 28 filas y 17.137 caracteres.
- [ ] Una consulta al RAG sobre "Ley Fintech 21.521" devuelve **contenido**, no un encabezado vacío.

**Resultado esperado:** ningún nodo recuperable sin contenido. El RAG deja de
poder entregar un título sin nada debajo.

**Esfuerzo.** 1 h.

---

### CAL-2 · El prefijo de plantilla y el andamiaje

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

Todo lo anterior es hipótesis hasta que se mida en la salida.

**Criterios de aceptación**
- [ ] Un conjunto de ~10 consultas de referencia sobre los temas afectados (Ley Fintech, Ley de Datos, PMF, Unit Economics, constitución de SpA…).
- [ ] Ejecutado **antes** de la limpieza, guardado.
- [ ] Ejecutado **después**, comparado.
- [ ] Documentado: cuántas devolvían un encabezado sin contenido antes, y cuántas después (esperado: 0).

**Resultado esperado:** evidencia de que el contexto mejoró, no la suposición de
que mejoró. **Verificar el efecto, no el status.**

**Esfuerzo.** 2 h.

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
| 2 | **CAL-6a** — línea base del RAG | la verificación | 1 h |
| 3 | **CAL-1** — borrar los 36 vacíos | — | 1 h |
| 4 | **CAL-2** — prefijo, andamiaje y revectorización | — | 2 h |
| 5 | **CAL-3** — `Test` y los casi vacíos | — | 2 h |
| 6 | **CAL-4** — el generador | CAL-5 | 2–3 h |
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
