# Tercera respuesta de Animus Engine a PLIEXA

**Fecha:** 13/08/2026
**De:** equipo Animus Engine / Bralidus RaaS
**Para:** equipo PLIEXA
**Responde a:** sus dos reportes del 12/08 (`include_hidden_amounts` ignorado y cifras viejas en la documentación del MCP)

Los dos reportes eran correctos y los dos están resueltos. Pero **lo primero de
este documento no es eso: es una advertencia**, porque desplegamos un cambio que
puede romperles algo sin que sepan por qué.

---

## ⚠️ 1. Cambio de contrato: un parámetro desconocido ahora devuelve 400

Ustedes señalaron la inconsistencia —rechazábamos `sort=inventado` y tragábamos
cualquier otro parámetro— y tenían razón. **Ya está corregido, y eso los afecta.**

`GET /mercado-publico/opportunities` y `/facetas` ahora rechazan cualquier
parámetro que no reconozcan:

```json
{
  "error": "Parámetro desconocido: foo. Aceptados: q, type, status, …",
  "code": "INVALID_PARAM",
  "retryable": false,
  "parametros_desconocidos": ["foo"],
  "parametros_aceptados": ["q", "type", "…"]
}
```

**Revisen qué mandan antes de que les falle.** Esta es la lista completa:

```
q · type · status · region · buyer_rut · buyer_id · buyer_name
amount_min · amount_max · closing_from · closing_to · include_hidden_amounts
sort · order · page · page_size · limit
```

Si mandan algo fuera de esa lista —un `_cachebust`, un `utm_*`, un parámetro
propio— la petición pasa de devolver resultados a devolver 400. Antes se
ignoraba en silencio, que era el problema que reportaron.

Si necesitan alguno que no esté, díganlo y lo agregamos: preferimos ampliar la
lista antes que volver a tragar parámetros.

---

## 2. `include_hidden_amounts` ya existe y hace algo

Tenían razón en las dos mitades: no funcionaba, y el hecho de que aceptara el
parámetro sin aplicarlo era peor que rechazarlo.

Filtrar por monto sigue excluyendo por defecto los procesos con presupuesto
oculto —los 7.935 con `amount_is_public = false`, cuyo `amount_estimated = 0` no
es un cero real— y ahora se pueden pedir:

| Consulta | `meta.total` |
|:---|---:|
| `?amount_min=0` | 52.593 |
| `?amount_min=0&include_hidden_amounts=true` | **60.528** |

La diferencia son exactamente los 7.935. Para auditoría es probable que lo
quieran en `true`; para "qué puedo cotizar", en `false`.

---

## 3. B5 · Facetas: lo único que declararon bloqueante

`GET /mercado-publico/facetas` acepta **los mismos filtros** que
`/opportunities` y devuelve conteos sobre el universo filtrado:

```json
{
  "data": {
    "total": 60528,
    "por_via":    { "tender": 15669, "agile_purchase": 44545, "convenio_marco": 274, "trato_directo": 40 },
    "por_estado": { "publicada": 32146, "cerrada": 16293, "adjudicada": 8483, "revocada": 1804, "desierta": 1802 },
    "por_rango_monto": { "0_1m": 31888, "1m_10m": 22608, "10m_100m": 3980, "100m_mas": 2052 },
    "con_monto_oculto": 7935
  },
  "meta": { "filtros_aplicados": { … } }
}
```

Cuesta lo mismo que una búsqueda (3 créditos) y cuenta en el servidor sin
transferir filas. Con `?region=Biobío` el total baja a 5.395 y las vías suman
exacto.

**`con_monto_oculto` va aparte a propósito.** Si repartieran el total entre los
tramos de monto sin él, les faltarían 7.935 registros y el tablero mostraría un
agujero sin explicación: esos procesos no tienen monto conocido, no tienen monto
cero.

Los filtros de `/opportunities` y `/facetas` se calculan con el mismo código
compartido. Si no fuera así, los conteos del tablero no cuadrarían con la
búsqueda y no habría forma de saber cuál de los dos miente.

---

## 4. Errores estructurados

Lo pidieron dos veces. Todas las respuestas de error del gateway traen ahora:

| Campo | Para qué |
|:---|:---|
| `code` | Ramificable. `API_KEY_INVALID` ≠ `API_KEY_REVOKED` ≠ `AUTH_REQUIRED` |
| `retryable` | La única pregunta que un cliente automático necesita hacerse |
| `credits_charged` | Siempre `0` en errores. No estaban cobrándose, y no tenían cómo saberlo |
| `request_id` | En el cuerpo **y** en el header `X-Request-Id` |

El caso que les costó un día ahora se distingue solo:

```
clave que no existe   → 401 · API_KEY_INVALID  · "La clave SÍ está llegando, revisá que no sea una anterior"
clave revocada        → 403 · API_KEY_REVOKED  · "Generá una nueva; copiar la misma no va a servir"
sin clave             → 401 · AUTH_REQUIRED
```

Si algo falla, mándennos el `request_id` y lo ubicamos.

---

## 5. Por qué no veían los headers de crédito: era un bug nuestro

Al implementar lo anterior encontramos la causa probable de que estuvieran
**estimando** su consumo en vez de leerlo.

La configuración CORS declaraba como header expuesto `x-ratelimit-remaining`, un
nombre **que no existe** — los reales llevan sufijo `-credits`. Como el navegador
sólo entrega los headers declarados ahí, desde código de browser eran
**ilegibles**. El dato viajaba en cada respuesta y no los dejábamos leerlo.

Corregido. Ahora se exponen los cinco:

```
x-ratelimit-limit-credits · x-ratelimit-remaining-credits
x-ratelimit-request-cost  · x-ratelimit-tier · x-request-id
```

---

## 6. `animus_mp_ordenes` — quién cobró, no sólo quién ganó

Hasta ahora el MCP llegaba a la adjudicación y se cortaba. `animus_mp_ofertas`
dice quién ganó; **nada decía quién terminó facturando**.

**124.868 órdenes con contenido · 21.621 proveedores · 1.129 organismos ·
2016 → 2026.** Es el dataset más profundo que tenemos de Mercado Público: las
ofertas cubren 16 días, esto cubre diez años.

También por REST: `GET /mercado-publico/ordenes-compra`, con
`rut_proveedor`, `codigo_organismo`, `estado`, `fecha` y `fecha_fin`.

**Dos límites que conviene saber antes de construir encima:**

- **43.961 órdenes están pendientes de enriquecimiento** y no se devuelven —
  serían un identificador con forma de dato. La cantidad viaja en
  `meta.enriquecimiento_pendiente`. Se completan solas: el proceso drena unas
  5.000 por día. Un total que no cuadre con otra fuente casi siempre es esto.
- **El cruce con la licitación funciona en pocos casos, y el campo engaña.**
  `licitation_code` nunca es null, así que un chequeo por `is not null` da
  124.868 y parece que todas cruzan. Son cadenas **vacías**: 72.708 vienen en
  blanco, 52.160 traen código, y de esos sólo **3.159** corresponden a una
  licitación que tengamos — las órdenes arrancan en 2016 y nuestra tabla de
  licitaciones cubre lo reciente. Verifiquen que no venga vacío antes de
  intentar el cruce, y no lean un cruce fallido como "esta orden no tuvo
  licitación".

---

## 7. Su segundo reporte: la documentación del MCP

Correcto y bien apuntado. Las cifras viejas seguían en el **README del paquete**
—lo que se lee en npmjs.com—: decía 13.990 licitaciones cuando hoy son 15.669.
Actualizamos las descripciones de las herramientas el 12/08 y nunca el README,
que es justamente la documentación que ustedes miran.

Corregido, con la fecha al lado y un puntero al dato vivo: `meta.total` de
`/opportunities` sin filtros es siempre la cifra actual.

**Publicado en npm: `animus-engine-mcp@0.1.8`**, que trae todo lo de este
documento.

---

## 8. Corrección: los organismos son 1.786, no 2.705

En nuestra respuesta anterior les dijimos que los organismos distintos eran
2.705, corrigiendo los 33.682 que decía nuestra documentación. **También estaba
mal**, y por el mismo defecto: contar una columna sin preguntarse qué guarda.

`buyer_org_code` tiene **un RUT en compra ágil** (44.545 filas) y **un código
interno en licitación** (15.983). El mismo organismo aparece dos veces: el MOP
figura como `61.202.000-0` y como `7067`. Agrupando por ahí se suman dos espacios
de nombres distintos.

`/mercado-publico/organismos` ahora agrupa por `buyer_rut` —el mismo
identificador en las cuatro vías— y devuelve **1.786 entidades reales**, con
paginación y `meta.total` correctos. Ya no repite compradores entre páginas.

Cada fila trae además `region`, `compras`, `compras_abiertas`,
`ultima_publicacion`, `vias` (por qué canales compra ese organismo) y
`codigos_organismo` (los identificadores internos que aparecen en la ficha
oficial). Es lo que necesitaban para sus fichas de organismo.

---

## 9. Estado de sus requerimientos

| | Requerimiento | Estado |
|:---|:---|:---|
| A1 | Filtros de servidor | 🟢 En producción |
| A2 | Orden configurable | 🟢 En producción |
| A3 | Documentos oficiales | 🔴 No obtenibles por API en ninguna vía — ver doc anterior §1 |
| A4 | Región y comuna | 🟢 En producción |
| B1 | Cronograma | 🟢 En producción |
| B2 | Criterios y garantías | 🔴 No existen en esta fuente |
| B3 | Contacto | 🟡 Nombre y dirección sí; email y teléfono no existen |
| B4 | Calidad del monto | 🟢 En producción · ahora con `include_hidden_amounts` |
| B5 | Facetas y agregados | 🟢 **En producción** |
| B6 | Saldo de créditos | 🟢 Headers legibles desde browser · ⚪ `whoami` pendiente |

Queda pendiente de nuestro lado el `whoami` gratuito, que ustedes mismos
marcaron como no bloqueante, y un cursor de paginación estable.

---

## 10. Lo que les pedimos

1. **Revisen los parámetros que envían** contra la lista de §1. Es lo único de
   este documento que puede romperles algo.
2. **Digan si les falta algún parámetro** en esa lista y lo agregamos.
3. **Suban a `animus-engine-mcp@0.1.8`** si usan el MCP.
4. Si integran órdenes de compra, **lean los dos límites de §6** antes de
   diseñar el cruce con licitaciones.

---

## Anexo · Cómo medimos

Todo verificado contra producción entre el 12 y el 13/08/2026: los conteos de
facetas contrastados contra la base y coincidentes fila por fila; el efecto de
`include_hidden_amounts` medido en ambos sentidos; los tres códigos de error de
autenticación provocados con claves reales creadas y revocadas para la ocasión;
y el cruce de `licitation_code` contado contra la tabla canónica.
