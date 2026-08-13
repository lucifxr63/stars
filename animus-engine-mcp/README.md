# Animus Engine MCP Server (`animus-engine-mcp`)

El servidor **Model Context Protocol (MCP)** oficial para el ecosistema **Animus Engine / Bralidus RaaS**. Permite a modelos de lenguaje (LLMs) dentro de Cursor IDE, Windsurf, Claude Desktop, y agentes automáticos acceder de forma nativa a **jurisprudencia de la Corte Suprema de Chile**, **datos macroeconómicos chilenos (CMF/SII/BCCh)**, **licitaciones de Mercado Público (B2G)** y al **Grafo de Conocimiento MoE (Mixture of Experts)** en tiempo real sin mocks ni intermediarios.

---

## 🌟 1. Herramientas Disponibles (MCP Tools)

### ⚖️ Corte Suprema de Chile

1.706.941 causas entre 2020 y 2025, tomadas de la API pública de estadísticas
del Poder Judicial y verificadas año por año contra la fuente.

| Tool | Descripción | Parámetros |
|:---|:---|:---|
| `animus_pjud_tendencias` | Serie por año: causas falladas, % confirmados y revocados, duración media entre ingreso y fallo. | `libro?`, `tipo_recurso?`, `sala?` |
| `animus_pjud_resumen` | Totales por año, serie, libro, tipo de recurso, sala y grupo de término. | `anio?`, `serie?` |
| `animus_pjud_causas` | Causas individuales con rol, libro, tipo, sala y fechas. | `anio?`, `libro?`, `tipo_recurso?`, `grupo_termino?`, `sala?`, `page?`, `page_size?` |
| `animus_pjud_causa` | Historia completa de UNA causa. | `libro`, `rol`, `ano_rol` |
| `animus_pjud_estadisticas` | Series agregadas del Poder Judicial: presupuesto, dotación, adquisiciones, cuenta pública. | `serie?`, `anio?`, `page?`, `page_size?` |

**Estas advertencias viajan en la propia respuesta.** No están sólo acá: cada
herramienta de PJUD antepone a sus datos las que apliquen, porque el modelo que
llama la herramienta no lee este README — sólo ve la descripción y el resultado.
Sin eso, lo previsible es que alguien pida tendencias y publique "la Corte
Suprema revoca el 56 % de las causas", que es justo la lectura que el dato no
soporta.

**Lo que conviene saber antes de interpretar estos datos:**

- `animus_pjud_tendencias` cubre **sólo causas ya falladas**. No sirve para
  medir causas pendientes, y **restar ingresos menos términos del mismo año no
  da un backlog**: una causa ingresada un año puede fallarse en otro (2024
  arroja 153 % "resuelto" si se hace esa resta). La medida real de pendientes
  es el inventario, disponible vía `animus_pjud_resumen`.
- `animus_pjud_causa` devuelve un **arreglo**, no un registro. La misma causa
  puede figurar como ingresada, en inventario y con más de un término, con
  distinto resultado cada vez. No asumas que la primera fila es la definitiva.
- Cualquier porcentaje global describe casi sólo **recursos de protección**:
  694.025 de los 794.935 términos (87,3 %) son `(Civil) Apelación Protección`.
  Y la tasa de revocación **no es estable**: dentro de ese mismo recurso va de
  17,0 % (2020) a 80,6 % (2022) y baja a 20,0 % (2025). Un promedio del período
  no describe la serie. Si ese salto corresponde a la ola de recursos contra
  isapres está **pendiente de validación por un experto**.
- El vocabulario de resultados depende del **tipo de recurso**, no del libro. En
  apelación se confirma o revoca; en casación y unificación se declara
  inadmisible, se rechaza o se acoge. En Reforma Laboral, confirmados y
  revocados suman 0,4 %: un 0 % ahí no significa que no pase nada.

### 📊 Economía, B2G e inteligencia

| Tool | Descripción | Parámetros |
|:---|:---|:---|
| `animus_intel_query` | Consulta al Grafo de Conocimiento MoE en lenguaje natural. | `query: string` |
| `animus_rag_search` | Búsqueda semántica (Vector RAG) sobre leyes y regulación chilena (ej: Ley Fintech 21.521). | `query: string` |
| `animus_economic_macro` | Indicadores macroeconómicos chilenos normalizados (UF del día en CMF, UTM, TPM, etc.). | Ninguno |
| `animus_economic_catalog` | Catálogo completo de series en la base de datos multi-proveedor. | Ninguno |
| `animus_mp_oportunidades` | Buscador **unificado** de las cuatro vías de compra del Estado. | `q?`, `type?`, `status?`, `page?`, `page_size?` |
| `animus_mp_detalle` | Ficha completa de UNA oportunidad: ítems, adjuntos, montos, comprador. | `codigo` (el `external_code` del buscador) |
| `animus_mp_ofertas` | **La competencia real**: quién cotizó, por cuánto, quién ganó y por qué se rechazó al resto. | `codigo?` o `rut?` (uno obligatorio), `solo_adjudicadas?` |
| `animus_mp_precios` | **Precios de referencia** por producto, con señal de fiabilidad. | `q?`, `codigo_producto?`, `min_muestras?` |
| `animus_mp_organismos` | Directorio de organismos compradores del Estado. | `nombre?`, `page?`, `page_size?` |

**Sobre `animus_mp_ofertas`.** Es lo que un listado de licitaciones no da. Con
`rut` devuelve el historial de un proveedor y su tasa de adjudicación; con
`codigo`, todos los que compitieron por esa compra, ordenados con el ganador
primero. Los datos salen de 16.919 ofertas sobre 3.990 proveedores, con 2.583
motivos de inadmisibilidad escritos.

> **Límite que conviene tener presente:** sólo hay oferentes de **compras
> ágiles concluidas**. Licitaciones, convenios marco y tratos directos no los
> publican en esta fuente, y las compras aún abiertas todavía no los muestran:
> hay datos de 3.122 de las 44.545 compras ágiles.

**Sobre `animus_mp_precios`.** Devuelve `mediana` con el rango `p25`–`p75`, no un
"precio de mercado". La razón: `precio_unitario` mezclaba precios reales con
canastas enteras puestas en una sola línea —en un código, 7 pesos por cápsula de
papel convivía con 1.030.568 por "SEGÚN LISTADO EN ADJUNTO"—. Esas líneas se
excluyen, pero queda dispersión real porque un código UNSPSC agrupa productos
heterogéneos. Por eso cada fila trae `ratio_p75_p25` y `fiabilidad`: con ratio
1,5 la mediana es un precio; con ratio 6 es el promedio de cosas que no se
comparan.

**Las cuatro vías por las que el Estado compra** (`type`, volúmenes al 2026-08-12):

| `type` | Qué es | Registros |
|:---|:---|---:|
| `tender` | Licitación tradicional | 15.669 |
| `agile_purchase` | Compra ágil: monto menor, proceso rápido | 44.545 |
| `convenio_marco` | Compra contra catálogo ya licitado | 274 |
| `trato_directo` | Adjudicación **sin competencia**, por excepción legal | 40 |

> Estas cifras crecieron **58 % en ocho días**. Un integrador reportó como
> "inconsistencia" que `health` dijera un total y este README otro: los dos
> números eran correctos, lo que faltaba era la fecha al lado. Para el dato
> vivo, `animus_mp_oportunidades` sin filtros informa el total en `meta.total`.

Omitir `type` busca en las cuatro. `trato_directo` es la vía con menos
competencia y la de mayor interés para auditoría.

> **Nota de la 0.1.1:** se retiraron `animus_licitus_activas` y
> `animus_licitus_compra_agil`. Pegaban al mismo endpoint canónico que el
> buscador unificado, así que devolvían lo mismo con otro nombre —y "Licitus" es
> vocabulario interno que no significa nada para quien usa la herramienta. Usa
> `animus_mp_oportunidades` con `type: "tender"` o `type: "agile_purchase"`.

---

## 🔑 Autenticación

`ANIMUS_API_KEY` es **obligatoria**. Sin ella el servidor arranca, avisa por
stderr y cada herramienta devuelve un error explicando cómo configurarla.

Se obtiene en [animus.scouttech.lat](https://animus.scouttech.lat) y va en el
bloque `env` de la configuración MCP:

```json
"env": { "ANIMUS_API_KEY": "tu_clave" }
```

No hay clave por defecto a propósito: una clave compartida entre todos los
usuarios mezcla el consumo, deja que terceros gasten el rate limit y hace
imposible saber quién hizo qué.

### Variables opcionales

| Variable | Para qué |
|:---|:---|
| `ANIMUS_TIMEOUT_MS` | Presupuesto por petición. Por defecto 30 s, y 90 s en las rutas que hacen trabajo de LLM (`intel/query`, `rag/query`). Súbelo si tu red es lenta. |
| `ANIMUS_GATEWAY_URL` | Apuntar a otro gateway. Sólo para desarrollo. |

### Qué pasa cuando algo falla

Los errores del gateway vienen traducidos a algo accionable, no como volcado de
JSON. Los tres que te puedes encontrar:

| Situación | Lo que verás |
|:---|:---|
| Key mal copiada o revocada | Te dice que revises `ANIMUS_API_KEY` y dónde generar otra |
| Cuota mensual agotada | Cuántos créditos usaste de cuántos, y cuándo se reinicia |
| Límite por minuto | Cuántos segundos esperar antes de reintentar |

Si la petición supera el presupuesto de tiempo, se cancela y te lo dice. No se
queda colgada.

---

## 🚀 2. Guía Rápida de Instalación (1 Minuto)

### Opción A: Claude Desktop (`claude_desktop_config.json`)

Edita el archivo de configuración en:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "animus-engine": {
      "command": "npx",
      "args": ["-y", "animus-engine-mcp"],
      "env": {
        "ANIMUS_API_KEY": "tu_clave_aqui"
      }
    }
  }
}
```

> Reemplaza `tu_clave_aqui` por tu API Key de [animus.scouttech.lat](https://animus.scouttech.lat). Sin ella las herramientas no funcionan.

---

### Opción B: Cursor IDE / Windsurf

1. Abre las Preferencias del Editor -> **MCP Servers** -> **Add new MCP Server**.
2. Completa los campos:
   - **Name**: `Animus Engine`
   - **Type**: `stdio`
   - **Command**: `npx -y animus-engine-mcp`
   - **Environment Variables**:
     - `ANIMUS_API_KEY=tu_clave_aqui`

---

### Opción C: desde el repositorio (desarrollo)

Si trabajas sobre el código en vez de instalarlo:

```json
{
  "mcpServers": {
    "animus-engine": {
      "command": "node",
      "args": ["/ruta/absoluta/a/animus-engine-mcp/dist/index.js"],
      "env": { "ANIMUS_API_KEY": "tu_clave_aqui" }
    }
  }
}
```

---

## 💡 3. Ejemplos de Prompts en tu IDE o Claude Desktop

Una vez configurado, puedes preguntar directamente en lenguaje natural:
- *"¿Cuál es el valor actual de la UF según la CMF y cuál es la Tasa de Política Monetaria en Chile?"*
- *"Muéstrame las últimas licitaciones públicas B2G activas en Mercado Público a través de Animus."*
- *"¿Qué dice la Ley Fintech 21.521 respecto a la autorización de plataformas transaccionales en Chile?"*
- *"Consulta en el grafo de conocimiento MoE la correlación entre la inflación del CPI y el Banco Central de Chile."*

---

## 🛠️ 4. Desarrollo & Pruebas en el Repositorio

```bash
# Instalar dependencias
npm install

# Compilar TypeScript
npm run build

# Ejecutar Suite de Verificación por Stdio
node test_mcp_stdio.js
```

---

*Desarrollado y certificado para producción por Animus Engine / Bralidus RaaS · 2026*
