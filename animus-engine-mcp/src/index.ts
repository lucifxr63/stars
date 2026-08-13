#!/usr/bin/env node
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
  MpOrdenesSchema,
  PjudEstadisticasSchema,
  // Las descripciones se IMPORTAN, no se copian. Lo que el modelo lee es el
  // `inputSchema` de acá abajo, no el `.describe()` de los esquemas Zod (que
  // sólo se usan para `.parse()` al ejecutar). Mientras el texto estuvo escrito
  // en los dos sitios, las copias divergieron en silencio: la 0.1.2 documentó
  // en el Zod la cobertura real de la ficha y el modelo siguió recibiendo acá
  // la promesa vieja de "ítems, adjuntos, montos" — el texto que ese cambio
  // venía justamente a corregir. Nada falló para avisarlo.
  executeMpOrganismos,
  executeMpOportunidades,
  executeMpDetalle,
  executeMpOfertas,
  executeMpPrecios,
  executeMpOrdenes,
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
/**
 * Una herramienta MCP a partir de su esquema Zod.
 *
 * POR QUÉ SE GENERA Y NO SE ESCRIBE
 * ---------------------------------
 * Hasta la 0.1.6 los `inputSchema` estaban escritos a mano acá y los Zod vivían
 * en `tools/`, con el texto duplicado. Los Zod sólo corren en `.parse()`, así que
 * lo que el modelo leía era SIEMPRE la copia de este archivo — y las dos
 * divergieron sin que nada fallara:
 *
 *   · la 0.1.2 documentó en el Zod la cobertura real de la ficha y el modelo
 *     siguió recibiendo la promesa vieja de "ítems, adjuntos, montos";
 *   · `animus_pjud_causas` aceptaba `serie` y no estaba declarado;
 *   · `grupo_termino` listaba 5 valores contra 6.
 *
 * La 0.1.3 lo mitigó exportando constantes e importándolas, pero eso seguía
 * dependiendo de que quien agregara una herramienta se acordara de hacerlo. Con
 * el esquema derivado del Zod, la divergencia deja de ser improbable y pasa a ser
 * imposible: hay una sola definición y el cable sale de ella.
 *
 * Se descartan dos claves de la salida:
 *   · `$schema`, que ningún cliente MCP usa y ocupa espacio en cada herramienta;
 *   · `description` de nivel raíz, que repetiría literalmente la descripción de
 *     la herramienta — 1.772 caracteres duplicados sólo en `animus_mp_detalle`.
 */
function herramienta(name: string, schema: z.ZodTypeAny) {
  const { $schema: _s, description, ...inputSchema } = zodToJsonSchema(schema, {
    $refStrategy: 'none',
  }) as Record<string, unknown>;

  if (!description) {
    // Sin descripción el modelo no tiene con qué elegir entre 15 herramientas.
    // Falla al arrancar y no en silencio: es un error de programación nuestro,
    // no una condición de ejecución.
    throw new Error(`La herramienta ${name} no tiene .describe() en su esquema Zod.`);
  }

  return { name, description: description as string, inputSchema };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Corte Suprema
      herramienta('animus_pjud_tendencias', PjudTendenciasSchema),
      herramienta('animus_pjud_resumen', PjudResumenSchema),
      herramienta('animus_pjud_causas', PjudCausasSchema),
      herramienta('animus_pjud_causa', PjudCausaSchema),
      herramienta('animus_pjud_estadisticas', PjudEstadisticasSchema),
      // Mercado Público
      herramienta('animus_mp_organismos', MpOrganismosSchema),
      herramienta('animus_mp_oportunidades', MpOportunidadesSchema),
      herramienta('animus_mp_detalle', MpDetalleSchema),
      herramienta('animus_mp_ofertas', MpOfertasSchema),
      herramienta('animus_mp_precios', MpPreciosSchema),
      herramienta('animus_mp_ordenes', MpOrdenesSchema),
      // Economía e inteligencia
      herramienta('animus_economic_macro', EconomicMacroSchema),
      herramienta('animus_economic_catalog', EconomicCatalogSchema),
      herramienta('animus_intel_query', IntelQuerySchema),
      herramienta('animus_rag_search', RagSearchSchema),
      herramienta('animus_api_docs', ApiDocsSchema),
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
      case 'animus_mp_ordenes': {
        return await executeMpOrdenes(MpOrdenesSchema.parse(args ?? {}));
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
