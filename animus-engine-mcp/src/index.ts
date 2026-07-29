#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  IntelQuerySchema,
  RagSearchSchema,
  ApiDocsSchema,
  executeIntelQuery,
  executeRagSearch,
  executeApiDocs,
} from './tools/intelTools.js';

import {
  EconomicMacroSchema,
  EconomicCatalogSchema,
  executeEconomicMacro,
  executeEconomicCatalog,
} from './tools/economyTools.js';

import {
  LicitusActivasSchema,
  LicitusCompraAgilSchema,
  executeLicitusActivas,
  executeLicitusCompraAgil,
} from './tools/licitusTools.js';

import {
  API_DOCS_RESOURCE,
  HEALTH_RESOURCE,
  readResource,
} from './resources/raasResources.js';

const server = new Server(
  {
    name: 'Animus Engine MCP Server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ── 1. Manejador de Listado de Herramientas (ListTools) ────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'animus_api_docs',
        description: 'Obtener la documentación pública, especificación técnica y guía de integración del API Animus Engine / Bralidus RaaS (NO REQUIERE AUTENTICACIÓN NI API KEY). Úsalo primero si el usuario pregunta por documentación o cómo integrar.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'animus_intel_query',
        description: 'Consulta en lenguaje natural al Grafo de Conocimiento MoE (Mixture of Experts) de Animus Engine (ej: "¿Cuál es la Tasa de Política Monetaria en Chile?")',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Pregunta o término en lenguaje natural sobre macroeconomía, finanzas o gobierno.',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'animus_rag_search',
        description: 'Búsqueda semántica (Vector RAG) en la Base de Conocimiento con síntesis en Markdown y citas fehacientes de leyes y normas chilenas.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Consulta sobre leyes, regulación financiera o normas fintech (ej: "Regulación Ley Fintech 21.521").',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'animus_economic_macro',
        description: 'Obtener indicadores macroeconómicos chilenos normalizados en tiempo real (UF diaria de la CMF, UTM, TPM, etc.).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'animus_economic_catalog',
        description: 'Obtener el catálogo completo multi-proveedor de series económicas almacenadas en base de datos (CMF, SII, BCCh, FRED).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'animus_licitus_activas',
        description: 'Búsqueda de licitaciones públicas B2G abiertas y activas en Mercado Público a través de Animus Engine.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Número máximo de licitaciones a obtener (default 10, máximo 50).',
            },
          },
        },
      },
      {
        name: 'animus_licitus_compra_agil',
        description: 'Obtener oportunidades en tiempo real de Compras Ágiles públicas en Mercado Público.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Número máximo de compras ágiles a obtener (default 10, máximo 50).',
            },
          },
        },
      },
    ],
  };
});

// ── 2. Manejador de Ejecución de Herramientas (CallTool) ───────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'animus_intel_query': {
        const parsed = IntelQuerySchema.parse(args);
        return await executeIntelQuery(parsed);
      }
      case 'animus_rag_search': {
        const parsed = RagSearchSchema.parse(args);
        return await executeRagSearch(parsed);
      }
      case 'animus_api_docs': {
        return await executeApiDocs();
      }
      case 'animus_economic_macro': {
        return await executeEconomicMacro();
      }
      case 'animus_economic_catalog': {
        return await executeEconomicCatalog();
      }
      case 'animus_licitus_activas': {
        const parsed = LicitusActivasSchema.parse(args);
        return await executeLicitusActivas(parsed);
      }
      case 'animus_licitus_compra_agil': {
        const parsed = LicitusCompraAgilSchema.parse(args);
        return await executeLicitusCompraAgil(parsed);
      }
      default:
        throw new Error(`Herramienta Animus desconocida: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `[ERROR EN ANIMUS MCP TOOL]: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ── 3. Manejador de Listado de Recursos (ListResources) ────────────────
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [API_DOCS_RESOURCE, HEALTH_RESOURCE],
  };
});

// ── 4. Manejador de Lectura de Recursos (ReadResource) ─────────────────
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  return await readResource(uri);
});

// ── 5. Arranque del Servidor Stdio ──────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Animus Engine MCP Server corriendo exitosamente sobre stdio.');
}

main().catch((error) => {
  console.error('Error fatal al iniciar Animus Engine MCP Server:', error);
  process.exit(1);
});
