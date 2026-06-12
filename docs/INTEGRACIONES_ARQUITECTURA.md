# Validus — Mapa de Integraciones y Arquitectura de Datos

> Documento técnico para revisión de equipo.  
> Fecha: 2026-05-24 | Rama analizada: `main` (commit `1585bcb`)

---

## Índice

1. [Inventario de Edge Functions](#1-inventario-de-edge-functions)
2. [Mapa de Integraciones Externas](#2-mapa-de-integraciones-externas)
3. [Estrategia de Caché — Actual vs Recomendada](#3-estrategia-de-caché--actual-vs-recomendada)
4. [Qué necesita Sync Programado (Cron)](#4-qué-necesita-sync-programado-cron)
5. [Qué debe ser Real-Time (on-demand)](#5-qué-debe-ser-real-time-on-demand)
6. [Qué NO necesita caché](#6-qué-no-necesita-caché)
7. [Problemas de Seguridad detectados](#7-problemas-de-seguridad-detectados)
8. [Deuda Técnica e Integraciones Incompletas](#8-deuda-técnica-e-integraciones-incompletas)
9. [Preguntas abiertas para el equipo](#9-preguntas-abiertas-para-el-equipo)

---

## 1. Inventario de Edge Functions

| Función | Propósito | Estado |
|---|---|---|
| `ai-validate` | Validación wizard (flujo principal) | ✅ Activa |
| `api-v1` | Gateway RaaS (API pública para devs) | ✅ Activa |
| `sii-proxy` | Consulta empresa por RUT en SII | ✅ Activa |
| `market-analyze` | Análisis de mercado (BCE + INE + Chile Abierto + Mercado Público) | ✅ Activa |
| `sync-economic-data` | Sync manual de indicadores CMF + SII al knowledge base | ⚠️ Sin cron |
| `inapi-fetch` | Búsqueda de marcas en INAPI | ❌ Mockeada |
| `webhook-pjud` | Receptor de datos judiciales (PJUD) | ⚠️ Webhook pasivo |
| `assemble-mega-prompt` | Ensamblado del mega-prompt para Claude | ✅ Activa |
| `premium-validate` | Validación tier premium | ✅ Activa |
| `anonymize-idea` | Anonimización de ideas antes del LLM | ✅ Activa |
| `parse-project` | Parsing de proyectos | ✅ Activa |
| `validate-rut` | Validación formato RUT | ✅ Activa |
| `posthog-proxy` | Reverse proxy telemetría PostHog | ✅ Activa |
| `create-checkout` | Creación sesión de pago | ✅ Activa |
| `lemonsqueezy-webhook` | Receptor webhooks de LemonSqueezy (pagos) | ✅ Activa |
| `fintoc-link` | Link bancario Fintoc | ⚠️ Sin claridad de uso |
| `fintoc-webhook` | Receptor webhooks Fintoc | ⚠️ Sin claridad de uso |
| `figma-oauth-handler` | OAuth Figma | ✅ Activa |
| `ai-figma-bridge` | Bridge Figma ↔ Claude | ✅ Activa |
| `generate-carousel` | Generación contenido (carrusel) | ✅ Activa |
| `generate-content-story` | Generación contenido (story) | ✅ Activa |
| `register-consent` | Registro de consentimiento legal | ✅ Activa |

---

## 2. Mapa de Integraciones Externas

### 2.1 APIs de Gobierno Chileno

---

#### SII — Servicio de Impuestos Internos
- **Función:** `sii-proxy/index.ts` + llamada interna desde `validate.ts`
- **URL:** `https://app.apigateway.cl/api/v2/sii/contribuyentes/{rut}`
- **Tipo de llamada:** On-demand por validación (se llama cada vez que un usuario valida con RUT)
- **Caché:** ❌ No tiene caché — cada validación hace una llamada en vivo
- **Autenticación:** `SII_API_KEY` — hardcodeada con fallback (`6beb0b4a...`)
- **Datos que retorna:**
  - `razon_social`, `inicio_actividades`, `actividades_economicas` (códigos CIIU)
  - `estado_tributario`: Vigente / Sin Inicio / Bloqueado / No Existe
  - `anotaciones_vigentes`
- **Fallback:** Si la API falla, devuelve datos mock con `estado='unknown'`
- **Estado en dashboard:** Amarillo (sin consultas recientes en tabla)
- **Decisión pendiente:** ¿Cachear por RUT? ¿Por cuánto tiempo? (ver sección 3)

---

#### BCE / Banco Central de Chile
- **Función:** `market-analyze/index.ts`
- **URL:** `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx`
- **Tipo de llamada:** On-demand al abrir análisis de mercado, con caché
- **Caché:** ✅ Tabla `market_bde_data` — si hay ≥3 puntos, no llama a la API
- **Autenticación:** `BDE_USER` + `BDE_PASS` (desde Supabase Secrets)
- **Series activas:**
  - `G073.IPC.IND.2023.M` — IPC General base 2023 ✓
  - `G073.IPC.V12.2023.M` — IPC variación anual ✓
- **Series pendientes:** Series sectoriales (IMACEC por sector) — placeholder vacío en código
- **Estado en dashboard:** Verde (datos en caché)
- **Decisión pendiente:** ¿Agregar IMACEC sectoriales? Requiere validar IDs contra catálogo BCCh

---

#### INE — Instituto Nacional de Estadísticas
- **Función:** `market-analyze/index.ts`
- **URL:** `https://rapps.ine.cl:9292/predict`
- **Tipo de llamada:** On-demand por análisis, con caché por texto de entrada
- **Caché:** ✅ Tabla `market_ine_classifications` — key = texto normalizado
- **Autenticación:** Sin clave (API pública de clasificación CAENES)
- **Qué hace:** Clasifica la idea en sector CAENES (Código de Actividad Económica Nacional)
- **Fallback:** Si falla, usa CAENES='G' (comercio genérico)
- **Estado en dashboard:** Verde (clasificaciones en caché)
- **Riesgo:** La URL `rapps.ine.cl:9292` es poco estándar — puede cambiar sin aviso

---

#### CMF — Comisión para el Mercado Financiero
- **Funciones:** `sync-economic-data/index.ts` + `validate.ts` (llamada directa)
- **URL:** `https://api.cmfchile.cl/api-sbifv3/recursos_api/uf/{año}/{mes}/dias`
- **Tipo de llamada dual:**
  - `validate.ts`: llama en vivo en cada validación para obtener UF del día
  - `sync-economic-data`: sync manual → guarda en `economic_knowledge`
- **Caché:** ⚠️ Parcial — `economic_knowledge` tiene datos de sync, pero `validate.ts` no lo usa
- **Autenticación:** `CMF_API_KEY` — hardcodeada en ambos archivos
- **Datos:** Valor UF diario por mes/año
- **Estado en dashboard:** Amarillo (economic_knowledge sin datos UF — sync no ejecutado)
- **Problema:** Hay dos rutas para el mismo dato (live en validate.ts + caché en economic_knowledge) que no están unificadas

---

#### INAPI — Instituto Nacional de Propiedad Industrial
- **Función:** `inapi-fetch/index.ts`
- **URL:** Ninguna — respuesta completamente mockeada
- **Tipo de llamada:** Mock con delay simulado de 1.5s
- **Caché:** ✅ Guarda en `temp_context` con `source='inapi'` — pero son datos falsos
- **Datos simulados:** Marcas similares random, `risk_level: 'medium'` fijo
- **Comentario en código:** "En la realidad, INAPI Open Data ofrece un OData endpoint o descargas en bloque."
- **Estado en dashboard:** Amarillo (degraded — mock explícito)
- **Decisión pendiente:** ¿Integrar OData real? ¿Bulk download semanal? (ver sección 4)

---

#### PJUD — Poder Judicial
- **Función:** `webhook-pjud/index.ts`
- **Tipo:** Receptor de webhook (PJUD empuja datos, no se consulta directamente)
- **Autenticación:** HMAC-SHA256 sobre `x-pjud-signature`
- **Caché:** Guarda en `temp_context` con `source='pjud'`, `status='pending'`
- **Consumidor:** `assemble-mega-prompt` recoge los datos async
- **Estado en dashboard:** Amarillo (webhook pasivo sin polling)
- **Decisión pendiente:** ¿Hay un proveedor que nos empuja datos de PJUD? ¿O esto requiere integrarse con un intermediario?

---

### 2.2 APIs de IA / Modelos

| Servicio | Función | Modelo | Caché |
|---|---|---|---|
| **Anthropic Claude** | Validación, generación de contenido, mega-prompt | `claude-sonnet-4-6` | ✅ Semantic cache (0.92 threshold en `search_cached_analyses`) |
| **OpenAI** | Embeddings para RAG y búsqueda semántica | `text-embedding-3-small` (1536d) | ✅ Los vectores se guardan en `knowledge_nodes` / `tenant_vectors` |

---

### 2.3 Analytics y Pagos

| Servicio | Función | Estado |
|---|---|---|
| **PostHog** | Telemetría comportamental (eventos, funnel, paywall) | ✅ Reverse proxy activo |
| **LemonSqueezy** | Pagos y suscripciones | ✅ Webhook activo |
| **Fintoc** | Link bancario (¿verificación de cuenta? ¿pagos?) | ⚠️ Funciones desplegadas pero sin claridad de uso actual |

---

### 2.4 Herramientas de Contenido y Dev

| Servicio | Función | Estado |
|---|---|---|
| **Figma** | Generación de assets desde datos de validación | ✅ OAuth + Bridge activos |
| **LlamaParse** | Parsing de documentos PDF/Word para ingestión RAG | ✅ API key configurada |
| **GitHub Actions** | Sync automático vault Obsidian → Supabase | ✅ Activo en `validateai-knowledge-vault` |

---

### 2.5 Integraciones Pendientes (Sin uso real aún)

| Servicio | Descripción | Impacto si se integra |
|---|---|---|
| **SerpApi** | Google Trends — tendencias de búsqueda por keyword | Análisis de demanda en tiempo real |
| **Reddit API** | Señales de mercado desde comunidades | Validación cualitativa de problemas |
| **IMACEC Sectoriales (BCE)** | Series económicas por sector | Contexto macroeconómico específico por industria |

---

## 3. Estrategia de Caché — Actual vs Recomendada

### Regla general de decisión

```
¿El dato cambia más de una vez por día?
  SÍ → Real-time con caché corta (TTL ≤ 24h)
  NO → Sync programado + caché larga
  NUNCA → Ingestión manual o bulk + caché permanente (hasta nuevo sync)
```

---

| Servicio | Frecuencia de cambio real | Caché actual | Caché recomendada | TTL sugerido |
|---|---|---|---|---|
| **SII empresa** | Solo cambia si la empresa modifica situación tributaria (raro) | ❌ Sin caché | ✅ Cachear por RUT en tabla `sii_empresa_cache` | 7 días |
| **CMF — UF del día** | 1 vez por día (valor publicado diariamente) | ⚠️ Llamada live en cada validación | ✅ Cron diario → `economic_knowledge` + leer desde allí | 24h |
| **BCE — IPC** | 1 vez por mes | ✅ `market_bde_data` | Mantener — agregar cron mensual | 30 días |
| **INE — CAENES** | Depende del texto (clasificación estática per texto) | ✅ `market_ine_classifications` | Mantener — caché permanente por texto | Indefinido |
| **INAPI marcas** | Actualización bulk periódica (datos históricos) | ❌ Mock | Bulk download semanal → tabla `inapi_marcas` | 7 días |
| **Claude responses** | Por consulta única | ✅ Semantic cache 0.92 | Mantener — quizás bajar threshold a 0.88 para mayor hit rate | Por sesión |
| **Embeddings** | Estáticos una vez generados | ✅ `knowledge_nodes` / `tenant_vectors` | Mantener | Permanente |
| **PJUD** | Push async (no controlamos frecuencia) | ✅ `temp_context` | Mantener + mover a tabla dedicada `pjud_registros` | Depende del proveedor |

---

## 4. Qué necesita Sync Programado (Cron)

Actualmente **no hay ningún cron configurado**. Todo es on-demand o manual.

### Crons prioritarios a crear

#### 🔴 CRÍTICO — CMF UF Diario
- **Qué:** Valor de la UF del día desde `api.cmfchile.cl`
- **Cuándo:** Todos los días a las 00:30 (CMF publica al cierre del día anterior)
- **Guarda en:** `economic_knowledge` o tabla dedicada `indicadores_cmf`
- **Por qué:** Hoy cada validación hace una llamada live a CMF. Si CMF está caída, el dato de UF falla silenciosamente. Con cron, si CMF falla, usamos el último dato cacheado.
- **Implementación:** Activar cron en Supabase Dashboard → Edge Function `sync-economic-data` con `{ provider: 'CMF', indicator: 'uf_mes', param: '...' }`

#### 🟡 IMPORTANTE — BCE IPC Mensual
- **Qué:** Series IPC General + IPC variación anual desde Banco Central
- **Cuándo:** 1er día de cada mes a las 06:00
- **Guarda en:** `market_bde_data` (ya existe)
- **Por qué:** El caché actual se puebla la primera vez que alguien abre el análisis de mercado. Si la tabla está vacía, el usuario espera la llamada a BCE (puede ser lenta). Con cron, el caché siempre está precalentado.

#### 🟡 IMPORTANTE — INAPI Bulk Semanal
- **Qué:** Descarga bulk del OData de INAPI (`datos.inapi.cl`) con marcas registradas
- **Cuándo:** Domingo a las 02:00
- **Guarda en:** Nueva tabla `inapi_marcas` con índice de búsqueda fuzzy
- **Por qué:** Actualmente datos son 100% inventados (mock random). INAPI publica datos abiertos — hay una API OData real.
- **Decisión de equipo necesaria:** ¿Integración bulk o query on-demand por nombre de marca?

#### 🔵 NICE TO HAVE — Vault Obsidian
- **Qué:** Ya existe vía GitHub Actions — el vault se sincroniza en cada push a `main`
- **Cuándo:** Ya configurado (event-driven, no time-based)
- **Estado:** ✅ Funcional — no requiere cambios

---

## 5. Qué debe ser Real-Time (on-demand)

Estos servicios **deben llamarse en vivo** porque el dato es único por consulta o varía por usuario:

| Servicio | Razón para ser real-time |
|---|---|
| **SII por RUT** | El RUT es único por empresa. No tiene sentido pre-cachear todos los RUTs. Cachear on-demand (por RUT + TTL 7 días) es suficiente. |
| **INE CAENES** | La clasificación depende del texto libre de la idea. Imposible pre-cachear. El caché por texto normalizado ya es óptimo. |
| **Anthropic Claude** | La respuesta depende del mega-prompt completo (idea + RUT + mercado + playbooks). El semantic cache a 0.92 ya captura duplicados. |
| **OpenAI Embeddings** | Se generan una vez por texto y se guardan. No repetir. |
| **PJUD** | Datos llegados por webhook — no se controla cuándo llegan. |

---

## 6. Qué NO necesita caché

| Servicio | Razón |
|---|---|
| **PostHog** | Es un sistema de analytics one-way. No se consulta, solo se envía. |
| **LemonSqueezy webhook** | Receptor de eventos de pago — stateless por diseño. |
| **Fintoc webhook** | Receptor de eventos bancarios — stateless. |
| **Validate RUT** | Solo verifica formato local, sin llamada externa. |
| **Anonymize idea** | Transformación stateless en memoria. |

---

## 7. Problemas de Seguridad detectados

> **Estos ítems deben resolverse antes de escalar a más usuarios.**

### 🔴 API Keys hardcodeadas en código fuente

Las siguientes claves están en el código y **viajan a GitHub**:

| Clave | Archivo | Valor expuesto |
|---|---|---|
| `SII_API_KEY` | `sync-economic-data/index.ts:8` | `6beb0b4a869028e8031f7862a039dede5f759bc8` |
| `SII_API_KEY` | `sii-proxy/index.ts:11` | Fallback al mismo valor |
| `CMF_API_KEY` | `sync-economic-data/index.ts:7` | `e2010e01e27a9d44779a8dc9a1bd2c00887227c7` |
| `CMF_API_KEY` | `validate.ts:11` | `2a1b3c4d5e6f7g8h` (placeholder distinto — ¿cuál está en prod?) |

**Acción recomendada:**
1. Revocar las keys expuestas en apigateway.cl y CMF
2. Regenerar y guardar como Supabase Secrets (`SII_API_KEY`, `CMF_API_KEY`)
3. Reemplazar hardcode por `Deno.env.get('SII_API_KEY')!` sin fallback

---

### 🔴 sync-economic-data usa anon key (no service role)

```typescript
// sync-economic-data/index.ts:16-19
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',  // ← debería ser SERVICE_ROLE_KEY
  { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
)
```

Con anon key, la función queda limitada por RLS. Si las tablas tienen políticas que requieren autenticación, el sync puede fallar silenciosamente.

**Acción:** Cambiar a `SUPABASE_SERVICE_ROLE_KEY` dado que es una función de sistema interno.

---

### 🟡 INAPI retorna datos inventados como si fueran reales

El mock devuelve `risk_level: 'medium'` y marcas inventadas (`${brand_name} Tech`, `${brand_name} App`). Esto se muestra en el informe final de la validación. Un usuario podría tomar decisiones basadas en datos falsos.

**Acción recomendada:**
- Opción A: Marcar claramente en el informe que INAPI es "dato indicativo, no oficial"
- Opción B: Deshabilitar el bloque INAPI hasta tener la integración real
- Opción C: Integrar el OData real antes del siguiente release

---

### 🟡 CMF_API_KEY inconsistente entre funciones

`validate.ts` usa `'2a1b3c4d5e6f7g8h'` (placeholder) y `sync-economic-data/index.ts` usa la key real `e2010e01...`. Si en producción `validate.ts` está usando el placeholder, las llamadas live a CMF están fallando silenciosamente (hay try/catch que devuelve `null`).

**Verificar:** ¿La UF se está mostrando en los informes o aparece como `null`?

---

## 8. Deuda Técnica e Integraciones Incompletas

### Por criticidad para el producto

| Ítem | Criticidad | Esfuerzo | Descripción |
|---|---|---|---|
| INAPI — datos reales | Alta | Media | Reemplazar mock por OData de datos.inapi.cl |
| CMF — unificar fuente de UF | Alta | Baja | Un solo camino: cron diario → caché → todas las funciones leen desde caché |
| SII — caché por RUT | Media | Baja | Evitar llamadas repetidas para el mismo RUT en el mismo día |
| BCE — IMACEC sectoriales | Media | Alta | Validar IDs en catálogo BCCh, agregar series por sector |
| PJUD — clarificar proveedor | Media | Variable | ¿Quién nos empuja los webhooks? ¿Hay un intermediario contratado? |
| Fintoc — clarificar uso | Baja | Baja | Las funciones están desplegadas pero no hay documentación de cuándo se usan |
| SerpApi — Google Trends | Baja | Media | Integrar para análisis de demanda por keyword |
| Reddit API | Baja | Alta | Señales cualitativas de mercado — dato muy valioso pero difícil de parsear |

---

### Funciones sin cron (todas las que hacen sync)

La función `sync-economic-data` existe pero nunca se llama automáticamente. Opciones:
1. **Supabase Cron** (pg_cron) — llamada directa a la función via HTTP programada
2. **GitHub Actions** — job cron en el repo que hace `curl` a la función
3. **Vercel Cron Jobs** — si se agrega un endpoint en el frontend (no recomendado para datos sensibles)

**Recomendación:** Supabase pg_cron (nativo, sin dependencias externas).

---

## 9. Preguntas abiertas para el equipo

### Sobre datos gubernamentales

1. **SII — ¿caché por RUT?**  
   ¿Aceptamos que los datos del SII pueden tener hasta 7 días de antigüedad? ¿O la situación tributaria de una empresa debe ser siempre actual para el informe?

2. **INAPI — ¿cuándo integramos el OData real?**  
   El mock actual muestra datos inventados en los informes. ¿Es aceptable para el MVP actual o hay que marcarlo como "dato indicativo" de forma explícita ahora?

3. **PJUD — ¿tenemos un proveedor?**  
   La función `webhook-pjud` espera recibir datos de PJUD via push. ¿Hay un intermediario contratado que nos envía esos webhooks (ej. DataJudicial, LegalHub)? Si no, la función está desplegada pero nunca recibe datos.

4. **BCE — ¿qué series sectoriales queremos?**  
   El código tiene un placeholder `SECTOR_SERIES = {}` vacío. Para enriquecer el análisis de mercado, ¿cuáles sectores son prioritarios? (Fintech, Retail, SaaS B2B, Salud, etc.)

### Sobre arquitectura

5. **CMF — ¿consolidamos en un solo cron?**  
   Actualmente `validate.ts` llama a CMF en vivo y `sync-economic-data` también puede hacerlo. ¿Consolidamos en un cron diario y todas las funciones leen desde la tabla?

6. **Fintoc — ¿para qué se usa?**  
   Hay dos funciones (`fintoc-link`, `fintoc-webhook`) desplegadas. ¿Es para verificación bancaria del fundador? ¿Para un flujo de pago? ¿O es deuda técnica de una funcionalidad abandonada?

7. **Semantic cache threshold — ¿bajar de 0.92?**  
   El cache de Claude usa similitud 0.92 — muy restrictivo, probablemente muy pocos hits. ¿Bajamos a 0.88 para aumentar reutilización y bajar costos de Anthropic?

### Sobre seguridad

8. **API keys hardcodeadas — ¿cuándo las rotamos?**  
   `SII_API_KEY` y `CMF_API_KEY` están expuestas en el repo. ¿Tenemos visibilidad de si ya fueron usadas por alguien externo? ¿Hay logs de uso en apigateway.cl y CMF?

---

## Resumen ejecutivo

**Qué funciona bien hoy:**
- Pipeline principal de validación (SII + Claude + RAG)
- BCE e INE con caché funcional
- Telemetría PostHog completa
- GraphRAG (knowledge_nodes + knowledge_edges)
- Vault Obsidian con sync automático vía GitHub Actions

**Qué está pendiente y bloquea calidad del producto:**
- INAPI mockeado — datos falsos en informes reales
- CMF con dos rutas (live + caché sin unificar)
- Sin ningún cron activo — toda la caché depende de que alguien use el sistema primero

**Qué no es urgente pero hay que planificar:**
- Integración SerpApi y Reddit para señales de mercado
- IMACEC sectoriales en BCE
- Clarificación del rol de PJUD y Fintoc
