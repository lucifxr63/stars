# Solicitud a ChileCompra: acceso programático a los adjuntos

**Estado:** redactada, sin enviar — 2026-08-13
**Bloquea:** cualquier funcionalidad del ecosistema que necesite leer las bases,
EETT o anexos de un proceso (RAG sobre bases, verificación de requisitos,
armado automático de ofertas).

Lo que se pide **no es información reservada**: los mismos archivos están
publicados en www.mercadopublico.cl y cualquiera los baja con un navegador. Lo
que falta es el canal legible por máquina. Eso hace que la solicitud sea de
*forma de acceso*, no de desclasificación, y conviene decirlo así desde la
primera línea.

---

## 1. Por qué hay que pedirlo (medición del 2026-08-13)

Se probaron las cuatro vías existentes contra procesos reales. Ninguna entrega
un archivo.

| Vía | Prueba | Resultado |
|:---|:---|:---|
| API v1 `publico/licitaciones.json` + ticket | `2065-15-LE26` | 200 OK, 52 campos (`Items`, `Adjudicacion`, `Fechas`…). **Ningún campo de adjuntos.** |
| OCDS `/tender/{codigo}` | `2065-15-LE26`, `1057506-29-LE26` | 200 OK, 7 y 9 releases, **0 documentos** en ambos |
| OCDS `/award/{codigo}` | `1057506-29-LE26` | 2 documentos, ambos `format: "text/html"`, título "Página documentos del proceso de contratación". Es un enlace a una página, no a un archivo. Sólo existe en procesos **adjudicados** |
| API v2 `v2/compra-agil/{codigo}` + ticket | `2324-778-COT26` | 200 OK. Devuelve `{"id":1771232,"nombre":"ANEXO N°1 COMPRA AGIL 2324-778-COT26.docx"}` — **nombre real del archivo, sin URL de descarga** |

### El caso que resume el problema

`2735-968-COT26` — "ADQUISICIÓN DE: KITS ESCOLARES Y DEPORTIVOS", I. Municipalidad
de Lo Barnechea, publicada el 13-08-2026, cierre 20-08-2026.

Su propia descripción, tal como la publica el organismo, dice:

> "OFERTAS DEBEN CUMPLIR CON ESPECIFICACIONES Y CONDICIONES EN **ARCHIVO
> ADJUNTO**."

La API v2 devuelve sus seis documentos así:

```json
[{"id":1778997,"nombre":"04. Condiciones y plazos para la aceptación de la orden de compra.pdf"},
 {"id":1778998,"nombre":"03. Reglamento de Pago.pdf"},
 {"id":1779000,"nombre":"01. Cláusula de desempate Compra Ágil.pdf"},
 {"id":1778996,"nombre":"Compra Refuerzos Positivos Lazos.docx"}, …]
```

Seis nombres, seis identificadores, **ninguna URL**. Entre ellos, las condiciones
de aceptación de la orden de compra y la cláusula de desempate: las reglas con
las que se adjudica.

O sea que la API informa que existe un documento indispensable para ofertar, lo
identifica con un `id` estable, y no ofrece forma de obtenerlo. Un proveedor que
integre por API sabe que le falta algo y no puede llegar a ello; uno que use el
navegador, sí. **La brecha no es de información sino de canal**, y es exactamente
lo que esta solicitud pide cerrar.

Se probaron además cinco rutas plausibles de descarga en `api2.mercadopublico.cl`
(`/v2/documentos/{id}`, `/v2/compra-agil/{codigo}/documentos`, `/v2/adjuntos/{id}`,
y dos variantes). Las cinco responden `403 Missing Authentication Token`, que es
lo que el API Gateway devuelve ante una **ruta inexistente**. No hay endpoint de
descarga sin documentar esperando ser encontrado.

La página a la que apunta OCDS (`ViewAttachment.aspx`) está protegida con
reCAPTCHA Enterprise: valida un score y recién ahí redirige al listado. **Es un
control de acceso deliberado del emisor y no se sortea** — la regla del
ecosistema (ver `validateai-financial-worker/CLAUDE.md`, decidida el 2026-08-05)
es pedir acceso, no rodear el muro. Esta solicitud *es* ese pedido.

La propia documentación de ChileCompra marca el acceso a adjuntos como no
disponible por API.

## 2. Momento institucional a favor

- **Consulta ciudadana sobre evolución de APIs y datos abiertos**: abierta en
  diciembre de 2025, plazo ampliado hasta el 20 de febrero de 2026, resultados
  publicados en abril de 2026. El acceso a documentos adjuntos aparece entre lo
  demandado.
- **Nueva API de Compra Ágil**, presentada el 22 de mayo de 2026 en la Feria de
  Estado Abierto, en versión beta.

O sea: hay un proceso abierto, con canal formal, y la petición ya fue formulada
por otros. La solicitud se apoya en eso en vez de llegar de cero.

## 3. Texto para enviar

> Para el Portal de Transparencia (Ley 20.285) y/o el canal de contacto de APIs
> de ChileCompra. Completar los campos entre `<>` antes de enviar.

---

**Solicitante:** `<nombre>`, RUT `<rut>`, en representación de Scouttech
(`<razón social y RUT de la empresa>`)
**Contacto:** contacto@scouttech.lat
**Materia:** Acceso programático (API) a los documentos adjuntos de licitaciones
y compras ágiles

Junto con saludar, y en el marco de la consulta ciudadana sobre evolución de APIs
y acceso a datos abiertos convocada por esa Dirección, vengo a solicitar acceso
programático a los **documentos adjuntos** de los procesos de compra publicados
en www.mercadopublico.cl —bases administrativas y técnicas, especificaciones
técnicas, anexos y formularios—, hoy accesibles sólo por navegador.

Hago presente que **no se solicita información nueva ni reservada**: los archivos
ya son públicos y están disponibles en el sitio web institucional. Lo solicitado
es un **canal legible por máquina** hacia esos mismos documentos.

Fundo la solicitud en lo siguiente:

1. **Las APIs vigentes no exponen los adjuntos.** Verificado el 13 de agosto de
   2026 sobre procesos reales: la API v1 de licitaciones no incluye campo alguno
   de adjuntos; la API OCDS entrega documentos únicamente en procesos adjudicados
   y sólo como enlace a una página HTML, no al archivo; y la API v2 de Compra
   Ágil entrega el `id` y el `nombre` de cada archivo pero ningún enlace de
   descarga. El detalle técnico de estas pruebas se acompaña como anexo.

2. **La brecha es de un solo campo en un caso.** La API v2 de Compra Ágil ya
   identifica cada documento con un `id` estable. Bastaría con exponer un
   endpoint de descarga por ese `id`, o agregar la URL al objeto que ya se
   devuelve, para resolver ese mecanismo por completo.

   A modo de ejemplo, la Compra Ágil `2735-968-COT26` (I. Municipalidad de Lo
   Barnechea, publicada el 13-08-2026) señala en su descripción que "las ofertas
   deben cumplir con especificaciones y condiciones en archivo adjunto", y la API
   informa seis documentos —entre ellos las condiciones de aceptación de la orden
   de compra y la cláusula de desempate— con su identificador y su nombre, pero
   sin enlace de descarga. Un proveedor que integre por API queda en conocimiento
   de que existe un documento indispensable para ofertar, sin vía para obtenerlo.

3. **Para licitaciones, la vía natural es OCDS.** El estándar Open Contracting
   contempla `tender.documents` con `url` y `format` por documento. Hoy ese
   arreglo llega vacío en los procesos consultados y sólo se pueblan los
   documentos de adjudicación. Poblarlo alinearía la publicación chilena con el
   estándar que ya se declara implementar.

4. **El acceso por navegador no sustituye al canal API.** La página de anexos
   está protegida con reCAPTCHA Enterprise. Se respeta ese control y por eso se
   formula esta solicitud por la vía institucional, en lugar de intentar
   rodearlo.

En concreto solicito:

- **(a)** Endpoint de descarga de documentos de Compra Ágil por `id`, o inclusión
  de la URL de descarga en la respuesta actual de `v2/compra-agil/{codigo}`.
- **(b)** Poblamiento de `tender.documents` en los releases OCDS de licitaciones,
  con `url`, `title`, `format` y `documentType` por documento, en procesos
  abiertos y no sólo adjudicados.
- **(c)** En subsidio de lo anterior, mecanismo alternativo de acceso masivo
  —descarga por lotes en el portal de Datos Abiertos, o credencial de acceso
  ampliada asociada a un ticket registrado— junto con las condiciones de uso que
  esa Dirección estime aplicables.

Agradeceré indicar, si alguna de estas prestaciones está contemplada en la hoja
de ruta de las nuevas APIs, la fecha estimada de disponibilidad.

Saluda atentamente,
`<nombre>`

---

## 4. Anexo técnico para adjuntar

Adjuntar la tabla de la sección 1. Es lo que separa esta solicitud de un pedido
genérico: identifica el proceso probado, la respuesta obtenida y el campo que
falta, en vez de afirmar que "la API no sirve".

## 5. Qué hacer con la respuesta

- **Si conceden (a) o (b):** el cambio en `mp-sync` es acotado. El normalizador
  de Compra Ágil ya guarda `id` y `nombre` de cada documento
  (`normalizers/compra-agil.normalizer.ts`) con `url: null` y
  `descargable: false`; hay 55.371 registros esperando esa URL. Para licitaciones,
  `ocds.client.ts` ya consulta el release y mapea `documents`.
- **Si no responden o niegan:** no hay ruta técnica autorizada, y eso hay que
  decirlo en el producto en vez de rellenar el hueco. **Bajo ninguna
  circunstancia inventar un adjunto** — ya pasó una vez, ver la sección de
  `mp_attachments_downloader.py` en `validateai-financial-worker/CLAUDE.md`.
- **Plazo legal:** una solicitud por Ley 20.285 tiene 20 días hábiles de plazo de
  respuesta, prorrogable por 10 más. Si se envía por el canal de contacto de APIs
  en vez del Portal de Transparencia, no corre ese plazo.
