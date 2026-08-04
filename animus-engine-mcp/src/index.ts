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

// Corte Suprema: 1.706.941 causas (2020-2025). Sin estas herramientas el MCP no
// llegaba al dato judicial — solo se lo rozaba en prosa via animus_intel_query.
import {
  PjudTendenciasSchema,
  PjudResumenSchema,
  PjudCausasSchema,
  PjudCausaSchema,
  executePjudTendencias,
  executePjudResumen,
  executePjudCausas,
  executePjudCausa,
} from './tools/pjudTools.js';

import {
  MpOrganismosSchema,
  MpOportunidadesSchema,
  MpDetalleSchema,
  MpOfertasSchema,
  PjudEstadisticasSchema,
  executeMpOrganismos,
  executeMpOportunidades,
  executeMpDetalle,
  executeMpOfertas,
  executePjudEstadisticas,
} from './tools/mercadoPublicoTools.js';

import {
  API_DOCS_RESOURCE,
  HEALTH_RESOURCE,
  readResource,
} from './resources/raasResources.js';

import { VERSION } from './client/raasClient.js';

const server = new Server(
  {
    name: 'Animus Engine MCP Server',
    // Se toma de la constante compartida: acá decía '1.0.0' mientras el paquete
    // publicado era 0.1.0, así que el handshake le informaba al cliente una
    // versión que no existe.
    version: VERSION,
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
        name: 'animus_pjud_tendencias',
        description: 'Serie por año de la Corte Suprema de Chile (2020-2025): causas falladas, % confirmados, % revocados y duración media entre ingreso y fallo. Filtrable por libro, tipo de recurso y sala. OJO: cubre SOLO causas ya falladas; no mide causas pendientes ni permite restar ingresos menos términos del mismo año, porque una causa ingresada un año puede fallarse en otro.',
        inputSchema: {
          type: 'object',
          properties: {
            libro: { type: 'string', description: 'Civil, Criminal, Familia, Reforma Laboral, etc.' },
            tipo_recurso: { type: 'string', description: 'Coincidencia parcial: "Protección", "Amparo", "Casación".' },
            sala: { type: 'string', description: 'Coincidencia parcial: "CONSTITUCIONAL", "PENAL", "MIXTA".' },
          },
        },
      },
      {
        name: 'animus_pjud_resumen',
        description: 'Totales de la Corte Suprema por año, serie, libro, tipo de recurso, sala y grupo de término. Usar para ver la distribución global antes de pedir el detalle.',
        inputSchema: {
          type: 'object',
          properties: {
            anio: { type: 'number', description: 'Año. Sin esto agrega 2020-2025.' },
            serie: { type: 'string', description: 'terminos_suprema_detalle | ingresos_recursos_suprema_detalle | inventario_suprema_detalle' },
          },
        },
      },
      {
        name: 'animus_pjud_causas',
        description: 'Causas individuales de la Corte Suprema con rol, libro, tipo de recurso, sala y fechas. Usar para revisar los casos concretos detrás de una cifra agregada.',
        inputSchema: {
          type: 'object',
          properties: {
            anio: { type: 'number' },
            libro: { type: 'string' },
            tipo_recurso: { type: 'string', description: 'Coincidencia parcial.' },
            grupo_termino: { type: 'string', description: 'Confirmados, Revocados, Rechazados, Inadmisibles, Acogidos.' },
            sala: { type: 'string', description: 'Coincidencia parcial.' },
            page: { type: 'number' },
            page_size: { type: 'number', description: 'Máximo 200.' },
          },
        },
      },
      {
        name: 'animus_pjud_causa',
        description: 'Historia completa de UNA causa de la Corte Suprema. Devuelve un ARREGLO: la misma causa puede figurar como ingresada, en inventario y con más de un término, con distinto resultado cada vez. No asumir que la primera fila es la definitiva.',
        inputSchema: {
          type: 'object',
          properties: {
            libro: { type: 'string', description: 'Ej: Reforma, Civil, Criminal, Familia.' },
            rol: { type: 'number' },
            ano_rol: { type: 'number' },
          },
          required: ['libro', 'rol', 'ano_rol'],
        },
      },
      {
        name: 'animus_mp_organismos',
        description: 'Directorio de organismos compradores del Estado de Chile (33.682). Devuelve nombre y codigo de organismo, util para cruzar con licitaciones. Buscar por nombre parcial.',
        inputSchema: {
          type: 'object',
          properties: {
            nombre: { type: 'string', description: 'Busqueda parcial. Ej: "MINEDUC", "MUNICIPALIDAD".' },
            page: { type: 'number' },
            page_size: { type: 'number', description: 'Default 20.' },
          },
        },
      },
      {
        name: 'animus_mp_oportunidades',
        description:
          'Buscador UNIFICADO de compras del Estado de Chile (Mercado Publico). Es la puerta de ' +
          'entrada a las CUATRO vias por las que el Estado compra, en una sola consulta. Usalo ' +
          'siempre que no sepas de antemano por cual se publico lo que buscas.',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Termino de busqueda libre sobre el titulo.' },
            type: {
              type: 'string',
              // Antes decia solo 'tender | agile_purchase'. Los otros dos existen y son
              // consultables, pero al no estar declarados el modelo no podia saberlo y nunca
              // los pedia: 272 registros invisibles por una descripcion incompleta.
              description:
                'Via de compra. Omitir para buscar en las cuatro. ' +
                'tender = licitacion tradicional (13.990). ' +
                'agile_purchase = compra agil, monto menor y proceso rapido (24.043). ' +
                'convenio_marco = compra contra catalogo ya licitado (242). ' +
                'trato_directo = adjudicacion SIN competencia, por excepcion legal (30) — ' +
                'es la via con menos competencia y la de mayor interes para auditoria.',
            },
            status: { type: 'string', description: 'publicada | cerrada | adjudicada' },
            page: { type: 'number' },
            page_size: { type: 'number', description: 'Default 20. Subelo solo si hace falta: cada item es voluminoso.' },
          },
        },
      },
      {
        name: 'animus_mp_detalle',
        description:
          'Ficha completa de UNA oportunidad de Mercado Publico: items, adjuntos, montos, ' +
          'organismo comprador y fechas. Usalo despues de animus_mp_oportunidades, cuando ya ' +
          'identificaste cual te interesa y necesitas el detalle que el listado no trae.',
        inputSchema: {
          type: 'object',
          properties: {
            codigo: {
              type: 'string',
              description:
                'Codigo externo tal como lo devuelve el buscador en external_code ' +
                '(ej: "4429-45-L126" para licitacion, "1233619-464-COT26" para compra agil).',
            },
          },
          required: ['codigo'],
        },
      },
      {
        name: 'animus_mp_ofertas',
        description:
          'La COMPETENCIA real de las compras del Estado: quien cotizo, por cuanto, quien gano y ' +
          'con que argumento se declaro inadmisible al resto. Requiere `codigo` (quienes ' +
          'compitieron por una compra) o `rut` (como le va a un proveedor, con su tasa de ' +
          'adjudicacion). LIMITE: solo compras agiles concluidas — hay datos de 1.308 de 24.043.',
        inputSchema: {
          type: 'object',
          properties: {
            codigo: { type: 'string', description: 'external_code de una compra agil.' },
            rut: { type: 'string', description: 'RUT del proveedor, con o sin puntos.' },
            solo_adjudicadas: { type: 'boolean', description: 'Solo las ofertas que ganaron.' },
            page: { type: 'number' },
            page_size: { type: 'number', description: 'Default 20.' },
          },
        },
      },
      {
        name: 'animus_pjud_estadisticas',
        description: 'Series AGREGADAS del Poder Judicial: presupuesto, dotacion, adquisiciones y cuenta publica. Distintas de las causas individuales — aca no hay roles ni fallos, son totales institucionales.',
        inputSchema: {
          type: 'object',
          properties: {
            serie: { type: 'string', description: 'Parcial: "cuenta-publica", "presupuesto", "adquisiciones".' },
            anio: { type: 'number' },
            page: { type: 'number' },
            page_size: { type: 'number' },
          },
        },
      },
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
      case 'animus_pjud_tendencias': {
        return await executePjudTendencias(PjudTendenciasSchema.parse(args ?? {}));
      }
      case 'animus_pjud_resumen': {
        return await executePjudResumen(PjudResumenSchema.parse(args ?? {}));
      }
      case 'animus_pjud_causas': {
        return await executePjudCausas(PjudCausasSchema.parse(args ?? {}));
      }
      case 'animus_pjud_causa': {
        return await executePjudCausa(PjudCausaSchema.parse(args));
      }
      case 'animus_mp_organismos': {
        return await executeMpOrganismos(MpOrganismosSchema.parse(args ?? {}));
      }
      case 'animus_mp_oportunidades': {
        return await executeMpOportunidades(MpOportunidadesSchema.parse(args ?? {}));
      }
      case 'animus_mp_detalle': {
        const parsed = MpDetalleSchema.parse(args);
        return await executeMpDetalle(parsed);
      }
      case 'animus_mp_ofertas': {
        const parsed = MpOfertasSchema.parse(args);
        return await executeMpOfertas(parsed);
      }
      case 'animus_pjud_estadisticas': {
        return await executePjudEstadisticas(PjudEstadisticasSchema.parse(args ?? {}));
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
  // Aviso al arrancar, no al usar la primera herramienta: sin esto el usuario
  // ve el servidor "conectado" y recién descubre que le falta la clave cuando
  // una consulta falla, con un error que no dice qué hacer.
  //
  // No se aborta a propósito: el cliente MCP mostraría sólo "desconectado", que
  // es aún menos informativo. Se conecta, se avisa fuerte y las herramientas
  // fallan con el mensaje que explica cómo arreglarlo.
  if (!process.env.ANIMUS_API_KEY && !process.env.BRALIDUS_API_KEY) {
    console.error(
      '⚠️  Falta ANIMUS_API_KEY: las herramientas van a fallar.\n' +
        '   Obtené una clave en https://animus.scouttech.lat y agregala al bloque\n' +
        '   "env" de tu configuración MCP:  "env": { "ANIMUS_API_KEY": "tu_clave" }',
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Animus Engine MCP Server corriendo exitosamente sobre stdio.');
}

main().catch((error) => {
  console.error('Error fatal al iniciar Animus Engine MCP Server:', error);
  process.exit(1);
});
