# API Estadística del Poder Judicial — qué sirve y qué no

Auditoría empírica de `https://estadisticaservices.pjud.cl`, hecha el 2026-07-30
recorriendo los 137 endpoints del swagger uno por uno.

Existe porque la especificación **no documenta nada**: sin descripciones, sin
summaries, sin ejemplos y sin catálogo de valores. Todo lo de abajo salió de
probar, no de leer.

---

## Lo primero: no hay códigos que descubrir

La suposición natural al ver `/{corte}/{tribunal}/{competencia}/{anio}` es que hay
un catálogo de códigos por conseguir. **No lo hay: esos parámetros son
decorativos.**

Verificado comparando respuestas byte a byte variando un parámetro a la vez:

| Parámetro | ¿Cambia la respuesta? | Evidencia |
|---|---|---|
| `anio` | **Sí** | 6 respuestas distintas para 2020-2025 |
| `corte` | No | 7 valores (0, 1, 5, 12, 17, 30, 90) → respuesta idéntica |
| `tribunal` | No | 6 valores → idéntica |
| `competencia` | No | 7 valores → idéntica |

`/pjen/adquisiciones/{corte}/2024` devuelve el mismo total nacional
(76.493.244,31) para cualquier `corte` entre 0 y 60.

**Consecuencia de diseño:** las series son **nacionales por año**. Cualquier
segmentación territorial hay que sacarla del *contenido* de la respuesta, no de
la ruta. `/cuenta-publica/terminos-cortes` sí trae desglose por región en su
payload, que es la única vía real a datos territoriales.

---

## Inventario real: 37 de 137 endpoints devuelven datos

Barrido con `anio=2024` y el resto de parámetros en `1`:

| Resultado | Cantidad |
|---|---|
| **Con datos** | **37** |
| Vacío `[]` | 76 |
| HTTP 500 | 14 |
| Vacío `[{key:"OTROS",value:0}]` | 8 |
| `null` | 2 |

Los 14 que dan 500 son la familia "Quantum" (`civil/`, `penal/`, `laboral/`,
`cobranza/`, `familia/` con `resumen_anual`, y `corte/grafico`). Corresponden a
su BI interno y no responden públicamente con ninguna combinación de parámetros
ni año que se haya probado.

---

## Lo que sí sirve, por familia

### 1. Corte Suprema — el dato granular (8 endpoints)

Lo más valioso de toda la API. Los `_detalle` **no son agregados**: son causa por
causa.

| Endpoint | Filas (2024) | Peso | Descarga | Contenido |
|---|---|---|---|---|
| `/pjen/terminos_suprema_detalle/{c}/{a}` | 95.075 | 36,5 MB | 5,3 s | 14 campos: causa, sala, fechas de ingreso y fallo, grupo de término |
| `/pjen/terminos_sala_suprema_detalle/{c}/{a}` | 95.075 | 36,5 MB | 5,3 s | ⚠️ **duplicado exacto del anterior** — ver abajo |
| `/pjen/ingresos_recursos_suprema_detalle/{c}/{a}` | 62.009 | 21,1 MB | 3,0 s | recursos ingresados, con `MATERIA` y sala |
| `/pjen/inventario_suprema_detalle/{c}/{a}` | 7.469 | 2,2 MB | 0,4 s | causas en inventario, con `MATERIA_PROTECCION` |
| `/pjen/duracion_causas_suprema/{c}/{a}` | 7 | — | 1,1 s | duración promedio por tipo de recurso |

`duracion_causas_suprema` trae `{key, value, prom}` — duración media por vía de
tramitación (ej. "CUENTA (SECRETARIA)": 17,2 días vs promedio 91,7).

### Tres cosas que hay que saber antes de ingerir esto

**1. `terminos_sala_suprema_detalle` es el MISMO endpoint con otro nombre.**
Devuelve un payload idéntico byte a byte a `terminos_suprema_detalle`: mismo
SHA256, mismos 36.536.309 bytes. No es "lo mismo desglosado por sala". Ingerir
las dos serían 95.075 filas duplicadas por año. Se ingiere sólo una.

**2. La API es rápida; el cuello está en escribir.** Una primera medición dio
44 s para 2 MB y de ahí se dedujo que estas series no cabían en una función
serverless. Era falso: medía la lentitud del cliente HTTP usado para probar
(PowerShell atragantándose con payloads grandes), no la de la fuente. Con `curl`
los 36,5 MB llegan en 5,3 s. Lo que hay que resolver es la escritura: 95.075
filas de a una son 95.075 viajes a la base.

**No pagina:** `?page`, `?limit` y `?offset` se ignoran; siempre devuelve el
conjunto entero. El troceo va del lado del consumidor.

**3. La identidad de una fila no es la causa.** `(LIBRO, ROL, ANO_ROL)` parece la
clave natural y no alcanza para los términos: 95.075 filas dan 95.064
combinaciones. Los 11 casos **no son duplicados** — son causas terminadas dos
veces (Familia|241225|2023 aparece "Inadmisibles" el 2024-01-25 y "Rechazados"
el 2024-12-16). Hay que incluir `FECHA_FALLO`.

Además la fuente **sí publica repeticiones reales**: en 2025,
`terminos_suprema_detalle` trae dos veces la causa Criminal|59045|2024 fallada
el 2025-12-15, idéntica en los 14 campos. Si las dos caen en el mismo INSERT,
Postgres rechaza el statement completo (*"ON CONFLICT DO UPDATE command cannot
affect row a second time"*) y se pierde el lote entero. Hay que deduplicar antes
de escribir.

**Los campos varían entre filas** de una misma respuesta (hay filas de términos
con `SALA_FALLO` y otras sin él), y la fuente agrega columnas sin avisar: esta
tabla listaba 4 campos y el endpoint devuelve 14. Conviene guardar la fila cruda.

Implementado en `sync-pjud-suprema` → tabla `pjud_suprema_detalle`.

### 2. Cuenta Pública — nacional, año contra año (6 endpoints)

Sin parámetros, consumibles directo. Forma:
`{Anio_actual, Anio_anterior, Categoría, Variación %}`.

- `/cuenta-publica/ingresos-causas` — causas ingresadas por competencia
- `/cuenta-publica/terminos-causas` — causas terminadas
- `/cuenta-publica/tramitacion-causas` — en tramitación
- `/cuenta-publica/terminos-cortes` — **por región** (17 filas: Arica, etc.)
- `/cuenta-publica/actividades` — actividades institucionales
- `/cuenta-publica/textos/{anio}` — 134 párrafos del discurso de cuenta pública

### 3. El Poder Judicial como comprador público (varios)

Cruza directo con lo que ya tenemos de Mercado Público:

- `/pjen/adquisiciones/{c}/{a}` — gasto por mecanismo: `LICITACIÓN PÚBLICA`,
  `CONVENIO MARCO`, `TRATO DIRECTO`, `LICITACIÓN PRIVADA`, `COMPRA ÁGIL`
- `/pjen/presupuesto/{c}/{a}`, `/pjen/ejecucion/{c}/{a}`, `/pjen/evolucion/{c}/{a}`,
  `/pjen/versus/{c}/{a}` — presupuesto, ejecución y comparación con el sector

Las mismas categorías que usa ChileCompra. Permite ver al PJUD **como comprador**
dentro de Licitus.

### 4. Institucional (varios)

`dotacion_sexo`, `dotacion_unidad`, `capacitaciones`, `becas`, `consejo`,
`proyecto`. Series de RR.HH. y gestión, con histórico desde 2010-2015 en la misma
respuesta.

---

## Qué NO es esta API

No es la Oficina Judicial Virtual. **No permite consultar una causa individual.**
No entrega partes ni litigantes, escritos ni resoluciones, movimientos procesales,
documentos del expediente, ni búsqueda por RIT/RUC/rol.

Los `_detalle` de la Suprema traen `ROL`, pero como fila de un listado
estadístico — no hay endpoint para consultar un rol puntual.

**Cómo presentarlo:** inteligencia judicial **agregada** (duración, carga por
jurisdicción, materias frecuentes, tasas de término, congestión, presupuesto).
Nunca como seguimiento de expedientes.

---

## Notas operativas

- **Sin autenticación.** El swagger no declara `security`, `securityDefinitions`
  ni API keys. Verificado: responde sin cabeceras.
- **Sin rate limit observado** en ~300 requests con 200-250 ms de intervalo.
  Aun así conviene espaciar: es infraestructura pública.
- **`anio=2025` viene vacío** en las series que se probaron. El corte de datos
  parece ser el año anterior completo.
- **Los payloads no están normalizados**: conviven `{key, value}`,
  `{key, text, value}`, `{ITEM, MONTO, ANO}` y
  `{Anio_actual, Anio_anterior, Categoría, Variación %}`. Las claves traen
  acentos y espacios (`Categoría`, `Variación %`), lo que obliga a mapear con
  cuidado en cualquier lenguaje que no cite las claves.

---

## Estado de lo que ya había en el repo

`webhook-pjud` está **desplegada y ACTIVE en producción, pero su código no está
en el repo**. Su `entrypoint_path` apunta a `/tmp/user_fn_...` y su `updated_at`
es igual al `created_at`: se desplegó una vez a mano y nunca se versionó.

Es un receptor pasivo con HMAC que espera que *alguien empuje* datos hacia
`temp_context`. `docs/INTEGRACIONES_ARQUITECTURA.md` deja la pregunta abierta:

> *"¿Hay un proveedor que nos empuja datos de PJUD? ¿O esto requiere integrarse
> con un intermediario?"*

**Esta auditoría la responde: no hace falta ninguno.** La API se consulta
directo. La ingesta por pull reemplaza al webhook, no lo complementa.

### Qué dice el código, una vez recuperado (2026-07-30)

Se bajó el fuente desplegado con `supabase functions download webhook-pjud`.
Tres hallazgos, en orden de gravedad:

**1. La verificación de firma no verifica nada.** `verifyHmacSignature()` importa
la clave HMAC y después ignora todo y hace `return true`, con este comentario:

> *"Para simplificar el mock, omitiremos la verificación real en este código
> boilerplate"*

O sea que el `if (!isValid)` de abajo nunca se cumple. Cualquier payload con un
header `x-pjud-signature` cualquiera pasa el control.

**2. Escribe con service role a partir de ese payload.** El handler toma
`payload.metadata.user_id` y `payload.metadata.validation_id` del cuerpo —sin
validarlos contra nada— y los inserta con un cliente creado con
`SUPABASE_SERVICE_ROLE_KEY`, que salta RLS. La función tiene `verify_jwt: true`,
pero la anon key es un JWT válido para ese control y es pública por diseño.
Combinado con el punto 1, el gate real es ninguno.

**3. Escribe a una tabla que no existe.** No hay `temp_context` en la base. Todo
insert falla y la función devuelve 500. Nunca funcionó.

**Conclusión: sobra y conviene borrarla.** No es que esté sin usar — es que no
puede funcionar, espera callbacks de un servicio que no los emite, y mientras
tanto es una escritura con service role detrás de un control de firma apagado.
Lo que sí anda es la ingesta por pull: `sync-pjud.job.ts` → `pjud_estadisticas`.

El fuente recuperado **no se versiona a propósito**: `deploy-functions.yml`
dispara con `validateai/supabase/functions/**`, así que commitearlo la
redesplegaría. Queda citado acá y se borra del árbol.
