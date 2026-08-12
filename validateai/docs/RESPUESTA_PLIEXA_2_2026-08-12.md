# Segunda respuesta de Animus Engine a PLIEXA

**Fecha:** 12/08/2026
**De:** equipo Animus Engine / Bralidus RaaS
**Para:** equipo PLIEXA
**Responde a:** `RESPUESTA_A_ANIMUS_2026-08-12.md`

Gracias por la comparación de huellas: cerró el caso mejor de lo que lo habríamos
cerrado nosotros. Y tienen razón en que el pedido de errores estructurados se
sostiene igual — un mensaje que junta tres causas les costó un día aunque el
`401` fuera correcto.

Este documento trae **una corrección a lo que les dijimos ayer** y las respuestas
a sus cinco consultas. Todo remedido contra producción hoy.

---

## 0. Su consulta #1: A1/A2 no tienen fecha porque ya están desplegados

**Filtros y orden están en producción desde hoy**, verificados de punta a punta.
No hay que esperar nada ni planificar alrededor de una fecha.

```
?region=Biobío                        → meta.total 5.395
?region=Biobío&status=publicada       → meta.total 2.860
?closing_from=2026-08-12&sort=closing_at&order=asc → 4.890, cierre más próximo primero
?buyer_name=MUNICIPALIDAD             → meta.total 22.064
?amount_min=1                         → 52.592, sin presupuestos ocultos
?sort=inventado                       → 400 INVALID_PARAM
```

Parámetros: `region`, `buyer_rut`, `buyer_name`, `amount_min`, `amount_max`,
`closing_from`, `closing_to`, `sort` (`closing_at`|`published_at`|
`amount_estimated`) y `order`. **Van sobre el universo y se reflejan en
`meta.total`** — los contrastamos contra la base y coinciden exacto.

Dos cosas que conviene que sepan antes de integrarlos:

- **Filtrar por monto excluye los presupuestos ocultos.** 7.935 procesos tienen
  `amount_is_public = false` y **los 7.935** traen `amount_estimated = 0`.
  Incluirlos en un `amount_max` los mostraría como gratis. Si necesitan verlos,
  consulten sin filtro de monto y separen por `amount_is_public`.
- **Con cualquiera de estos filtros no hay respaldo en la fuente en vivo.** Ese
  respaldo sólo sabe filtrar por `q` y `type`: contestaría una búsqueda por
  región con procesos de todo Chile. Preferimos devolver cero.

---

## 1. Corrección: los adjuntos de licitación NO se descargan

Ayer les dijimos que en licitación había **"5.584 fichas con URL real de
descarga"**. Fuimos a comprobarlo por su consulta #4 y **está mal**.

La URL responde `HTTP 200`, pero devuelve **4.683 bytes de `text/html`**: una
página titulada *"Ver anexos"* protegida por **reCAPTCHA Enterprise**, que exige
un token y un POST a `ViewAttachment.aspx?ajax=1` para llegar al archivo. No es
una descarga y no es automatizable.

Nuestro propio payload nunca lo prometió — `descargable: false` en las 5.584 —,
pero nuestra prosa sí. Conclusión corregida:

> **Las bases y anexos no son obtenibles por API en ninguna vía de compra.**
> Ni abiertas ni cerradas, ni compra ágil ni licitación.

Esto **refuerza la decisión de producto que ya tomaron** en su §4: enlazar a
`official_url` y decirle a la usuaria que abra la ficha es, hoy, el único camino
correcto. Lamentamos que la corrección llegue después de su documento; llega
antes de que construyeran sobre ella, que era lo que importaba.

---

## 2. Su consulta #2 — el límite de `/ofertas` es de la FUENTE, y va a crecer

Es lo primero, no lo segundo: no es que nos falte extraer.

| Estado de la compra ágil | Compras | Con ofertas | % |
|:---|---:|---:|---:|
| `adjudicada` | 2.633 | **2.633** | **100 %** |
| `desierta` | 174 | 165 | 94,8 % |
| `revocada` | 1.253 | 324 | 25,9 % |
| `cerrada` | 12.840 | **0** | **0 %** |
| `publicada` | 27.645 | 0 | 0 % |

**Cuando una compra ágil llega a `adjudicada`, tenemos sus oferentes el 100 % de
las veces.** El 7 % de cobertura global no mide nuestra extracción: mide cuántas
compras llegaron a adjudicarse. Las 12.840 `cerrada` ya no reciben ofertas pero
todavía no publican quién compitió — ahí la fuente aún no entrega el dato.

**Sí, diseñen para que crezca.** Hay 12.840 compras cerradas esperando
adjudicación y 27.645 abiertas detrás. La cobertura sube sola.

Y lo que **no** va a crecer: licitaciones, convenios marco y tratos directos no
publican oferentes en esta fuente. No hay equivalente y no lo va a haber por
este camino.

---

## 3. Su consulta #3 — la tasa de adjudicación: definición y por qué hoy es peligrosa

**La calculamos nosotros.** Definición exacta:

```
tasa_adjudicacion_pct = (ofertas con adjudicada = true / total de ofertas del RUT) × 100
```

- **Población:** todas las filas de ese RUT en `mp_ofertas`, no la página
  devuelta. Es una consulta aparte, así que el número no depende de `page_size`.
- **Exclusiones:** ninguna. **Las ofertas declaradas inadmisibles cuentan en el
  denominador** (2.583 de 16.919 lo son). Un proveedor que cotizó mal cinco veces
  arrastra esas cinco.
- **Redondeo:** un decimal.
- **`monto_adjudicado`** suma `monto_total` de las ganadas.

### Ahora, la parte que importa para no presentarla mal

**El período es de 16 días.** `fecha_cotizacion` va del **2026-07-27 al
2026-08-11**. No es un histórico del proveedor: es lo que alcanzamos a ingerir.

**Y los denominadores son diminutos:**

| Ofertas del proveedor | Proveedores | % |
|:---|---:|---:|
| **1** | **2.180** | **54,6 %** |
| 2–4 | 1.171 | 29,3 % |
| 5–9 | 340 | 8,5 % |
| 10–49 | 252 | 6,3 % |
| 50+ | 47 | 1,2 % |

**El 54,6 % de los proveedores tiene exactamente una oferta**: su tasa es 0 % o
100 %. El 83,9 % tiene menos de cinco.

Sugerencia concreta, y la damos porque nos la pidieron para no presentarla mal:
**no muestren el porcentaje por debajo de un mínimo de muestras.** Con `n < 10`
mostrar "1 de 1 adjudicada" dice la verdad; "100 % de adjudicación" no. Sólo 299
proveedores (7,5 %) llegan a 10 ofertas.

Es el mismo criterio que ya aplicamos en `/precios` con `fiabilidad` y
`ratio_p75_p25`. Deberíamos exponer ahí un campo equivalente; queda anotado como
deuda nuestra.

### Un límite nuestro que les toca saber

El resumen consulta sin paginar y **PostgREST corta en 1.000 filas por defecto**.
Hoy el proveedor más activo tiene **269 ofertas**, así que el número es correcto
— pero cuando alguien cruce las 1.000, la tasa se volverá silenciosamente falsa.
Lo vamos a arreglar antes de que pase.

---

## 4. Su consulta #4 — la URL del adjunto de compra ágil no se puede construir

No, y por dos razones independientes.

**La fuente sólo entrega dos campos.** Lo que llega en el detalle es:

```json
"documentos": [{ "id": 1768272, "nombre": "Especificación Compra Agil (insumos).docx" }]
```

Un entero y un nombre. No hay ruta, token ni extensión de servicio.

**Y el patrón de licitación no es reutilizable**, porque no se deriva de un id:
usa `ViewAttachment.aspx?enc=<token cifrado>`. Aunque lo copiáramos, ya vimos en
§1 que ese destino está detrás de un captcha.

### De paso, un problema de forma que sí les va a pegar

`attachments` tiene hoy **tres formas distintas** conviviendo:

| Forma | Filas | Dónde |
|:---|---:|:---|
| `{id, nombre, url}` | 31.668 | compra ágil (relleno histórico) |
| `{descargable, id, nombre, origen, tipo, url}` | 238 | compra ágil (ingesta nueva) |
| `{…, obtenido_at}` | 5.669 | licitación, convenio marco, trato directo |

Si escriben código que lea `descargable` o `tipo`, va a venir `undefined` en el
**99 %** de las compras ágiles. Vamos a normalizarlo; mientras tanto, traten esos
campos como opcionales.

---

## 5. Su consulta #5 — `amount_estimation_type`: no hay más valores

Confirmado, y con la distribución real:

| Valor | Significado | Filas |
|---:|:---|---:|
| `null` | La vía no reporta el campo | 44.836 |
| `1` | Presupuesto disponible | 10.370 |
| `2` | Precio referencial | 5.321 |
| `3` | No estimable | **1** |

Dos advertencias:

- **`null` no es "desconocido": es "esta vía no lo informa".** Casi todo el
  `null` es compra ágil, donde el presupuesto siempre es público
  (`amount_is_public = true`). No lo pinten como dato faltante.
- **El valor `3` aparece una sola vez en 60.528 filas.** No construyan una rama
  de interfaz para él; si aparece, es una rareza y conviene que lo traten como
  el caso genérico.

---

## 6. Sobre B5, que es lo único que les bloquea

Entendido que es funcionalmente bloqueante y que no hay fecha externa que lo
apure. No les vamos a dar una fecha inventada, pero sí dos cosas útiles:

**Es más barato ahora que ayer.** Los filtros de §0 ya construyen la consulta
sobre el universo; un endpoint de facetas es esa misma consulta agrupada. La
forma que tenemos en mente:

```
GET /mercado-publico/facetas?<mismos filtros que opportunities>
→ { por_via: {...}, por_estado: {...}, por_region: {...}, por_rango_monto: {...}, total }
```

**Y mientras tanto tienen una salida parcial hoy mismo:** con los filtros nuevos,
`meta.total` con `page_size=1` les da el conteo de cualquier corte sin traerse
los datos. Cuatro llamadas de 3 créditos les arman un tablero de vías, y una por
región les arma el mapa. No es una faceta —son N llamadas— pero desbloquea
mostrar cifras reales en vez de la demo, que era el objetivo.

---

## 7. Sobre la ventana de ingesta (su §5, frescura)

Acá hay una trampa que preferimos avisar antes de que la muestren.

**`updated_at` no es "cuándo cambió el dato en Mercado Público": es cuándo
escribimos esa fila.** Y hoy las **60.528 filas tienen `updated_at` de hoy**,
porque la migración que abrió el expediente las tocó todas. Si derivan
"actualizado hace X" de ahí, ahora mismo van a decir "hace minutos" para procesos
que no cambiaron.

Lo mismo vale para la antigüedad que reporta `health`: se calcula como
`now - max(updated_at)`, así que después de un relleno masivo informa frescura
que no corresponde al origen.

La cadencia real de ingesta es **diaria**. Seguimos sin comprometer un SLA, pero
esa es la operación de hecho. Si quieren decir "actualizado hace X" con
propiedad, `published_at` y `closing_at` sí vienen de la fuente y no los toca
ninguna migración.

---

## 8. Lo que nos llevamos de su documento

- **La comparación de huellas.** Cerró el caso sin exponer ninguna clave y nos
  ahorró buscar en logs algo que no existía. Confirmado: no hay `request_id` que
  rastrear y el `401` fue correcto.
- **Errores estructurados:** tomado, y su caso lo justifica mejor que nuestro
  razonamiento. `API_KEY_INVALID` distinguible de `API_KEY_REVOKED`, con `code`,
  `retryable` y `request_id`.
- **`whoami`:** confirmado como no bloqueante, va después de lo anterior.
- **Que hayan corregido el expediente** para dejar de prometer datos que no
  llegan nos importa más que cualquier endpoint que podamos entregarles.

---

## Anexo · Cómo medimos

Todo del 12/08/2026, después de su documento.

**Base de producción**, sólo lectura: cobertura de ofertas cruzada con
`status_code` de la compra ágil; distribución de ofertas por `proveedor_rut`;
rango de `fecha_cotizacion`; `amount_estimation_type` agrupado; claves de
`attachments->0` agrupadas por `source_type`; `updated_at` por día.

**Fuera del gateway:** una petición `GET` a una URL de adjunto de licitación,
siguiendo el redirect, para comprobar qué devuelve realmente. Es lo que reveló el
captcha y motivó la corrección de §1.

**Gateway desplegado:** los seis casos de filtros de §0.
