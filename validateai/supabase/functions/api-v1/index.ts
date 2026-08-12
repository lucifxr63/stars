import { Hono } from 'https://deno.land/x/hono@v3.12.11/mod.ts'
import { cors } from 'https://deno.land/x/hono@v3.12.11/middleware.ts'
import { authMiddleware } from './middleware/auth.ts'
import { usageMiddleware } from './middleware/usage.ts'
import { rateLimitMiddleware } from './middleware/ratelimit.ts'
import { ragQueryHandler } from './routes/rag.ts'
import { 
  economicDataHandler,
  macroDataHandler,
  chilecompraDataHandler, 
  chilecompraMetricasHandler, 
  licitusProveedorHandler, 
  licitusProveedorVsMercadoHandler, 
  licitusProveedorOportunidadesHandler, 
  licitusBenchmarksHandler, 
  licitusActivasHandler, 
  spulseSearchHandler, 
  spulseProfileHandler, 
  spulseNetworkHandler,
  mercadoPublicoHealthHandler,
  mercadoPublicoOpportunitiesHandler,
  mercadoPublicoFacetasHandler,
  mercadoPublicoOpportunityDetailHandler,
  mercadoPublicoLicitacionesHandler,
  mercadoPublicoLicitacionDetailHandler,
  mercadoPublicoCompraAgilHandler,
  mercadoPublicoOrdenesHandler,
  mercadoPublicoOrdenDetailHandler,
  mercadoPublicoOrganismosHandler,
  mercadoPublicoOfertasHandler,
  mercadoPublicoPreciosHandler,
  mercadoPublicoCompradorHandler,
  mercadoPublicoProveedorHandler,
  mercadoPublicoProveedorVsMercadoHandler,
  mercadoPublicoBenchmarksHandler,
  mercadoPublicoAnaliticaPreciosHandler,
  mercadoPublicoCompradorHistorialHandler,
  mercadoPublicoProveedorPerfilCompetitivoHandler,
  mercadoPublicoBusquedasGuardadasHandler,
  mercadoPublicoAlertasHandler,
  mercadoPublicoWebhooksHandler,
  mercadoPublicoExportacionesHandler,
  mercadoPublicoConveniosMarcoHandler,
  mercadoPublicoGrandesComprasHandler,
  mercadoPublicoConsultasMercadoHandler,
  mercadoPublicoTratosDirectosHandler,
  mercadoPublicoAiScoringHandler,
  mercadoPublicoAiPrediccionHandler,
  mercadoPublicoAiRecomendacionesHandler,
  economyChileSnapshotHandler,
  economyChileUfHandler,
  economyChileIpcHandler,
  economyChileTpmHandler,
  economyChileImacecHandler,
  economyChileExchangeRatesHandler,
  economySeriesHandler,
  commoditiesCopperHandler,
  companiesInsolvencyStatusHandler,
  insightsScenarioAnalysisHandler,
  economyIndicatorsHandler,
  economyReleasesHandler,
  economyCalendarHandler,
  economyChileGdpHandler,
  economyChileTradeBalanceHandler,
  economyChileIpomHandler,
  economyGlobalSnapshotHandler,
  commoditiesSnapshotHandler,
  marketsChileIpsaHandler,
  financialSystemEntitiesHandler,
  companiesInsolvenciesHandler,
  laborUnemploymentHandler,
  laborWagesHandler,
  investmentProjectsHandler,
  companyEventsConstitutionsHandler,
  companiesEconomicProfileHandler,
  companiesPublicProcurementMetricsHandler,
  analyticsCorrelationsHandler,
  insightsMacroBriefHandler,
  exportsHandler,
  companyProfileHandler,
  companyOwnershipMeshHandler,
  companyLegalRepsHandler,
  companyRelatedPartiesHandler,
  companyB2GConflictsHandler,
  companySearchHandler
} from './routes/data.ts'
import {
  pjudSupremaCausasHandler,
  pjudSupremaCausaHandler,
  pjudSupremaResumenHandler,
  pjudSupremaTendenciasHandler,
  pjudEstadisticasHandler,
} from './routes/pjud.ts'

import { 
  intelQueryHandler, 
  intelMoeQueryHandler,
  intelExpertsListHandler,
  intelExpertQueryHandler,
  intelAssessmentTenderFitHandler,
  intelAssessmentCompanyRiskHandler,
  intelAssessmentMacroImpactHandler,
  intelAssessmentWinProbabilityHandler,
  intelAssessmentBuyerProfileHandler,
  intelAssessmentLegalBasisHandler,
  intelAssessmentRegulatoryComplianceHandler,
  intelReportsCreateHandler,
  intelJobStatusHandler,
  intelReportDetailHandler,
  intelCitationDetailHandler,
  intelCitationVerifyHandler,
  intelGraphEntitiesHandler,
  intelGraphNeighborsHandler,
  intelGraphPathsHandler,
  intelSessionsCreateHandler,
  intelSessionMessageHandler,
  intelEstimateHandler
} from './routes/intel.ts'
import { 
  ragVaultsCreateHandler,
  ragVaultsListHandler,
  ragVaultDetailHandler,
  ragVaultStatsHandler,
  ragCollectionsCreateHandler,
  ragCollectionsListHandler,
  ragDocumentsTextHandler,
  ragDocumentsFileHandler,
  ragUploadsCreateHandler,
  ragUploadsCompleteHandler,
  ragBatchesCreateHandler,
  ragBatchesDetailHandler,
  ragDocumentsListHandler,
  ragDocumentDetailHandler,
  ragDocumentDeleteHandler,
  ragDocumentChunksHandler,
  ragDocumentVersionsHandler,
  ragContextPackHandler,
  ragEmbeddingProfilesHandler,
  ragEstimateHandler,
  ingestTextHandler,
  ingestFileHandler,
  ingestVaultHandler
} from './routes/ingest.ts'
import { createWebhookHandler, listWebhooksHandler, deleteWebhookHandler } from './routes/webhooks.ts'
import { validateHandler } from './routes/validate.ts'
import { servicesHealthHandler } from './routes/health.ts'

const app = new Hono()

// Robust Dynamic CORS middleware for all origins and headers
app.use('*', cors({
  origin: (origin) => origin || '*',
  allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type', 'x-validus-signature', 'x-bralidus-key', 'x-requested-with', 'accept'],
  allowMethods: ['POST', 'GET', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  // `x-ratelimit-remaining` a secas NO EXISTE: ratelimit.ts emite los cuatro de
  // abajo, con sufijo -credits. Exponer un nombre inventado dejaba los headers
  // de cuota ilegibles desde un navegador —CORS sólo entrega lo que se declara
  // acá— y por eso un integrador terminó ESTIMANDO su consumo en el cliente, con
  // un contador que se reiniciaba al reiniciar su servidor. El dato viajaba en
  // cada respuesta; lo que faltaba era permitirle leerlo.
  exposeHeaders: [
    'content-length',
    'x-ratelimit-limit-credits',
    'x-ratelimit-remaining-credits',
    'x-ratelimit-request-cost',
    'x-ratelimit-tier',
    // Si no se declara, el navegador lo oculta y el integrador no puede
    // reportarnos qué petición falló — que es justamente para lo que existe.
    'x-request-id',
  ],
  maxAge: 86400,
  credentials: true
}))

// Explicit 204 response for all OPTIONS preflight requests
app.options('*', (c) => c.text('', 204))

// ⚠️ ZONA PÚBLICA — todo lo registrado ACÁ ARRIBA queda SIN autenticar.
//
// Hono resuelve en orden de registro, así que estas rutas se atienden y
// responden antes de llegar al `app.use(...)` de auth de más abajo. No es una
// excepción declarada en ningún lado: es una consecuencia de dónde está escrita
// cada línea. Verificado: GET /api/v1/health/services responde 200 sin token y
// sin emitir un solo header x-ratelimit.
//
// Es deliberado para el panel de estado, porque la portada pública de
// animus.scouttech.lat lo muestra a visitantes sin sesión (App.tsx monta
// <Developers /> como ruta pública) y no expone datos: sólo si los servicios
// responden.
//
// Agregar acá una ruta que devuelva datos la publica al mundo sin cuota ni
// registro, y nada va a fallar para avisarlo. Las rutas nuevas van DEBAJO del
// bloque de middlewares.
app.get('/', (c) => c.json({ status: 'ok', service: 'RaaS API Gateway v1' }))
app.get('/health/services', servicesHealthHandler)
app.get('/api/v1/health/services', servicesHealthHandler)
app.get('/debug', (c) => c.json({ pathname: new URL(c.req.url).pathname }))

// ── FIN DE LA ZONA PÚBLICA ──────────────────────────────────────────────────
// Auth + rate limit + usage on all /api/v1/* routes (skip OPTIONS inside middlewares)
app.use('/api/v1/*', authMiddleware)
app.use('/api/v1/*', rateLimitMiddleware)
app.use('/api/v1/*', usageMiddleware)

// Endpoints
app.post('/api/v1/validate', validateHandler)
app.post('/api/v1/rag/query', ragQueryHandler)
app.get('/api/v1/data/economy', economicDataHandler)
app.get('/api/v1/data/macro', macroDataHandler)
app.get('/api/v1/data/chilecompra', chilecompraDataHandler)
app.get('/api/v1/data/chilecompra/metricas', chilecompraMetricasHandler)

// ── Poder Judicial — Corte Suprema ──────────────────────────────────────────
// 124.245 causas con grano individual (rol, libro, sala, tipo de recurso,
// fechas) mas 266 series agregadas, que hasta ahora no tenian NINGUNA forma de
// consultarse: era el unico lugar del sistema con dato valioso y cero API.
//
// El detalle va ANTES del listado en el archivo pero Hono resuelve por
// especificidad de patron, no por orden de registro, asi que no hay ambiguedad
// entre /causas y /causas/:libro/:rol/:ano_rol.
app.get('/api/v1/data/pjud/suprema/causas', pjudSupremaCausasHandler)
app.get('/api/v1/data/pjud/suprema/causas/:libro/:rol/:ano_rol', pjudSupremaCausaHandler)
app.get('/api/v1/data/pjud/suprema/resumen', pjudSupremaResumenHandler)
// Series por año con filtros: es lo que convierte el dato en analisis. Sin
// esto, obtener la evolucion de la tasa de confirmacion exigiria bajarse las
// 794.935 causas terminadas y agregarlas del lado del cliente.
app.get('/api/v1/data/pjud/suprema/tendencias', pjudSupremaTendenciasHandler)
app.get('/api/v1/data/pjud/estadisticas', pjudEstadisticasHandler)

// ── Mercado Público (API Canónica Bralidus v1) ──────────────────────────────────
app.get('/api/v1/mercado-publico/health', mercadoPublicoHealthHandler)
// 1. Buscador Unificado Oportunidades & Compra Ágil
app.get('/api/v1/mercado-publico/opportunities', mercadoPublicoOpportunitiesHandler)
// Conteos agregados sobre el mismo universo filtrado que /opportunities.
app.get('/api/v1/mercado-publico/facetas', mercadoPublicoFacetasHandler)
app.get('/api/v1/mercado-publico/opportunities/:id', mercadoPublicoOpportunityDetailHandler)
app.get('/api/v1/mercado-publico/licitaciones', mercadoPublicoLicitacionesHandler)
app.get('/api/v1/mercado-publico/licitaciones/:codigo_externo', mercadoPublicoLicitacionDetailHandler)
app.get('/api/v1/mercado-publico/compra-agil', mercadoPublicoCompraAgilHandler)
// 2. Órdenes de Compra
app.get('/api/v1/mercado-publico/ordenes-compra', mercadoPublicoOrdenesHandler)
app.get('/api/v1/mercado-publico/ordenes-compra/:codigo_oc', mercadoPublicoOrdenDetailHandler)
// 3. Organismos y Proveedores
app.get('/api/v1/mercado-publico/organismos', mercadoPublicoOrganismosHandler)
// Competencia real de las compras agiles: quien cotizo, cuanto y quien gano.
app.get('/api/v1/mercado-publico/ofertas', mercadoPublicoOfertasHandler)
// Precios de referencia por producto, con su propia senal de fiabilidad.
app.get('/api/v1/mercado-publico/precios', mercadoPublicoPreciosHandler)
app.get('/api/v1/mercado-publico/organismos/:id', mercadoPublicoCompradorHandler)
app.get('/api/v1/mercado-publico/proveedores/:rut', mercadoPublicoProveedorHandler)
app.get('/api/v1/mercado-publico/proveedores/:rut/vs-mercado', mercadoPublicoProveedorVsMercadoHandler)
app.get('/api/v1/mercado-publico/proveedores/:rut/oportunidades', licitusProveedorOportunidadesHandler)
app.get('/api/v1/mercado-publico/benchmarks', mercadoPublicoBenchmarksHandler)
app.get('/api/v1/mercado-publico/metricas/:rut', chilecompraMetricasHandler)

// 4. 🚀 Fase 2 Comercial (Analítica, Perfiles 360°, Webhooks, Alertas y Exportaciones)
app.get('/api/v1/mercado-publico/analitica/precios', mercadoPublicoAnaliticaPreciosHandler)
app.get('/api/v1/mercado-publico/compradores/:rut/historial', mercadoPublicoCompradorHistorialHandler)
app.get('/api/v1/mercado-publico/proveedores/:rut/perfil-competitivo', mercadoPublicoProveedorPerfilCompetitivoHandler)
app.post('/api/v1/mercado-publico/busquedas/guardadas', mercadoPublicoBusquedasGuardadasHandler)
app.post('/api/v1/mercado-publico/alertas', mercadoPublicoAlertasHandler)
app.post('/api/v1/mercado-publico/webhooks', mercadoPublicoWebhooksHandler)
app.post('/api/v1/mercado-publico/exportaciones', mercadoPublicoExportacionesHandler)

// 5. 🧠 Fase 3 IA Predictiva & Modalidades Especiales
app.get('/api/v1/mercado-publico/convenio-marco', mercadoPublicoConveniosMarcoHandler)
app.get('/api/v1/mercado-publico/grandes-compras', mercadoPublicoGrandesComprasHandler)
app.get('/api/v1/mercado-publico/consultas-mercado', mercadoPublicoConsultasMercadoHandler)
app.get('/api/v1/mercado-publico/tratos-directos', mercadoPublicoTratosDirectosHandler)
app.post('/api/v1/mercado-publico/ai/scoring-oportunidad', mercadoPublicoAiScoringHandler)
app.post('/api/v1/mercado-publico/ai/prediccion-adjudicacion', mercadoPublicoAiPrediccionHandler)
app.get('/api/v1/mercado-publico/ai/recomendaciones/:rut', mercadoPublicoAiRecomendacionesHandler)

// 6. 📈 Dominios de Datos Económicos & Macroeconómicos (Estructura Canónica v2.0)
app.get('/api/v1/data/economy/chile/snapshot', economyChileSnapshotHandler)
app.get('/api/v1/data/economy/chile/uf', economyChileUfHandler)
app.get('/api/v1/data/economy/chile/ipc', economyChileIpcHandler)
app.get('/api/v1/data/economy/chile/tpm', economyChileTpmHandler)
app.get('/api/v1/data/economy/chile/imacec', economyChileImacecHandler)
app.get('/api/v1/data/economy/chile/gdp', economyChileGdpHandler)
app.get('/api/v1/data/economy/chile/exchange-rates', economyChileExchangeRatesHandler)
app.get('/api/v1/data/economy/chile/trade-balance', economyChileTradeBalanceHandler)
app.get('/api/v1/data/economy/chile/ipom', economyChileIpomHandler)

app.get('/api/v1/data/economy/indicators', economyIndicatorsHandler)
app.get('/api/v1/data/economy/releases', economyReleasesHandler)
app.get('/api/v1/data/economy/calendar', economyCalendarHandler)
app.get('/api/v1/data/economy/series/:series_id', economySeriesHandler)

app.get('/api/v1/data/economy/global/snapshot', economyGlobalSnapshotHandler)
app.get('/api/v1/data/commodities', commoditiesSnapshotHandler)
app.get('/api/v1/data/commodities/snapshot', commoditiesSnapshotHandler)
app.get('/api/v1/data/commodities/copper', commoditiesCopperHandler)

app.get('/api/v1/data/markets', marketsChileIpsaHandler)
app.get('/api/v1/data/markets/chile/ipsa', marketsChileIpsaHandler)

app.get('/api/v1/data/financial-system/entities', financialSystemEntitiesHandler)
app.get('/api/v1/data/companies/insolvencies', companiesInsolvenciesHandler)
app.get('/api/v1/data/companies/:rut/insolvency-status', companiesInsolvencyStatusHandler)
app.get('/api/v1/data/companies/:rut/economic-profile', companiesEconomicProfileHandler)
app.get('/api/v1/data/companies/:rut/public-procurement/metrics', companiesPublicProcurementMetricsHandler)

app.get('/api/v1/data/labor', laborUnemploymentHandler)
app.get('/api/v1/data/labor/unemployment', laborUnemploymentHandler)
app.get('/api/v1/data/labor/wages', laborWagesHandler)

app.get('/api/v1/data/investment-projects', investmentProjectsHandler)
app.get('/api/v1/data/company-events/constitutions', companyEventsConstitutionsHandler)

app.get('/api/v1/data/analytics/correlations', analyticsCorrelationsHandler)
app.post('/api/v1/data/insights/macro-brief', insightsMacroBriefHandler)
app.post('/api/v1/data/insights/scenario-analysis', insightsScenarioAnalysisHandler)
app.post('/api/v1/data/exports', exportsHandler)

// 7. 🧠 Bralidus Intelligence & GraphRAG (Sección 3 Completa v2.0)
app.post('/api/v1/intel/query', intelQueryHandler)
app.post('/api/v1/intel/query/moe', intelMoeQueryHandler)
app.get('/api/v1/intel/experts', intelExpertsListHandler)
app.get('/api/v1/intel/experts/:expert_id', intelExpertsListHandler)
app.post('/api/v1/intel/experts/:expert_id/query', intelExpertQueryHandler)

app.post('/api/v1/intel/assessments/tender-fit', intelAssessmentTenderFitHandler)
app.post('/api/v1/intel/assessments/company-risk', intelAssessmentCompanyRiskHandler)
app.post('/api/v1/intel/assessments/macro-impact', intelAssessmentMacroImpactHandler)
app.post('/api/v1/intel/assessments/win-probability', intelAssessmentWinProbabilityHandler)
app.post('/api/v1/intel/assessments/buyer-profile', intelAssessmentBuyerProfileHandler)
app.post('/api/v1/intel/assessments/legal-basis', intelAssessmentLegalBasisHandler)
app.post('/api/v1/intel/assessments/regulatory-compliance', intelAssessmentRegulatoryComplianceHandler)

app.post('/api/v1/intel/reports', intelReportsCreateHandler)
app.get('/api/v1/intel/jobs/:job_id', intelJobStatusHandler)
app.get('/api/v1/intel/reports/:report_id', intelReportDetailHandler)

app.get('/api/v1/intel/citations/:citation_id', intelCitationDetailHandler)
app.post('/api/v1/intel/citations/:citation_id/verify', intelCitationVerifyHandler)

app.get('/api/v1/intel/graph/entities', intelGraphEntitiesHandler)
app.get('/api/v1/intel/graph/entities/:entity_id/neighbors', intelGraphNeighborsHandler)
app.post('/api/v1/intel/graph/paths', intelGraphPathsHandler)

app.post('/api/v1/intel/sessions', intelSessionsCreateHandler)
app.post('/api/v1/intel/sessions/:session_id/messages', intelSessionMessageHandler)

app.post('/api/v1/intel/estimate', intelEstimateHandler)

// Rutas alias B2G
app.get('/api/v1/data/b2g/licitaciones/activas', licitusActivasHandler)
app.get('/api/v1/data/b2g/benchmarks', licitusBenchmarksHandler)
app.get('/api/v1/data/b2g/proveedor/:rut', licitusProveedorHandler)
app.get('/api/v1/data/b2g/proveedor/:rut/vs-mercado', licitusProveedorVsMercadoHandler)

// Rutas legacy Licitus
app.get('/api/v1/data/licitus/proveedor/:rut', licitusProveedorHandler)
app.get('/api/v1/data/licitus/proveedor/:rut/vs-mercado', licitusProveedorVsMercadoHandler)
app.get('/api/v1/data/licitus/proveedor/:rut/oportunidades', licitusProveedorOportunidadesHandler)
app.get('/api/v1/data/licitus/mercado/benchmarks', licitusBenchmarksHandler)
app.get('/api/v1/data/licitus/mercado/activas', licitusActivasHandler)

// S-Pulse v2.0 (Inteligencia Societaria & Mallas Empresariales)
app.get('/api/v1/data/companies/search', companySearchHandler)
app.get('/api/v1/data/companies/:rut/profile', companyProfileHandler)
app.get('/api/v1/data/companies/:rut/ownership-mesh', companyOwnershipMeshHandler)
app.get('/api/v1/data/companies/:rut/legal-representatives', companyLegalRepsHandler)
app.get('/api/v1/data/companies/:rut/related-parties', companyRelatedPartiesHandler)
app.post('/api/v1/data/companies/:rut/b2g-conflicts', companyB2GConflictsHandler)

// S-Pulse (grafo societario — interno legacy)
app.get('/api/v1/data/spulse/companies/search', spulseSearchHandler)
app.get('/api/v1/data/spulse/companies/:rut/profile', spulseProfileHandler)
app.get('/api/v1/data/spulse/companies/:rut/network', spulseNetworkHandler)

// 8. 📦 Bralidus Vault & RAG Vectorial (Sección 4 v2.0)
app.post('/api/v1/rag/vaults', ragVaultsCreateHandler)
app.get('/api/v1/rag/vaults', ragVaultsListHandler)
app.get('/api/v1/rag/vaults/:vault_id', ragVaultDetailHandler)
app.get('/api/v1/rag/vaults/:vault_id/stats', ragVaultStatsHandler)
app.post('/api/v1/rag/vaults/:vault_id/collections', ragCollectionsCreateHandler)
app.get('/api/v1/rag/vaults/:vault_id/collections', ragCollectionsListHandler)

app.post('/api/v1/rag/documents/text', ragDocumentsTextHandler)
app.post('/api/v1/rag/documents/file', ragDocumentsFileHandler)
app.post('/api/v1/rag/uploads', ragUploadsCreateHandler)
app.post('/api/v1/rag/uploads/:upload_id/complete', ragUploadsCompleteHandler)
app.post('/api/v1/rag/batches', ragBatchesCreateHandler)
app.get('/api/v1/rag/batches/:batch_id', ragBatchesDetailHandler)

app.get('/api/v1/rag/documents', ragDocumentsListHandler)
app.get('/api/v1/rag/documents/:document_id', ragDocumentDetailHandler)
app.delete('/api/v1/rag/documents/:document_id', ragDocumentDeleteHandler)
app.get('/api/v1/rag/documents/:document_id/chunks', ragDocumentChunksHandler)
app.get('/api/v1/rag/documents/:document_id/versions', ragDocumentVersionsHandler)

// /api/v1/rag/query ya se registra mas arriba (con el handler de rag.ts);
// repetirlo aca era codigo muerto porque Hono resuelve con la primera coincidencia.
app.post('/api/v1/rag/context', ragContextPackHandler)
app.get('/api/v1/rag/embedding-profiles', ragEmbeddingProfilesHandler)
app.post('/api/v1/rag/estimate', ragEstimateHandler)

// Rutas alias Validus (Backward Compatibility)
app.post('/api/v1/rag/ingest/text', ingestTextHandler)
app.post('/api/v1/rag/ingest/file', ingestFileHandler)
app.post('/api/v1/rag/ingest/vault', ingestVaultHandler)
app.get('/api/v1/rag/vault/documents', ragDocumentsListHandler)
app.get('/api/v1/rag/vault/stats', ragVaultStatsHandler)
app.delete('/api/v1/rag/vault/documents/:id', ragDocumentDeleteHandler)
app.post('/vault/ingest', ingestVaultHandler)

app.post('/api/v1/webhooks', createWebhookHandler)
app.get('/api/v1/webhooks', listWebhooksHandler)
app.delete('/api/v1/webhooks/:id', deleteWebhookHandler)

app.notFound((c) => c.json({ error: 'Endpoint not found', path: new URL(c.req.url).pathname }, 404))
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '*'
  const reqHeaders = req.headers.get('access-control-request-headers') || 'authorization, x-client-info, apikey, content-type, x-validus-signature, x-animus-key, x-bralidus-key'

  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': reqHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Vary': 'Origin',
  }

  // Preflight OPTIONS handler: Return HTTP 200 OK immediately with CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  // Supabase strips /functions/v1 but keeps function segment: /api-v1/...
  const url = new URL(req.url)
  let pathname = url.pathname.replace(/^\/[^/]+/, '') || '/'
  
  // Ensure path starts with /api/v1 for internal Hono router
  if (!pathname.startsWith('/api/v1') && pathname !== '/' && !pathname.startsWith('/health')) {
    pathname = '/api/v1' + (pathname.startsWith('/') ? pathname : '/' + pathname)
  }

  const rewritten = new Request(new URL(pathname + url.search, url.origin), req)
  const res = await app.fetch(rewritten)

  // Attach CORS headers to response (ensures 404/500/200 all pass browser CORS check)
  const responseHeaders = new Headers(res.headers)
  Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v))

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders
  })
})
