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
  MpPreciosSchema,
  PjudEstadisticasSchema,
  // Las descripciones se IMPORTAN, no se copian. Lo que el modelo lee es el
  // `inputSchema` de acá abajo, no el `.describe()` de los esquemas Zod (que
  // sólo se usan para `.parse()` al ejecutar). Mientras el texto estuvo escrito
  // en los dos sitios, las copias divergieron en silencio: la 0.1.2 documentó
  // en el Zod la cobertura real de la ficha y el modelo siguió recibiendo acá
  // la promesa vieja de "ítems, adjuntos, montos" — el texto que ese cambio
  // venía justamente a corregir. Nada falló para avisarlo.
  DESC_ORGANISMOS,
  DESC_OPORTUNIDADES,
  DESC_VIAS_DE_COMPRA,
  DESC_STATUS,
  DESC_SORT,
  DESC_DETALLE,
  DESC_OFERTAS,
  DESC_PRECIOS,
  DESC_PJUD_ESTADISTICAS,
  executeMpOrganismos,
  executeMpOportunidades,
  executeMpDetalle,
  executeMpOfertas,
  executeMpPrecios,
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
            grupo_termino: {
              type: 'string',
              // El gateway filtra con igualdad exacta, así que un valor mal escrito
              // devuelve 0 filas y NO un error. Sin decirlo, un resultado vacío se
              // lee como "no hay causas así" cuando en realidad es un typo.
              description:
                'Coincidencia EXACTA, no parcial: Confirmados, Revocados, Rechazados, ' +
                'Inadmisibles, Acogidos, Desistidos. La lista no es exhaustiva y un valor ' +
                'inexistente devuelve 0 filas sin error — no lo leas como ausencia de causas.',
            },
            sala: { type: 'string', description: 'Coincidencia parcial.' },
            // El gateway acepta este filtro y lo valida contra tres valores; estaba
            // en el esquema Zod pero no acá, así que el modelo no podía usarlo y
            // terminaba mezclando causas falladas, ingresadas y en inventario.
            serie: {
              type: 'string',
              description:
                'terminos_suprema_detalle (falladas) | ingresos_recursos_suprema_detalle ' +
                '(ingresadas) | inventario_suprema_detalle (pendientes). Sin esto se mezclan ' +
                'las tres series, que son disjuntas. Otro valor devuelve 400.',
            },
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
        description: DESC_ORGANISMOS,
        inputSchema: {
          type: 'object',
          properties: {
            nombre: { type: 'string', description: 'Búsqueda parcial. Ej: "MINEDUC", "MUNICIPALIDAD".' },
            rut: { type: 'string', description: 'RUT del comprador, exacto. Ej: "60.910.000-1".' },
            page: { type: 'number' },
            page_size: { type: 'number', description: 'Default 20, máximo 100.' },
          },
        },
      },
      {
        name: 'animus_mp_oportunidades',
        description: DESC_OPORTUNIDADES,
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Término de búsqueda libre sobre el título.' },
            // Antes decía sólo 'tender | agile_purchase'. Los otros dos existen y son
            // consultables, pero al no estar declarados el modelo no podía saberlo y nunca
            // los pedía: 272 registros invisibles por una descripción incompleta.
            type: { type: 'string', description: DESC_VIAS_DE_COMPRA },
            status: { type: 'string', description: DESC_STATUS },
            region: { type: 'string', description: 'Coincidencia parcial. Ej: "Biobío", "Metropolitana".' },
            buyer_rut: { type: 'string', description: 'RUT del organismo comprador, exacto.' },
            buyer_name: { type: 'string', description: 'Nombre del organismo, coincidencia parcial.' },
            amount_min: { type: 'number', description: 'Monto estimado mínimo.' },
            amount_max: {
              type: 'number',
              description:
                'Monto estimado máximo. OJO: filtrar por monto EXCLUYE los procesos con ' +
                'presupuesto oculto (amount_is_public = false), porque su 0 no es un cero real.',
            },
            closing_from: { type: 'string', description: 'Cierre desde (ISO 8601, ej: 2026-08-20).' },
            closing_to: { type: 'string', description: 'Cierre hasta (ISO 8601).' },
            sort: { type: 'string', description: DESC_SORT },
            order: { type: 'string', description: 'asc | desc. Por defecto desc.' },
            page: { type: 'number' },
            page_size: { type: 'number', description: 'Default 20, máximo 100. Cada ítem es voluminoso.' },
          },
        },
      },
      {
        name: 'animus_mp_detalle',
        description: DESC_DETALLE,
        inputSchema: {
          type: 'object',
          properties: {
            codigo: {
              type: 'string',
              description:
                'Código externo tal como lo devuelve el buscador en `external_code` ' +
                '(ej: "4429-45-L126" para licitación, "1233619-464-COT26" para compra ágil).',
            },
          },
          required: ['codigo'],
        },
      },
      {
        name: 'animus_mp_ofertas',
        description: DESC_OFERTAS,
        inputSchema: {
          type: 'object',
          properties: {
            codigo: { type: 'string', description: 'external_code de una compra ágil.' },
            rut: { type: 'string', description: 'RUT del proveedor, con o sin puntos.' },
            solo_adjudicadas: { type: 'boolean', description: 'Sólo las ofertas que ganaron.' },
            page: { type: 'number' },
            page_size: { type: 'number', description: 'Default 20.' },
          },
        },
      },
      {
        name: 'animus_mp_precios',
        description: DESC_PRECIOS,
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Nombre de producto. Ej: "guantes", "toner".' },
            codigo_producto: { type: 'string', description: 'Código UNSPSC exacto.' },
            min_muestras: { type: 'number', description: 'Mínimo de cotizaciones. Default 5.' },
          },
        },
      },
      {
        name: 'animus_pjud_estadisticas',
        description: DESC_PJUD_ESTADISTICAS,
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
      case 'animus_mp_precios': {
        const parsed = MpPreciosSchema.parse(args);
        return await executeMpPrecios(parsed);
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
