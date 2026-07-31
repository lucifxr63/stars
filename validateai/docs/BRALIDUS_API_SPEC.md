# Bralidus Engine — Especificación Técnica, Puntos de Mejora y Decálogo de Seguridad

> **Versión del Sistema:** 1.3.0 (Fase MoE, PJUD Corte Suprema, Licitus Enriquecido & MCP Server)  
> **Servicio Backend:** `BralidusPY` (Python FastApi / GraphRAG MoE en Railway) + `api-v1` (Edge Gateway Hono en Supabase)  
> **Portal Frontend:** `/developers` (`Developers.tsx`, `MacroIntelligence.tsx`, `KnowledgeGraph.tsx`, `CorrelationChart.tsx`)  
> **Conectores LLM:** `@bralidus/mcp` / `animus-engine-mcp` (Servidor Model Context Protocol nativo para Cursor IDE y Claude Desktop)

---

## 1. Arquitectura y Especificación de la API de Bralidus

Bralidus es el motor de Inteligencia de Mercado, Doctrina Normativa, Grafo Societario e Inteligencia B2G del ecosistema. Proporciona una superficie unificada de GraphRAG y enrutamiento dinámico de expertos (Mixture-of-Experts) a través de la API Gateway `api-v1` y servidores MCP.

### 1.1 Endpoints Principales — API Gateway (`api-v1`)

| Método | Ruta API Gateway | Destino BralidusPY / Backend | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/intel/query` | `/query` | GraphRAG unificado (macro + doctrina + S-Pulse/Licitus si hay `company_rut`). |
| `POST` | `/api/v1/intel/query/moe` | `/query/moe` | Mixture-of-Experts con `GatingNetwork` (5 expertos + Radar Forense para alertas vivas). |
| `GET` | `/api/v1/data/spulse/companies/search` | `/spulse/companies/search` | Búsqueda semántica en el grafo societario chileno. |
| `GET` | `/api/v1/data/spulse/companies/:rut/profile` | `/spulse/companies/:rut/profile` | Estructura legal, socios, poderes y nivel de riesgo. |
| `GET` | `/api/v1/data/spulse/companies/:rut/network` | `/spulse/companies/:rut/network` | Malla societaria e interconexiones societarias 360°. |
| `GET` | `/api/v1/data/licitus/proveedor/:rut` | `/licitus/proveedor/:rut` | Órdenes de compra y comportamiento histórico en Mercado Público. |
| `GET` | `/api/v1/data/licitus/mercado/benchmarks` | `/licitus/mercado/benchmarks` | Tiempos de adjudicación y precios de referencia B2G (percentiles p25/mediana/p75). |
| `GET` | `/api/v1/data/licitus/mercado/activas` | `/licitus/mercado/activas` | Licitaciones activas filtradas por código UNSPSC, región y monto. |
| `GET` | `/api/v1/data/chilecompra/metricas` | `chilecompra-calcular` | Métricas propietarias M1-M10 e historial analítico B2G. |

### 1.2 Fuentes de Datos Especializadas Integradas en Doctrina y Grafo
- **Doctrina Normativa y Poder Judicial (PJUD):**  
  - Ingesta integral de causas judiciales de la **Corte Suprema** (`pjud_suprema_detalle` con 124.245 filas y causa de término).  
  - Cuadratura e identidad forense garantizada mediante la clave de conflicto `(LIBRO, ROL, ANO_ROL, FECHA_FALLO, SALA)`, resolviendo reiteraciones de fallos en diferentes semestres.
  - Estadísticas judiciales consolidadas (`pjud_estadisticas`) y auditoría de origen.
- **Inteligencia B2G y Enriquecimiento Continuo (Licitus / Mercado Público):**  
  - Pipeline de enriquecimiento escalable en Durable Workflows (`enrich-ordenes.workflow.ts`).  
  - Encadenamiento de hasta 10 pasadas por disparo, con lotes calibrados de 90 OCs por step (~252s de ejecución por invocación) para asegurar 16% de margen de seguridad frente al límite de 300s del runtime, drenando el backlog B2G (~12.000 OCs/día) sin interrupciones ni timeouts.

---

## 2. Puntos de Mejora y Roadmap de Optimización (Estado Real vs. Próximos Hitos)

1. **Enriquecimiento Escalable B2G (`enrich-ordenes`): [COMPLETADO]**
   - *Logro:* Se resolvió el cuello de botella de 100 OCs/día mediante encadenamiento de pasadas (`use step`) con margen defensivo del 16% (90 ítems por lote), aumentando el caudal a ~1.000 OCs por disparo (12 corridas diarias).
2. **Cuadratura Judicial e Identidad Forense PJUD: [COMPLETADO]**
   - *Logro:* Se descubrió e implementó la identidad formal con `FECHA_FALLO` y deduplicación por clave de conflicto en `pjud_suprema_detalle`, eliminando pérdidas silenciosas en el batch de inserción de Postgres.
3. **Caché Multinivel de Perfil (`bralidus_context_cache`): [EN CURSO]**
   - *Estado actual:* Se cachea la 4-tupla `(scope, industry, stage, geography)` con control RLS estricto.
   - *Mejora pendiente:* Implementar invalidación proactiva (*stale-while-revalidate*) al detectar cambios macro críticos (UF, TPM, IPC BCCh).
4. **Procedencia Comprobable y Citas Verificables (`evidence[]`): [EN CURSO]**
   - *Estado actual:* `compressBralidus` concatena evidencias en texto plano para el prompt.
   - *Mejora pendiente:* Estandarizar citas inline del formato `[FUENTE Bralidus · {experto}] {document_title}: {ultimo_valor} {unidad} ({ultima_fecha})` y renderizarlas en el `EvidenceWall` con badge de frescura.
5. **Canonización entre Licitus y ChileCompra: [BACKLOG]**
   - *Mejora pendiente:* Consolidar el esquema de respuesta normalizado `LicitusNormalizedPayload` entre `/data/licitus/*` (órdenes de compra) y `/data/chilecompra/metricas` (M1-M10).

---

## 3. Decálogo de Seguridad y Resiliencia para Bralidus y API Gateway

1. **Aislamiento Absoluto de Secretos (Zero-Leak Proxy Pattern):**
   - La API Key máster de `BRALIDUS_API_KEY` reside **únicamente** en las variables de entorno server-side de Supabase Edge Functions. El cliente/navegador nunca ve esta llave; autentica contra `api-v1` usando su propia `Developer API Key` (`val_live_...`).

2. **Auditoría Hash Unidireccional de API Keys:**
   - En la tabla `api_keys`, la llave del desarrollador no se almacena en texto plano. Se calcula su hash `SHA-256` en el servidor y se compara mediante `crypto.subtle.digest`. Si la base de datos se compromete, las llaves originales siguen a salvo.

3. **Control de Rate Limiting Multinivel:**
   - Implementación de límite de tasa defensivo (100 req/min por API Key en `rateLimitMiddleware`) y restricción de `top_k` (máximo 25) para prevenir ataques de denegación de servicio (DoS) o consumo desmedido de recursos GPU/RAG en BralidusPY.

4. **Sanitización Estricta de Parámetros y Prevención de Inyección RAG:**
   - Validación y limpieza del parámetro `query` (longitud entre 3 y 2000 caracteres). Escape de caracteres especiales antes de construir los embeddings o consultas Cypher/pgvector para evitar *Prompt Injection* y *Vector Search Poisoning*.

5. **Validación Formal de Identificadores (RUT Módulo 11):**
   - Todos los parámetros `:rut` consumidos en los endpoints de S-Pulse y Licitus se procesan con `encodeURIComponent` y se validan contra la sintaxis chilena (RUT con dígito verificador) previa transmisión a la base de datos o BralidusPY.

6. **K-Anonymity y Privacidad Financiera Pyme:**
   - Las métricas comparativas entre Pymes e indicadores macro (en `CorrelationChart`) aplican agregación y suavizado previo para evitar la re-identificación de empresas en sectores con baja densidad de competidores.

7. **Políticas RLS Zero-Trust en Tablas de Caché:**
   - La tabla `public.bralidus_context_cache` posee `ROW LEVEL SECURITY` habilitado con política restrictiva: `REVOKE ALL ON FUNCTION bump_bralidus_cache_hit FROM public, anon, authenticated; GRANT EXECUTE TO service_role;`. El cliente no puede manipular ni leer la caché directamente.

8. **Firma HMAC en Webhooks:**
   - Todos los eventos despachados a webhooks registrados por desarrolladores (`/api/v1/webhooks`) incluyen una firma HMAC SHA-256 en la cabecera `X-Validus-Signature`, permitiendo al receptor autenticar que el payload proviene legítimamente del ecosistema.

9. **Timeouts Defensivos y AbortSignal:**
   - Cada llamada HTTP desde Edge Gateway hacia BralidusPY está acotada mediante `AbortSignal.timeout(12_000)` o `30_000`. Esto previene el agotamiento de sockets de red y ataques de colgado de conexiones en Edge Runtime.

10. **Telemetría y Observabilidad en Sala de Control (Ops Control Room):**
    - Despliegues automáticos de Edge Functions y alarmas de degradación en canales de avisos emiten alertas automáticas a la Sala de Control (`DISCORD_DEPLOYS_WEBHOOK`, `ops_webhook_health`), con trazabilidad inmediata de versión y commit.

11. **Encabezados CORS Restringidos y Encabezados de Seguridad:**
    - Respuestas HTTP con control explícito de origen y cabeceras permitidas (`Authorization`, `Content-Type`, `X-Client-Info`), previniendo vulnerabilidades de Cross-Origin Resource Sharing (CORS) e intercepción maliciosa.

