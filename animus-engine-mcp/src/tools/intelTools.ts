import { z } from 'zod';
import { raasPost } from '../client/raasClient.js';

export const DESC_INTEL_QUERY =
  'Consulta en lenguaje natural al Grafo de Conocimiento MoE (Mixture of Experts) de Animus ' +
  'Engine (ej: "¿Cuál es la Tasa de Política Monetaria en Chile?")';

export const DESC_RAG_SEARCH =
  'Búsqueda semántica (Vector RAG) en la Base de Conocimiento con síntesis en Markdown y ' +
  'citas fehacientes de leyes y normas chilenas.';

export const IntelQuerySchema = z.object({
  query: z.string().describe('Consulta en lenguaje natural al Grafo de Conocimiento MoE (ej: "¿Cuál es la Tasa de Política Monetaria fijada por el Banco Central en Chile?")'),
}).describe(DESC_INTEL_QUERY);

export const RagSearchSchema = z.object({
  query: z.string().describe('Búsqueda semántica en el Knowledge Base normativo con síntesis markdown y citas fehacientes (ej: "Regulación Ley Fintech 21.521 en Chile")'),
}).describe(DESC_RAG_SEARCH);

export async function executeIntelQuery(args: z.infer<typeof IntelQuerySchema>) {
  const result = await raasPost('/intel/query', { query: args.query });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result),
      },
    ],
  };
}

export async function executeRagSearch(args: z.infer<typeof RagSearchSchema>) {
  const result = await raasPost('/rag/query', { query: args.query });
  return {
    content: [
      {
        type: 'text',
        text: typeof result.answer === 'string'
          ? `# Respuesta Normativa Animus (Vector RAG)\n\n${result.answer}\n\n## Citas y Referencias\n\`\`\`json\n${JSON.stringify(result.citations || [])}\n\`\`\``
          : JSON.stringify(result),
      },
    ],
  };
}

export const DESC_API_DOCS =
  'Obtener la documentación pública, especificación técnica y guía de integración del API ' +
  'Animus Engine / Bralidus RaaS (NO REQUIERE AUTENTICACIÓN NI API KEY). Úsalo primero si el ' +
  'usuario pregunta por documentación o cómo integrar.';

export const ApiDocsSchema = z.object({}).describe(DESC_API_DOCS);

export async function executeApiDocs() {
  const docsText = `# Especificación Oficial Animus Engine / Bralidus RaaS API v1

**Base URL de Producción**: https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1
**Autenticación**: Encabezado HTTP \`Authorization: Bearer <TU_API_KEY>\`.
El gateway todavía acepta \`?apikey=\` por compatibilidad, pero **no lo uses**: las
query strings quedan escritas en los logs del servidor, en los de cualquier proxy
intermedio y en los historiales.
La clave se obtiene en https://animus.scouttech.lat y es **obligatoria**: no hay clave pública compartida.

## Herramientas disponibles en este MCP

### Corte Suprema de Chile (1.706.941 causas, 2020-2025)
- \`animus_pjud_tendencias\`: serie por año — volumen, % confirmados/revocados, duración media
- \`animus_pjud_resumen\`: totales por año, serie, libro, tipo de recurso, sala
- \`animus_pjud_causas\`: causas individuales, filtrables
- \`animus_pjud_causa\`: historia completa de una causa (devuelve un ARREGLO)
- \`animus_pjud_estadisticas\`: series agregadas (presupuesto, dotación, cuenta pública)

### Mercado Público — compras del Estado (B2G)
- \`animus_mp_oportunidades\`: buscador unificado de las CUATRO vías de compra.
  \`type\`: \`tender\` licitación (15.669) · \`agile_purchase\` compra ágil (44.545) ·
  \`convenio_marco\` catálogo ya licitado (274) · \`trato_directo\` adjudicación sin
  competencia (40). Omitir \`type\` busca en las cuatro. Total 60.528 al 2026-08-12.
  Filtros: \`q\`, \`status\`, \`region\`, \`buyer_rut\`, \`buyer_name\`, \`amount_min\`,
  \`amount_max\`, \`closing_from\`, \`closing_to\`, más \`sort\` y \`order\`.
- \`animus_mp_detalle\`: ficha completa de una oportunidad, por su \`external_code\`
- \`animus_mp_ofertas\`: la COMPETENCIA — quién cotizó, cuánto, quién ganó y por qué
  se declaró inadmisible al resto. Por \`codigo\` (una compra) o por \`rut\` (un
  proveedor, con su tasa de adjudicación). 16.919 ofertas de 3.990 proveedores
  sobre 3.122 compras. Sólo compras ágiles concluidas: 3.122 de 44.545 (7 %).
- \`animus_mp_organismos\`: directorio de organismos compradores (2.705 distintos)

### Economía e inteligencia
- \`animus_economic_macro\`: UF diaria CMF, UTM, USD/CLP, cobre, WTI, Fed funds, IPC USA
- \`animus_economic_catalog\`: catálogo completo de series
- \`animus_intel_query\`: consulta en lenguaje natural al Grafo MoE
- \`animus_rag_search\`: búsqueda normativa con citas de leyes chilenas

## Integración Directa por cURL / HTTP
Peticiones HTTP directas a la Base URL con \`Authorization: Bearer <TU_API_KEY>\`.
Documentación pública web: https://animus.scouttech.lat/llms.txt`;

  return {
    content: [
      {
        type: 'text',
        text: docsText,
      },
    ],
  };
}
