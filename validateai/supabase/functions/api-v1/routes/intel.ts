// ─────────────────────────────────────────────────────────────────────────────
// routes/intel.ts — Superficie de Inteligencia / GraphRAG
// ─────────────────────────────────────────────────────────────────────────────
//
// ESTADO (29-jul-2026): de toda esta superficie, lo único con implementación
// real es el proxy de `intelQueryHandler` hacia BralidusPY. El resto devolvía
// fixtures hardcodeados presentados como análisis genuino, y se convirtió a
// 501 explícito.
//
// Lo que había antes, para que no se repita:
//  - `intelQueryHandler` proxyaba a BRALIDUS_URL y, ante CUALQUIER fallo o si
//    la variable no estaba, caía a una narrativa inventada con dos citas
//    marcadas `verified: true` y `retrieved_at` recién generado. Ahora esa
//    rama responde 503: el proxy se conserva, la invención no.
//  - `intelCitationVerifyHandler` respondía siempre `status: 'verified'` con un
//    SHA-256 que era el hash del string vacío.
//  - `intelAssessmentCompanyRiskHandler` devolvía `insolvency_status: 'clean'`
//    y `risk_score: 12` para cualquier RUT.
//  - `intelReportsCreateHandler` marcaba los informes `completed` al instante,
//    con `download_urls` a rutas inexistentes; `intelJobStatusHandler` siempre
//    100%.
//
// El RAG que sí funciona de verdad es `POST /api/v1/rag/query` (ver
// `routes/rag.ts`: embeddings reales + pgvector + síntesis con citas).

import { stub, sourceUnavailable } from './_honest.ts'

const BRALIDUS_URL = Deno.env.get('BRALIDUS_URL') ?? ''
const BRALIDUS_API_KEY = Deno.env.get('BRALIDUS_API_KEY') ?? ''

const SIN_MOTOR =
  'Endpoint sin implementación real. La inteligencia de Animus se sirve por POST /api/v1/rag/query.'

const SIN_GRAFO =
  'Consultas sobre el grafo de entidades no disponibles: dependen del servicio S-Pulse, no integrado en este gateway.'

// ── 1. POST /api/v1/intel/query ─────────────────────────────────────────────
// Proxy real hacia BralidusPY. Si no está configurado o falla, se responde
// 503 — antes se devolvía un análisis inventado indistinguible de uno real.
export const intelQueryHandler = async (c: any) => {
  if (!BRALIDUS_URL) {
    return sourceUnavailable(
      c,
      'BRALIDUS_URL no configurada: el motor de inteligencia no está disponible desde este gateway.',
      'bralidus',
    )
  }

  let body: any = {}
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }

  try {
    const res = await fetch(`${BRALIDUS_URL.replace(/\/$/, '')}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BRALIDUS_API_KEY ? { Authorization: `Bearer ${BRALIDUS_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      return sourceUnavailable(
        c,
        `El motor de inteligencia respondió ${res.status}.`,
        'bralidus',
      )
    }

    const payload = await res.json()
    c.set('tokens_used', 35)
    return c.json(payload)
  } catch (err) {
    return sourceUnavailable(
      c,
      `No se pudo contactar al motor de inteligencia: ${String(err)}`,
      'bralidus',
    )
  }
}

// Alias histórico.
export const intelMoeQueryHandler = intelQueryHandler

// ── Catálogo y expertos ─────────────────────────────────────────────────────
export const intelExpertsListHandler = stub(SIN_MOTOR)
export const intelExpertQueryHandler = stub(SIN_MOTOR)

// ── Evaluaciones (devolvían scores fijos con apariencia de inferencia) ──────
export const intelAssessmentTenderFitHandler = stub(SIN_MOTOR)
export const intelAssessmentCompanyRiskHandler = stub(SIN_MOTOR)
export const intelAssessmentMacroImpactHandler = stub(SIN_MOTOR)
export const intelAssessmentWinProbabilityHandler = stub(SIN_MOTOR)
export const intelAssessmentBuyerProfileHandler = stub(SIN_MOTOR)
export const intelAssessmentLegalBasisHandler = stub(SIN_MOTOR)
export const intelAssessmentRegulatoryComplianceHandler = stub(SIN_MOTOR)

// ── Informes y jobs ─────────────────────────────────────────────────────────
export const intelReportsCreateHandler = stub(
  'Generación de informes no implementada: no hay pipeline de generación ni almacenamiento detrás.',
)
export const intelJobStatusHandler = stub(
  'Seguimiento de jobs no implementado: no existe cola de trabajos en este gateway.',
)
export const intelReportDetailHandler = stub(
  'Recuperación de informes no implementada: no hay informes persistidos.',
)

// ── Citas ───────────────────────────────────────────────────────────────────
export const intelCitationDetailHandler = stub(
  'Detalle de citas no implementado: no hay almacén de citas verificables.',
)
export const intelCitationVerifyHandler = stub(
  'Verificación de citas no implementada. La versión anterior respondía "verificado" sin comprobar nada.',
)

// ── Grafo ───────────────────────────────────────────────────────────────────
export const intelGraphEntitiesHandler = stub(SIN_GRAFO)
export const intelGraphNeighborsHandler = stub(SIN_GRAFO)
export const intelGraphPathsHandler = stub(SIN_GRAFO)

// ── Sesiones ────────────────────────────────────────────────────────────────
export const intelSessionsCreateHandler = stub(
  'Sesiones conversacionales no implementadas: no hay persistencia de contexto.',
)
export const intelSessionMessageHandler = stub(
  'Sesiones conversacionales no implementadas: no hay persistencia de contexto.',
)

// ── Estimación ──────────────────────────────────────────────────────────────
export const intelEstimateHandler = stub(
  'Estimación de costo no implementada para esta superficie.',
)
