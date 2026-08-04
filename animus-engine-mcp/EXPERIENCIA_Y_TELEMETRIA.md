# Experiencia de usuario del MCP: qué vemos, qué no, y qué deberíamos recoger

Escrito el 2026-08-04 con datos de producción. Las afirmaciones de "no vemos X"
están comprobadas, no supuestas.

---

## 1. El recorrido real, y dónde se cae

Un usuario nuevo pasa por cinco puntos. Los cinco pueden fallar en silencio:

| # | Paso | Cómo falla | ¿Lo vemos? |
|---|:---|:---|:---|
| 1 | Instala Claude Desktop y edita el JSON | JSON mal formado, ruta equivocada | **No** |
| 2 | Pega su `ANIMUS_API_KEY` | La copia con espacios, o pega la equivocada | **No** |
| 3 | Primera llamada | 401, timeout, red corporativa que bloquea | **No** |
| 4 | Llamadas siguientes | Se queda sin cuota | **No** |
| 5 | Interpreta la respuesta | Lee mal el dato y publica algo falso | **No** |

Cinco de cinco. Hoy sólo vemos las peticiones que **funcionaron**.

---

## 2. Lo que no estamos viendo (comprobado)

### 2.1 Los rechazos son invisibles

Prueba directa contra producción:

```
filas antes:   112
-> 3 peticiones con key inválida (401) + 1 sin token
filas después: 112
```

Cuatro peticiones rechazadas, **cero filas registradas**.

La causa está en el orden de la cadena en `api-v1/index.ts`:

```
authMiddleware  →  rateLimitMiddleware  →  usageMiddleware  →  handler
```

`usageMiddleware` va al final. Cuando auth devuelve 401 o el limitador devuelve
429, ninguno llama a `next()`, así que el registro **nunca se ejecuta**.

Consecuencia práctica: no podemos responder "¿cuánta gente rebotó esta semana
por una key mal pegada?" ni "¿cuántos agotaron la cuota?". Para un producto
medido por créditos, no ver el agotamiento de cuota es no ver la señal de compra.

### 2.2 Ni siquiera las peticiones registradas dicen si salieron bien

`api_usage_logs` no tiene columna de estado. Un 200 y un 500 del handler quedan
idénticos en la tabla.

### 2.3 Mandamos el cliente y lo tiramos a la basura

El MCP envía en cada petición:

```
X-Client: Animus-Engine-MCP/0.1.1
```

y no hay columna donde guardarlo. Con eso no podemos separar el tráfico del MCP
del de `curl`, del portal o de un script. Y cuando salga la 0.1.1 —que arregla
timeout y errores— no vamos a poder saber **quién actualizó**, que es justo lo
que uno quiere saber después de publicar un arreglo.

### 2.4 El caso que lo ilustra ahora mismo

```
key "testmcp"   creada 2026-08-04 04:55   usada: NUNCA
```

Doce horas. Si es la que le pasaste al experto, no sabemos si todavía no la
probó, si se equivocó al copiarla, o si el MCP no le arrancó. Las tres se ven
exactamente igual desde acá: como nada.

---

## 3. Lo que sí podemos medir hoy — y por qué todavía no sirve

`api_keys.last_used_at` ya permite calcular activación sin recoger nada nuevo.
Pero el dato actual no dice nada:

```
keys creadas:            11
alguna vez usadas:        6
usuarios distintos:       2
```

De las 11, la mayoría se llaman `test`, `testtttt`, `rata`, `ci-smoke`,
`audit-script-test`. Son nuestras. **No hay línea base de usuarios reales**, así
que cualquier porcentaje de activación que saquemos hoy es ruido interno.

Vale la pena decirlo antes de montar tableros: el problema no es que falte
instrumentación para medir usuarios, es que todavía casi no hay usuarios. La
instrumentación hay que dejarla lista **antes** de que lleguen, no después.

---

## 4. Qué recoger, por capas

### Capa 0 — ya está fluyendo y se descarta (costo: tres columnas)

| Dato | Para qué | De dónde sale |
|:---|:---|:---|
| `status` | distinguir éxito de fallo | ya lo tiene la respuesta |
| `client` | MCP vs curl vs portal, y **qué versión** | ya viene en `X-Client` |
| `latencia_ms` | saber si 30 s de timeout es el número correcto | medible en el middleware |

Es lo más barato del documento y lo que más cambia lo que se puede preguntar.

### Capa 1 — registrar los rechazos (el arreglo importante)

Que auth y el limitador registren su rechazo con el código
(`AUTH_REQUIRED`, `RATE_LIMIT_MONTHLY`, `RATE_LIMIT_BURST`) antes de devolver.

Con eso se contestan las preguntas que hoy no tienen respuesta:

- cuánta gente rebota por credencial, y si rebota **una vez** (se equivocó al
  pegar y lo arregló) o **muchas** (no entiende qué le falta)
- quién está topando la cuota, que es la señal de que le quedó chico el plan
- si alguien está martillando la API

Ojo con un efecto secundario: registrar rechazos permite que un tercero infle la
tabla con peticiones inválidas. Conviene agregarlas por ventana en vez de una
fila por intento.

### Capa 2 — el embudo, una vez que haya usuarios

Con la capa 0 y 1 puestas, esto sale solo:

```
key creada → primera llamada (¿cuánto tardó?) → primera llamada EXITOSA
           → segunda sesión (¿volvió otro día?) → uso sostenido
```

El escalón que más dice es **"primera llamada exitosa"**: si alguien crea una
key y nunca llega ahí, el producto lo perdió antes de mostrar nada.

### Capa 3 — lo que la telemetría no va a responder nunca

Si la respuesta se **interpretó bien**. Ninguna métrica de servidor distingue
"pidió tendencias y entendió el dato" de "pidió tendencias y publicó que la
Suprema revoca el 56 %".

Eso sólo se sabe preguntando, y por eso el circuito con el abogado no es un
trámite previo al lanzamiento: es el único instrumento que mide lo que
realmente vendemos. Las advertencias que la 0.1.1 mete en la respuesta son un
intento de que el error no ocurra; **no** son una medición de si ocurrió.

---

## 5. La línea que no cruzamos

**El texto de las consultas no se guarda.** `intel/query` y `rag/query` reciben
la pregunta en el cuerpo, y hoy no se registra. Debe seguir así. Esto lo usan
abogados para investigar casos concretos: una lista de las preguntas de un
estudio sobre un litigio en curso es material que nadie espera que el proveedor
de la herramienta conserve.

**Y hay una que sí hay que arreglar.** `usageMiddleware` guarda la ruta cruda:

```ts
const endpoint = new URL(c.req.url).pathname
```

Para la mayoría de los endpoints eso es inocuo. Para éste no:

```
/api/v1/data/pjud/suprema/causas/Civil/289/2023
```

Ahí el identificador de **una causa real, con partes reales** queda escrito en el
log de uso. Todavía no ha pasado —ninguna fila persistida tiene ese patrón—,
pero va a pasar en cuanto el experto empiece a revisar causas, que es
exactamente para lo que le dimos la key.

El arreglo es normalizar la plantilla antes de guardar:

```
/api/v1/data/pjud/suprema/causas/:libro/:rol/:ano
```

Se conserva todo lo que sirve para medir —qué endpoint, cuánto costó, quién— y
se deja de conservar lo único que no deberíamos tener. Además hace la tabla
agregable: hoy cada causa distinta sería una fila con `endpoint` único, así que
"cuántas consultas de causa hubo" ni siquiera se puede agrupar.

Esto es Ley 21.719 en lo formal, pero el argumento no es el cumplimiento: es que
un abogado que investiga un caso no espera que quedemos con la lista de los casos
que miró.

---

## 6. Qué haría primero

1. **Normalizar la ruta antes de guardarla.** Es el único punto con costo si se
   deja para después: cada día que pasa es más historial que habría que borrar.
   Y hay que hacerlo antes de que el experto entre a revisar causas.
2. **Las tres columnas de la capa 0** (`status`, `client`, `latencia_ms`).
   Baratas, y sin ellas ninguna pregunta interesante se puede formular.
3. **Registrar los rechazos.** Es lo que convierte "no pasó nada" en "rebotaron
   N y por qué".
4. El embudo, cuando haya a quién medir.

Lo que **no** haría todavía: tableros, cohortes, alertas de uso. Con dos usuarios
reales, eso es decorar una casa vacía. Primero que la instrumentación esté puesta
para cuando llegue gente.
