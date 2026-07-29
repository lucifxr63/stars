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
**Clave de Demostración Pública**: \`demo_public_key\`

## Endpoints Principales disponibles en este MCP
- \`animus_economic_macro\`: UF oficial diaria CMF, UTM, TPM, USD/CLP (GET /data/macro)
- \`animus_intel_query\`: Consulta en lenguaje natural al Grafo MoE de 696 nodos (POST /intel/query)
- \`animus_rag_search\`: Búsqueda normativa con citas de leyes chilenas (POST /rag/query)
- \`animus_licitus_activas\`: Licitaciones públicas B2G abiertas en Mercado Público (GET /mercado-publico/licitaciones)
- \`animus_licitus_compra_agil\`: Compras ágiles en tiempo real (GET /mercado-publico/compra-agil)

## Integración Directa por cURL / HTTP
Puedes ejecutar peticiones HTTP directamente a la Base URL indicando \`Authorization: Bearer demo_public_key\`.
Documentación pública web: https://bralidus.vercel.app/llms.txt`;

  return {
    content: [
      {
        type: 'text',
        text: docsText,
      },
    ],
  };
}
