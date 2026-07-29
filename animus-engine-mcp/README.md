# Animus Engine MCP Server (`animus-engine-mcp`)

El servidor **Model Context Protocol (MCP)** oficial para el ecosistema **Animus Engine / Bralidus RaaS**. Permite a modelos de lenguaje (LLMs) dentro de Cursor IDE, Windsurf, Claude Desktop, y agentes automáticos acceder de forma nativa a **datos macroeconómicos chilenos (CMF/SII/BCCh)**, **licitaciones de Mercado Público (B2G)** y al **Grafo de Conocimiento MoE (Mixture of Experts)** en tiempo real sin mocks ni intermediarios.

---

## 🌟 1. Herramientas Disponibles (MCP Tools)

| Tool | Descripción | Parámetros |
|:---|:---|:---|
| `animus_intel_query` | Consulta al Grafo de Conocimiento MoE en lenguaje natural. | `query: string` |
| `animus_rag_search` | Búsqueda semántica (Vector RAG) sobre leyes y regulación chilena (ej: Ley Fintech 21.521). | `query: string` |
| `animus_economic_macro` | Indicadores macroeconómicos chilenos normalizados (UF del día en CMF, UTM, TPM, etc.). | Ninguno |
| `animus_economic_catalog` | Catálogo completo de series en la base de datos multi-proveedor. | Ninguno |
| `animus_licitus_activas` | Licitaciones públicas B2G abiertas en tiempo real en Mercado Público. | `limit?: number` (default 10) |
| `animus_licitus_compra_agil` | Oportunidades en tiempo real de Compras Ágiles en Mercado Público. | `limit?: number` (default 10) |

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
      "command": "node",
      "args": ["E:/DEV/Respos/Trabajo/startups/animus-engine-mcp/dist/index.js"],
      "env": {
        "ANIMUS_API_KEY": "demo_public_key"
      }
    }
  }
}
```

> **Nota**: Reemplaza `"demo_public_key"` por tu propia API Key generada en el Developer Portal para límites de cuota completos y reportes de auditoría en tu organización.

---

### Opción B: Cursor IDE / Windsurf

1. Abre las Preferencias del Editor -> **MCP Servers** -> **Add new MCP Server**.
2. Completa los campos:
   - **Name**: `Animus Engine`
   - **Type**: `stdio`
   - **Command**: `node E:/DEV/Respos/Trabajo/startups/animus-engine-mcp/dist/index.js`
   - **Environment Variables**:
     - `ANIMUS_API_KEY=demo_public_key`

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
