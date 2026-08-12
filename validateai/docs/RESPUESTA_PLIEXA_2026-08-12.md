# Respuesta de Animus Engine a los requerimientos de PLIEXA

**Fecha:** 12/08/2026
**De:** equipo Animus Engine / Bralidus RaaS
**Para:** equipo PLIEXA
**Responde a:** `REQUERIMIENTOS_ANIMUS.md` del 12/08/2026

Gracias por el documento: está medido, es específico y varias cosas que reportan
eran nuestras y no de ustedes. Encontramos **un error de documentación nuestro
que los indujo a un diagnóstico equivocado** y **cuatro requerimientos que ya
están en producción** desde el mismo día en que midieron.

Todo lo que sigue está medido contra la base de producción el **12/08/2026**. Los
números llevan fecha a propósito: el descuadre que reportan en su punto 5.1 nació
justamente de publicar cifras sin fecharlas.

---

## 1. Lo primero: su clave del MCP casi seguro NO está revocada

El gateway **nunca responde la palabra "revocada"**. Ese texto es nuestro: el
cliente MCP traduce cualquier `401` a *"es inválida, fue revocada o no se está
enviando"*. Están leyendo nuestra redacción y concluyendo revocación.

Como su integración REST autentica con normalidad, la causa más probable es que
**la clave no está llegando** desde la configuración del MCP — típicamente el
bloque `env` del `claude_desktop_config.json`:

```json
{ "mcpServers": { "animus": {
    "command": "npx", "args": ["-y", "animus-engine-mcp"],
    "env": { "ANIMUS_API_KEY": "su_clave" } } } }
```

Su pedido de **errores estructurados** es correcto y este caso lo demuestra:
juntar tres causas distintas en un solo texto produjo un diagnóstico falso.
Queda tomado.

---

## 2. Ya está en producción (midieron unas horas antes)

El backfill que abre el expediente de licitación terminó el **12/08**. Si
remiden hoy, esto ya está:

| Su requerimiento | Estado real | Cobertura medida |
|:---|:---|:---|
| **A4 · región** | ✅ Disponible | `buyer_region` en **60.528 de 60.528** filas, las cuatro vías |
| **A4 · comuna** | ⚠️ Parcial | `buyer_commune` sólo en licitación: 14.330/15.669 (91 %). Compra ágil: 0 |
| **B1 · cronograma** | ✅ Disponible | Licitación ~100 %: foro (inicio/fin), publicación de respuestas, apertura técnica y económica, adjudicación y firma estimadas. Compra ágil no tiene esas etapas |
| **B4 · calidad del monto** | ✅ Disponible | El campo que piden (`amount_available: false`) ya existe como **`amount_is_public`**, poblado al 100 %, más `amount_estimation_type` (1=Presupuesto, 2=Referencial, 3=No estimable) y `amount_justification` |
| **B3 · contacto** | ⚠️ Parcial | Contacto del comprador **100 %**, dirección **92 %**, nombre del responsable de contrato **90 %**. **Email y teléfono: 0 de 15.983** — MP devuelve la clave y nunca la llena |

**Sobre B4 en particular:** su 34 % sin monto no es un fallo de mapeo. **7.935
procesos tienen `amount_is_public = false`, y los 7.935 traen
`amount_estimated = 0`.** El organismo ocultó el presupuesto. Con
`amount_is_public` pueden distinguir "oculto" de "cero real", que es exactamente
lo que pedían.

---

## 3. A3 · Documentos — su prioridad #1, con un matiz que cambia la respuesta

Acá **nuestra documentación estaba mal** y la corregimos. Decíamos que en
licitación los adjuntos "van vacíos siempre porque la fuente no los expone". Es
falso. Lo medido:

| Vía | Fichas con documentos | ¿Enlace de descarga? | En procesos **abiertos** |
|:---|---:|:---|---:|
| Compra ágil | 31.906 | ❌ `url` en null (sólo `id` y `nombre`) | **936 de 1.162 (81 %)** |
| Licitación | 5.584 | ✅ **URL real de `ViewAttachment.aspx`** | **0 de 2.273** |

La conclusión honesta, y la mala noticia: **en licitación los adjuntos aparecen
recién cuando el proceso cierra.** Para preparar una oferta sobre un proceso
abierto, las bases no están disponibles por API en ninguna de las dos vías. En
compra ágil sí tienen la *lista* de documentos de los procesos abiertos (81 %),
pero sin enlace.

Mientras tanto, `official_url` apunta a la ficha web donde sí están. Decirles
"no existe" habría sido incorrecto y los habría mandado a buscar donde no hay.

---

## 4. Implementado hoy a partir de su documento

### A1 · Filtros de servidor y A2 · orden configurable

`GET /mercado-publico/opportunities` acepta ahora, **sobre el universo filtrado y
reflejado en `meta.total`**:

| Parámetro | Nota |
|:---|:---|
| `region` | Coincidencia parcial. Ej: `Biobío` → 289 abiertas hoy |
| `buyer_rut` | Exacto |
| `buyer_name` | Coincidencia parcial |
| `amount_min` / `amount_max` | Ver la advertencia de abajo |
| `closing_from` / `closing_to` | ISO 8601 |
| `sort` | `closing_at` \| `published_at` \| `amount_estimated` |
| `order` | `asc` \| `desc` |

**El orden por defecto es `published_at desc`** — no estaba mal, faltaba
declararlo. Para "las que cierran primero": `?sort=closing_at&order=asc`.

⚠️ **Filtrar por monto excluye los presupuestos ocultos.** Los 7.935 procesos con
`amount_is_public = false` traen `amount_estimated = 0`; incluirlos en un
`amount_max` los mostraría como si fueran gratis. Si necesitan verlos, consulten
sin filtro de monto y separen por `amount_is_public`.

⚠️ **Con cualquiera de estos filtros no hay fallback a la fuente en vivo.** Ese
fallback sólo sabe filtrar por `q` y `type`: contestaría una búsqueda por región
con procesos de todo Chile. Preferimos devolver cero antes que devolver algo que
no cumple lo que pidieron — es el mismo problema que estos filtros vienen a
resolver.

**Estado: desplegado y verificado en producción el 12/08.** Comprobado contra la
API real, no sólo contra la base:

| Caso | Resultado |
|:---|:---|
| Sin filtros | `meta.total` = 60.528 |
| `?region=Biobío` | 5.395 — coincide exacto con la base |
| `?region=Biobío&status=publicada` | 2.860 |
| `?status=desierta` | 1.802 |
| `?closing_from=2026-08-12&sort=closing_at&order=asc` | 4.890, ordenadas de cierre más próximo |
| `?buyer_name=MUNICIPALIDAD` | 22.064 |
| `?amount_min=1` | 52.592 — **cero** presupuestos ocultos filtrados |
| `?sort=inventado` | 400 `INVALID_PARAM` |
| `?region=Narnia` | 0 resultados, `source: mercado_publico` — **no** cae al fallback |

`meta.total` refleja el universo filtrado en todos los casos, que era el punto
de A1.

---

## 5. Sus aclaraciones, con datos

**5.1 · Los conteos no son inconsistentes: nuestra documentación estaba vieja.**
`health` tiene razón. Sumadas las cuatro vías hoy:

| Vía | Filas |
|:---|---:|
| `agile_purchase` | 44.545 |
| `tender` | 15.669 |
| `convenio_marco` | 274 |
| `trato_directo` | 40 |
| **Total** | **60.528** |

El 38.305 de nuestra documentación era del **04/08**. La tabla creció **58 % en
ocho días**. Ya corregimos las cifras y de ahora en adelante van con fecha.

**5.2 · Identidad.** Ambas están soportadas y garantizadas por código: los dos
endpoints de detalle (`/opportunities/:id` y `/licitaciones/:codigo`) detectan si
el valor es UUID o `external_code` y resuelven igual. Para guardar identidad
interna recomendamos **`external_code`**: es el identificador de Mercado Público,
estable y verificable contra la ficha oficial.

**5.3 · Estabilidad de la paginación.** No hay garantía hoy. El orden es por
`published_at desc` sobre una tabla que se actualiza a diario, así que una
inserción entre dos páginas puede correr un registro. Tomamos el pedido de cursor
o snapshot. Mitigación inmediata: paginar con `sort=published_at` acotando por
`closing_from`/`closing_to`, que fija la ventana.

**5.4 · Enums de `status`.** Son **cinco**, no dos:

| `status` | Filas |
|:---|---:|
| `publicada` | 32.146 |
| `cerrada` | 16.293 |
| `adjudicada` | 8.483 |
| `revocada` | 1.804 |
| `desierta` | 1.802 |

**5.5 · Tamaño de página.** El máximo es **100** (piden 10/25/50). Suban a 100 y
bajan sus llamadas a la mitad — el costo en créditos es por petición, no por
registro.

**5.6 · Frescura.** La ingesta corre a diario; el último `updated_at` de hoy es
de las 14:35 UTC. No tenemos un SLA comprometido todavía y preferimos no
inventarlo: si necesitan uno para su producto, díganlo y lo definimos.

---

## 6. Corrección importante: están sobrestimando su consumo ~8×

Su tabla declara 25 créditos por `opportunities` y 15 por el detalle.
**Se les cobra 3 y 3.**

El 25 es `tokens_used`, telemetría interna del costo, **no** la unidad que se
cobra. La unidad es el **crédito** y `/mercado-publico/*` cuesta **3**.

Y no necesitan estimarlo: **ya emitimos estos headers en cada respuesta.**

| Header | Contenido |
|:---|:---|
| `X-RateLimit-Limit-Credits` | Tope del período |
| `X-RateLimit-Remaining-Credits` | Saldo restante |
| `X-RateLimit-Request-Cost` | Lo que costó **esta** petición |
| `X-RateLimit-Tier` | Su plan |

Verificado en vivo hoy sobre una petición a `opportunities`:
`x-ratelimit-request-cost: 3`.

⚠️ **Y encontramos por qué quizás no los estaban viendo: era un bug nuestro.** La
configuración CORS declaraba como header expuesto `x-ratelimit-remaining`, un
nombre que **no existe** — los reales llevan sufijo `-credits`. Como el navegador
sólo entrega los headers declarados ahí, desde código de browser eran
**ilegibles**. El dato viajaba en cada respuesta y no los dejábamos leerlo, que
es probablemente la razón por la que terminaron estimando.

**Corregido y desplegado hoy.** Ahora se exponen los cuatro:

```
access-control-expose-headers: content-length, x-ratelimit-limit-credits,
  x-ratelimit-remaining-credits, x-ratelimit-request-cost, x-ratelimit-tier
```

Con eso, su panel de admin puede mostrar saldo real en vez de una estimación que
se reinicia con el servidor. **B6 queda resuelto salvo el `whoami` gratuito**,
que tomamos como pedido nuevo y válido.

---

## 7. Lo que sí está disponible por REST hoy (sección 6 de su documento)

**Todo.** El MCP no es un canal aparte: es un cliente HTTP sobre este mismo
gateway. Cada herramienta tiene su endpoint REST.

| Lo que preguntan | Endpoint REST | Créditos |
|:---|:---|---:|
| `animus_mp_ofertas` — **su prioridad #1** | `GET /mercado-publico/ofertas?codigo=` o `?rut=` | 3 |
| `animus_mp_organismos` | `GET /mercado-publico/organismos` | 3 |
| `animus_economic_macro` | `GET /data/macro` | 1 |
| `animus_rag_search` | `POST /rag/query` | 5 |

**No tienen que esperar nada para el módulo de Competencia.** Cobertura medida
hoy: **16.919 ofertas de 3.990 proveedores sobre 3.122 compras, con 2.633
adjudicaciones y 2.583 motivos de inadmisibilidad.** Con `?rut=` viene además la
tasa de adjudicación del proveedor. Sin `codigo` ni `rut` responde 400 a
propósito.

**Su pregunta sobre el límite:** sí, se limita a **compras ágiles concluidas** —
3.122 de 44.545 (7 %). **No hay equivalente para licitaciones**: esa vía no
publica oferentes en esta fuente. Un `codigo` sin ofertas casi siempre significa
"proceso abierto o no es compra ágil", no "nadie se presentó".

⚠️ **`/organismos` tiene un bug que les afecta.** No lee un directorio: pagina
sobre las 60.528 oportunidades y deduplica sólo dentro de cada página. Un mismo
comprador reaparece entre páginas y `meta.total` informa compras, no compradores.
**Los organismos distintos son 2.705**, no los 33.682 que decía nuestra
documentación. Está en nuestra cola; hasta entonces no usen `meta.total` como
conteo de organismos.

---

## 8. Lo que no vamos a poder darles con esta fuente

**B2 · criterios de evaluación con ponderación, garantías exigidas y requisitos
de habilidad.** Revisamos el payload crudo de las fichas de licitación guardadas
(15.387 al momento de esa revisión, el 11/08): **ninguna trae esas claves**. No
es un problema de mapeo nuestro, la API v1 de Mercado Público no las expone.

Conseguirlo exige otra fuente — la ficha web o el portal de Datos Abiertos — y es
una decisión de alcance, no una tarea. Preferimos decirlo ahora antes que
dejarlo en un backlog que nunca avanza.

Lo mismo para el **email y teléfono del responsable de contrato**: la fuente
devuelve la clave vacía en las 15.983 fichas.

---

## 9. Estado por requerimiento

| | Requerimiento | Estado |
|:---|:---|:---|
| A1 | Filtros de servidor | 🟢 **Desplegado y verificado en prod hoy** |
| A2 | Orden configurable | 🟢 **Desplegado y verificado en prod hoy** |
| A3 | Documentos oficiales | 🟡 Parcial y acotado — ver §3 |
| A4 | Región y comuna | 🟢 **Ya en producción** (comuna sólo licitación) |
| B1 | Cronograma | 🟢 **Ya en producción** (licitación) |
| B2 | Criterios y garantías | 🔴 No disponible en esta fuente |
| B3 | Contacto | 🟡 Nombre/dirección sí; email y teléfono no existen |
| B4 | Calidad del monto | 🟢 **Ya en producción** (`amount_is_public`) |
| B5 | Facetas y agregados | ⚪ Tomado, sin fecha |
| B6 | Saldo de créditos | 🟢 Headers ya disponibles + **bug de CORS corregido hoy** · ⚪ `whoami` tomado |

---

## 10. Lo que les pedimos

1. **Remidan A4, B1 y B4** — están en producción y su documento los da por
   faltantes.
2. **Corrijan el cálculo de créditos** en su panel: usen
   `X-RateLimit-Request-Cost` en vez de estimar. Están contando ~8× de más.
3. **Manden el `request_id` o la hora exacta** de una llamada del MCP que falló
   con "revocada" y lo rastreamos en nuestros logs.
4. **Suban `page_size` a 100** para bajar llamadas y costo.
5. Si el `whoami` y las facetas (B5) son bloqueantes para una fecha concreta de
   ustedes, díganlo y los priorizamos.

---

## Anexo · Cómo medimos

Dos fuentes, ambas del 12/08/2026:

**Base de producción**, consultas de sólo lectura: conteos por `source_type`,
cobertura columna por columna del expediente, `jsonb_array_length(attachments)`
cruzado con `closing_at > now()`, distribución de `status_code`,
`count(distinct buyer_org_code)`, y agregados de `mp_ofertas`. Los porcentajes de
cobertura son sobre el total de cada vía, no sobre muestra.

**API desplegada**, con una clave de prueba creada y revocada para la ocasión:
los nueve casos de la tabla de §4, más la lectura de los headers de cuota. Los
totales de la API coinciden exactamente con los de la base, que es lo que
confirma que los filtros van sobre el universo y no sobre la página.
