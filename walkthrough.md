# Walkthrough: Arquitectura de Control de Costos y Tiers Bralidus RaaS API

## ✅ Cambios Implementados

### 1. Sistema de Créditos Ponderados por Endpoint (`ratelimit.ts` & `usage.ts`)
Para evitar sobrecostos en llamadas intensivas de LLM / GraphRAG, se reemplazó el conteo plano de peticiones por un **modelo de créditos ponderados**:

| Endpoint | Tipo de Proceso | Créditos Consumidos |
|---|---|---|
| `GET /api/v1/data/economy` | Lectura Caché | **1 crédito** |
| `GET /api/v1/data/spulse/*` | Consulta DB | **2 créditos** |
| `GET /api/v1/data/licitus/proveedor/*` | Inteligencia B2G | **3 créditos** |
| `GET /api/v1/data/licitus/proveedor/*/vs-mercado` | Cruce Completo | **4 créditos** |
| `POST /api/v1/rag/query` | pgvector HNSW | **5 créditos** |
| `POST /api/v1/rag/ingest/text` | Vectorización | **10 créditos** |
| `POST /api/v1/intel/query` | GraphRAG + 1 LLM | **15 créditos** |
| `POST /api/v1/intel/query/moe` | Gating + 3 Expertos | **35 créditos** |
| `POST /functions/v1/assemble-mega-prompt` | MegaPrompt 16 Dims | **120 créditos** |

### 2. Matriz de Cuotas por Plan y Burst Limits
- **Free**: 0 créditos (sin acceso a API Key — redirige a `/pricing`).
- **Basic**: **1.000 créditos/mes** · Burst: **60 req/min** (Ideal para MVPs).
- **Pro**: **15.000 créditos/mes** · Burst: **180 req/min** (SaaS en producción).
- **Premium**: **100.000 créditos/mes** · Burst: **300 req/min** (High Throughput).
- **Admin**: **1.000.000 créditos/mes** · Burst: **600 req/min** (Testing ilimitado).
- **Enterprise**: **5.000.000 créditos/mes** · Burst: **1200 req/min** (SLA dedicado).

### 3. Response Headers Estándar HTTP OpenAPI
Cada respuesta de la API ahora inyecta:
- `X-RateLimit-Limit-Credits`: Cuota total del plan.
- `X-RateLimit-Remaining-Credits`: Créditos restantes en el mes.
- `X-RateLimit-Tier`: Nombre del plan activo (`basic`, `pro`, `premium`, `admin`).
- `X-RateLimit-Request-Cost`: Costo en créditos de la llamada actual.

### 4. Rediseño del Tab "Cuotas & Tiers" en Developer Portal (`QuotasTab.tsx`)
- Medidor de consumo de créditos en vivo con barra de progreso codificada por color (Verde < 70%, Amarillo 70-90%, Rojo > 90%).
- Tabla interactiva de costos en créditos por endpoint.
- Tarjetas comparativas de planes (`Basic`, `Pro`, `Premium`, `Enterprise`) con botón directo a `/pricing`.

---

## 🔍 Verificación

- `npm run build` en developer portal → **✓ 0 errores TypeScript, built in 1.14s**.
- Commits & push en repositorios `stars` (main) y `Bralidus` (master).
