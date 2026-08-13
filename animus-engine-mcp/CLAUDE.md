# Animus Engine MCP (`animus-engine-mcp`) — CLAUDE.md

Servidor Model Context Protocol que expone los datos de Animus a Claude Desktop,
Cursor y Windsurf.

**npm:** `animus-engine-mcp`

> Acá había un número de versión y quedó viejo dos veces en el mismo día. La
> publicada la dice `npm view animus-engine-mcp version`; la del repo,
> `package.json`. Es la misma disciplina que la §4 pide para los volúmenes de
> Mercado Público, y por la misma razón: un número escrito a mano envejece solo.

**Gateway:** `https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1`

---

## 1. Publicar

```bash
cd animus-engine-mcp
npm config set //registry.npmjs.org/:_authToken TU_TOKEN_GRANULAR
npm publish --access public
npm config delete //registry.npmjs.org/:_authToken   # ← no olvidar
```

La cuenta `lucifxr63` tiene 2FA **sólo por security key**, que no genera código
de 6 dígitos: `--otp=` no sirve. Hay que usar un **granular access token** con
bypass 2FA, crearlo para la ocasión y **revocarlo después**.

Antes de dar Enter, dos comprobaciones que ya evitaron un incidente:

- El prompt debe decir `...\animus-engine-mcp>`. Un `npm publish` desde la raíz
  del monorepo intentó publicar 1305 archivos —`graphify-out/`, PDFs de `pitch/`,
  el portal entero— y sólo falló porque el nombre `startups` ya estaba tomado.
  Hoy la raíz tiene `private: true` **y** un `prepublishOnly` que aborta.
- npm debe listar **17 archivos**. Si dice 1305, estás en el directorio
  equivocado.

**Pendiente recomendado:** migrar a Trusted Publishing (OIDC desde GitHub
Actions). Elimina el token de larga vida del flujo y agrega `--provenance`. Ya
existe `mcp-ci.yml` donde engancharlo.

## 2. Verificar antes de publicar

```bash
npm run build        # borra dist/ primero: tsc NO limpia y deja código muerto
npm pack --dry-run   # revisar SIN filtrar: los `npm warn` importan
```

Un `grep 'npm notice'` escondió el warning de que npm estaba **descartando el
`bin`** por declararlo como `"./dist/index.js"`. El paquete habría quedado
instalable pero sin ejecutable, rompiendo el `npx -y` que documenta el README.

El CI (`.github/workflows/mcp-ci.yml`) prueba el **tarball instalado**, no el
fuente: que exista el ejecutable, el shebang, las 15 herramientas por stdio, que
sin key falle con instrucciones, que el timeout corte, y que la versión del
código coincida con `package.json`.

---

## 3. Las 15 herramientas

**Corte Suprema** — `animus_pjud_tendencias`, `animus_pjud_resumen`,
`animus_pjud_causas`, `animus_pjud_causa`, `animus_pjud_estadisticas`

**Mercado Público** — `animus_mp_oportunidades`, `animus_mp_detalle`,
`animus_mp_ofertas`, `animus_mp_precios`, `animus_mp_organismos`

**Economía e inteligencia** — `animus_economic_macro`, `animus_economic_catalog`,
`animus_intel_query`, `animus_rag_search`, `animus_api_docs`

Al agregar o quitar una hay que **actualizar el conteo en `mcp-ci.yml`**, que lo
verifica de forma exacta.

### La descripción de una herramienta se escribe UNA vez

Lo que el modelo lee **no** es el `.describe()` del esquema Zod: es el
`inputSchema` que `index.ts` devuelve en `tools/list`. Los Zod sólo corren en
`.parse()` al ejecutar la herramienta.

Mientras el texto estuvo escrito en los dos sitios, las copias divergieron sin
que nada fallara. La 0.1.2 agregó `COBERTURA_DETALLE` —que los ítems están en el
20 % de las licitaciones, que `attachments` no trae URL de descarga, que
`amount_estimated = 0` no significa sin presupuesto— y el modelo siguió
recibiendo la promesa vieja de "ítems, adjuntos, montos": exactamente el texto
que ese cambio venía a corregir. El commit entero fue código muerto de cara al
modelo. En el mismo barrido faltaba el filtro `serie` en `animus_pjud_causas`
(estaba en el Zod, no en el cable) y `grupo_termino` listaba 5 valores contra 6.

**Desde 0.1.7 el `inputSchema` se GENERA del Zod** con `zod-to-json-schema`, así
que ya no hay dos definiciones que puedan separarse: hay una y el cable sale de
ella. La 0.1.3 lo había mitigado exportando constantes `DESC_*` e importándolas,
pero eso seguía dependiendo de que quien agregara una herramienta se acordara de
hacerlo — y en un solo día hubo que corregir dos descripciones.

Agregar una herramienta hoy es: definir el Zod con `.describe()` en el objeto y
en cada campo, y sumar una línea `herramienta('animus_x', XSchema)`. Si el
esquema no trae `.describe()`, el servidor **falla al arrancar** en vez de
exponer una herramienta que el modelo no puede elegir.

Se descartan dos claves de lo que genera la librería: `$schema`, que ningún
cliente MCP usa, y la `description` de nivel raíz, que repetiría literalmente la
de la herramienta —1.772 caracteres duplicados sólo en `animus_mp_detalle`—.
A cambio llegan `required` y `additionalProperties: false` derivados, que antes
no existían.

Para comprobar que un cambio llega al modelo, tocar sólo el `.describe()` del Zod
y mirar el cable — nunca el fuente:

```bash
printf '%s\n%s\n%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"x","version":"1"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
 | node dist/index.js 2>/dev/null
```

### Retiradas en 0.1.1

`animus_licitus_activas` y `animus_licitus_compra_agil`. Pegaban al **mismo
endpoint canónico** que el buscador unificado, así que devolvían lo mismo con
otro nombre — y un modelo eligiendo entre ellas no tenía criterio alguno.
"Licitus" además es vocabulario interno que no significa nada para el usuario.

---

## 4. Decisiones de diseño que conviene no revertir

### La API key es obligatoria

`getApiKey()` **lanza** si falta. No hay clave por defecto: una compartida mezcla
el consumo, deja que terceros gasten cuota ajena y hace imposible saber quién
hizo qué. El gateway además cerró el acceso anónimo el 2026-08-04.

### La key va SÓLO en el header

El cliente la mandaba además como `?apikey=` "de fallback". Las query strings
quedan en logs de servidor, de proxies y en historiales — publicado en npm, eso
filtra la clave de cada usuario. `animus_api_docs` tampoco debe volver a
sugerirlo.

### Timeout obligatorio

`fetch` sin `signal` **no tiene timeout**: un gateway colgado dejaba la
herramienta girando para siempre, indistinguible de que se colgó el modelo. Hay
`AbortController` con 30 s por defecto, 90 s en rutas que hacen trabajo de LLM, y
`ANIMUS_TIMEOUT_MS` para redes lentas.

### Los errores se traducen

401, 403, 429 (cuota mensual vs ráfaga), 503 y 5xx salen como mensajes
accionables, leyendo los encabezados de cuota que antes se descartaban. Los dos
que un usuario nuevo encuentra garantizado son 401 y 429.

### Las advertencias de PJUD viajan en la RESPUESTA

No sólo en la descripción de la herramienta ni en el README: **el modelo no lee
el README**. Cada herramienta de PJUD antepone a sus datos las advertencias que
apliquen, y de forma condicional (si ya filtró por `tipo_recurso` no se le repite
que "esto es casi todo protección").

Las tres, verificadas contra la base:

1. Ingresos (797.187), inventario (114.819) y términos (794.935) son series
   **disjuntas**. Restar ingresos menos términos no da pendientes: 2024 arroja
   153 % "resuelto".
2. `animus_pjud_causa` devuelve un **arreglo**. Civil 289-2023 es *Inadmisible*
   en 2023 y *Rechazado* en 2025.
3. El 87,3 % de los términos son un solo recurso (Apelación Protección), y su
   tasa de revocación **no es estable**: 17 % (2020) → 80 % (2022) → 20 % (2025).
   **Pendiente de dictamen de un abogado** — ver
   `validateai/docs/PJUD_VALIDACION_EXPERTO.md`.

### El JSON va sin indentar

Lo lee un modelo, no una persona. Quitar la indentación bajó las 15 herramientas
de 105.466 a 66.150 caracteres (−37 %), incluyendo las advertencias nuevas.

### La versión sale de una sola constante

`VERSION` en `raasClient.ts`, usada por `X-Client` y por el handshake MCP. Estaba
escrita a mano en dos sitios y los dos decían 1.0.0 con el paquete en 0.1.0. El
CI lo verifica.

---

## 5. Deuda conocida

- **Sin reintentos.** Un 502 pasajero tumba la llamada. Va *después* del timeout:
  reintentar sin timeout empeora las cosas.
- **Respuestas grandes.** `animus_intel_query` sigue en ~15 k caracteres.
- **Trusted Publishing** pendiente (ver §1).
- Análisis completo en `ROBUSTEZ.md` y `EXPERIENCIA_Y_TELEMETRIA.md`.
