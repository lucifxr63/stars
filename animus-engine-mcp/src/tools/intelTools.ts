import { z } from 'zod';
import { raasPost } from '../client/raasClient.js';

export const IntelQuerySchema = z.object({
  query: z.string().describe('Consulta en lenguaje natural al Grafo de Conocimiento MoE (ej: "¿Cuál es la Tasa de Política Monetaria fijada por el Banco Central en Chile?")'),
});

export const RagSearchSchema = z.object({
  query: z.string().describe('Búsqueda semántica en el Knowledge Base normativo con síntesis markdown y citas fehacientes (ej: "Regulación Ley Fintech 21.521 en Chile")'),
});

export async function executeIntelQuery(args: z.infer<typeof IntelQuerySchema>) {
  const result = await raasPost('/intel/query', { query: args.query });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
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
          ? `# Respuesta Normativa Animus (Vector RAG)\n\n${result.answer}\n\n## Citas y Referencias\n\`\`\`json\n${JSON.stringify(result.citations || [], null, 2)}\n\`\`\``
          : JSON.stringify(result, null, 2),
      },
    ],
  };
}

export const ApiDocsSchema = z.object({}).describe('Obtener la documentación pública y especificación del API de Animus Engine (NO REQUIERE AUTENTICACIÓN). Úsalo para saber cómo llamar los endpoints o cómo conectar la app del usuario.');

export async function executeApiDocs() {
  const docsText = `# Especificación Oficial Animus Engine / Bralidus RaaS API v1

**Base URL de Producción**: https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/api-v1
**Autenticación**: Encabezado HTTP \`Authorization: Bearer <TU_API_KEY>\` (o \`?apikey=<TU_API_KEY>\`).
La clave se obtiene en https://animus.scouttech.lat y es **obligatoria**: no hay clave pública compartida.

## Herramientas disponibles en este MCP

### Corte Suprema de Chile (1.706.941 causas, 2020-2025)
- \`animus_pjud_tendencias\`: serie por año — volumen, % confirmados/revocados, duración media
- \`animus_pjud_resumen\`: totales por año, serie, libro, tipo de recurso, sala
- \`animus_pjud_causas\`: causas individuales, filtrables
- \`animus_pjud_causa\`: historia completa de una causa (devuelve un ARREGLO)
- \`animus_pjud_estadisticas\`: series agregadas (presupuesto, dotación, cuenta pública)

### Mercado Público (B2G)
- \`animus_mp_oportunidades\`: buscador unificado de licitaciones y compras ágiles
- \`animus_mp_organismos\`: directorio de 33.682 organismos compradores
- \`animus_licitus_activas\`: licitaciones abiertas
- \`animus_licitus_compra_agil\`: compras ágiles

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
