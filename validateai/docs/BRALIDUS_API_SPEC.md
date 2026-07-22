# Bralidus Engine — Especificación Técnica, Puntos de Mejora y Decálogo de Seguridad

> **Versión del Sistema:** 1.2.0 (Fase Bralidus Integration & Gateway RaaS)  
> **Servicio Backend:** `BralidusPY` (Python FastApi / GraphRAG MoE en Railway) + `api-v1` (Edge Gateway Hono en Supabase)  
> **Portal Frontend:** `/developers` (`Developers.tsx`, `MacroIntelligence.tsx`, `KnowledgeGraph.tsx`, `CorrelationChart.tsx`)

---

## 1. Arquitectura y Especificación de la API de Bralidus

Bralidus es el motor de Inteligencia de Mercado, Doctrina Normativa, Grafo Societario e Inteligencia B2G del ecosistema. Proporciona una superficie unificada de GraphRAG a través de la API Gateway `api-v1`.

### Endpoints Principales

| Método | Ruta API Gateway | Destino BralidusPY / Backend | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/intel/query` | `/query` | GraphRAG unificado (macro + doctrina + S-Pulse/Licitus si hay `company_rut`). |
| `POST` | `/api/v1/intel/query/moe` | `/query/moe` | Mixture-of-Experts con `GatingNetwork` para enrutamiento por dominio. |
| `GET` | `/api/v1/data/spulse/companies/search` | `/spulse/companies/search` | Búsqueda semántica en el grafo societario chileno. |
| `GET` | `/api/v1/data/spulse/companies/:rut/profile` | `/spulse/companies/:rut/profile` | Estructura legal, socios y poderes. |
| `GET` | `/api/v1/data/spulse/companies/:rut/network` | `/spulse/companies/:rut/network` | Malla societaria e interconexiones societarias. |
| `GET` | `/api/v1/data/licitus/proveedor/:rut` | `/licitus/proveedor/:rut` | Órdenes de compra y comportamiento histórico en Mercado Público. |
| `GET` | `/api/v1/data/licitus/mercado/benchmarks` | `/licitus/mercado/benchmarks` | Tiempos de adjudicación y precios de referencia B2G. |
| `GET` | `/api/v1/data/licitus/mercado/activas` | `/licitus/mercado/activas` | Licitaciones activas filtradas por código UNSPSC y región. |

---

## 2. Puntos de Mejora Identificados (Roadmap de Optimización)

1. **Caché Multinivel de Perfil (`bralidus_context_cache`):**
   - *Estado actual:* Se cachea la 4-tupla `(scope, industry, stage, geography)`.
   - *Mejora:* Implementar una invalidación proactiva (*stale-while-revalidate*) cuando cambian indicadores macro críticos (como UF o Tasa de Política Monetaria) para evitar entregar evidencias desactualizadas durante ventanas de 24h.

2. **Canonización entre Licitus y ChileCompra:**
   - *Estado actual:* `/data/licitus/*` entrega órdenes de compra reales desde la base de Licitus, mientras `/data/chilecompra/metricas` calcula métricas propietarias `M1-M10`.
   - *Mejora:* Consolidar un esquema de respuesta normalizado `LicitusNormalizedPayload` para evitar duplicidad de contratos en el frontend.

3. **Compresión Dinámica de Evidencias (`compressBralidus`):**
   - *Estado actual:* `compressBralidus` concatena evidencias en texto plano para el prompt del LLM.
   - *Mejora:* Implementar deduplicación sintáctica de fragmentos legales repetidos en doctrina y acotar los extractos a máximo 350 tokens por evidencia para no saturar la ventana de contexto.

4. **Resiliencia de Conexión y Circuit Breaker en Edge Gateway:**
   - *Estado actual:* `AbortSignal.timeout(30_000)` en Edge Functions.
   - *Mejora:* Incorporar un patrón Circuit Breaker en `api-v1` para que, tras 3 fallos consecutivos de BralidusPY (HTTP 5xx / timeout), responda inmediatamente con fallback degradado en caché sin agotar el timeout de Deno Deno.serve.

5. **Métricas de Rendimiento y Latencia MoE:**
   - *Estado actual:* No se registra el tiempo de inferencia de cada experto.
   - *Mejora:* Retornar en las respuestas de `/intel/query/moe` la cabecera/propiedad `_latency_breakdown` (ej. `gating_ms`, `retrieval_ms`, `expert_exec_ms`).

---

## 3. Decálogo de Seguridad para Bralidus y API Gateway

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

10. **Encabezados CORS Restringidos y Encabezados de Seguridad:**
    - Respuestas HTTP con control explícito de origen y cabeceras permitidas (`Authorization`, `Content-Type`, `X-Client-Info`), previniendo vulnerabilidades de Cross-Origin Resource Sharing (CORS) e intercepción maliciosa.
