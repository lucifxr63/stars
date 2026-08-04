import { raasGet } from '../client/raasClient.js';

export const API_DOCS_RESOURCE = {
  uri: 'animus://docs/api-v1',
  name: 'Especificación Arquitectónica — Animus Engine / Bralidus RaaS v1',
  description: 'Documentación técnica completa del RaaS API Gateway v1, endpoints canónicos, autenticación Bearer Token y esquemas de datos.',
  mimeType: 'text/markdown',
};

export const HEALTH_RESOURCE = {
  uri: 'animus://health/services',
  name: 'Estado de Salud en Vivo — 28 Microservicios Animus Engine',
  description: 'Diagnóstico en tiempo real del clúster de Base de Datos (PostgreSQL/pgvector), motores IA y conexiones gubernamentales.',
  mimeType: 'application/json',
};

const API_DOCS_MARKDOWN = `# Especificación Arquitectónica: Animus Engine / Bralidus RaaS v1

## 1. Descripción
Animus Engine RaaS Gateway sirve datos en tiempo real (0 mocks) desde Supabase y el motor de inteligencia en Railway (BralidusPY).

## 2. Endpoints Canónicos
- **GET /data/macro**: Retorna indicadores macroeconómicos de Chile (UF diaria de la CMF, UTM, TPM, etc.).
- **GET /data/economy**: Catálogo completo multi-proveedor de series en BD (CMF, SII, BCCh, FRED).
- **POST /intel/query**: Búsqueda en el Grafo de Conocimiento MoE (Mixture of Experts).
- **POST /rag/query**: Consulta vectorial semántica con síntesis markdown y citas (Ley Fintech 21.521).
- **GET /mercado-publico/licitaciones**: Oportunidades públicas B2G activas en Mercado Público.
- **GET /mercado-publico/compra-agil**: Compras ágiles B2G en tiempo real.
- **GET /health/services**: Monitoreo de 28 microservicios del ecosistema.

## 3. Autenticación
Todas las peticiones requieren \`Authorization: Bearer <API_KEY>\`.
La clave se obtiene en https://animus.scouttech.lat y es **obligatoria**: no existe una clave pública compartida.`;

export async function readResource(uri: string) {
  if (uri === API_DOCS_RESOURCE.uri) {
    return {
      contents: [
        {
          uri: API_DOCS_RESOURCE.uri,
          mimeType: API_DOCS_RESOURCE.mimeType,
          text: API_DOCS_MARKDOWN,
        },
      ],
    };
  }

  if (uri === HEALTH_RESOURCE.uri) {
    const health = await raasGet('/health/services');
    return {
      contents: [
        {
          uri: HEALTH_RESOURCE.uri,
          mimeType: HEALTH_RESOURCE.mimeType,
          text: JSON.stringify(health, null, 2),
        },
      ],
    };
  }

  throw new Error(`Recurso MCP desconocido: ${uri}`);
}
