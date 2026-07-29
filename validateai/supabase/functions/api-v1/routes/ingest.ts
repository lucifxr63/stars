// ─────────────────────────────────────────────────────────────────────────────
// routes/ingest.ts — Vault / gestión documental del RAG
// ─────────────────────────────────────────────────────────────────────────────
//
// ESTADO (29-jul-2026): sin implementación real. Todos los handlers responden
// 501.
//
// Este era el defecto más grave del gateway: **el archivo completo no tenía
// una sola escritura**. Ni `.from()`, ni `.insert()`, ni `.upsert()`, ni
// `.rpc()`, ni storage. `createClient`/`getSupabase` se importaban y nunca se
// usaban, y los helpers `getEmbeddings()` y `chunkText()` estaban definidos
// pero jamás se invocaban.
//
// En la práctica, `POST /api/v1/rag/ingest/text|file|vault` y
// `POST /api/v1/vault/ingest` **aceptaban documentos, respondían éxito con un
// id generado al vuelo, y los descartaban**. Pérdida de datos silenciosa: el
// cliente creía haber ingestado.
//
// El resto devolvía inventario falso (2 vaults, "42 documentos",
// "1420 chunks / 48.5 MB") y una URL de subida presignada apuntando a un host
// inexistente (`storage.bralidus.cl`).
//
// Consecuencia relacionada: `POST /api/v1/rag/query` (que SÍ es real) lee
// `tenant_vectors`, pero **nada en este gateway escribe esa tabla**. Ingesta y
// recuperación están desconectadas: hoy el vault por tenant solo puede
// poblarse por fuera de esta API.
//
// Cuando se implemente de verdad, reemplazar estos stubs por escrituras
// reales — no por otro literal.

import { stub } from './_honest.ts'

const SIN_PERSISTENCIA =
  'Ingesta documental no implementada: este gateway no persiste documentos. Los endpoints anteriores aceptaban el documento y lo descartaban.'

const SIN_INVENTARIO =
  'Inventario del vault no disponible: no hay almacén documental detrás de este gateway.'

// ── Vaults ──────────────────────────────────────────────────────────────────
export const ragVaultsCreateHandler = stub(SIN_PERSISTENCIA)
export const ragVaultsListHandler = stub(SIN_INVENTARIO)
export const ragVaultDetailHandler = stub(SIN_INVENTARIO)
export const ragVaultStatsHandler = stub(SIN_INVENTARIO)

// ── Colecciones ─────────────────────────────────────────────────────────────
export const ragCollectionsCreateHandler = stub(SIN_PERSISTENCIA)
export const ragCollectionsListHandler = stub(SIN_INVENTARIO)

// ── Documentos ──────────────────────────────────────────────────────────────
export const ragDocumentsTextHandler = stub(SIN_PERSISTENCIA)
export const ragDocumentsFileHandler = stub(SIN_PERSISTENCIA)
export const ragDocumentsListHandler = stub(SIN_INVENTARIO)
export const ragDocumentDetailHandler = stub(SIN_INVENTARIO)
export const ragDocumentDeleteHandler = stub(SIN_PERSISTENCIA)
export const ragDocumentChunksHandler = stub(SIN_INVENTARIO)
export const ragDocumentVersionsHandler = stub(SIN_INVENTARIO)

// ── Subidas y lotes ─────────────────────────────────────────────────────────
export const ragUploadsCreateHandler = stub(
  'Subida de archivos no implementada: la URL presignada que se devolvía apuntaba a un host inexistente.',
)
export const ragUploadsCompleteHandler = stub(SIN_PERSISTENCIA)
export const ragBatchesCreateHandler = stub(SIN_PERSISTENCIA)
export const ragBatchesDetailHandler = stub(SIN_INVENTARIO)

// ── Contexto y utilidades ───────────────────────────────────────────────────
export const ragContextPackHandler = stub(
  'Armado de context pack no implementado. Para recuperación real usar POST /api/v1/rag/query.',
)
export const ragEmbeddingProfilesHandler = stub(SIN_INVENTARIO)
export const ragEstimateHandler = stub(
  'Estimación de costo de ingesta no implementada: no hay pipeline de ingesta detrás.',
)

// ── Alias legacy (Validus) ──────────────────────────────────────────────────
// Apuntaban a los mismos mocks, así que compartían el mismo problema.
export const ingestTextHandler = ragDocumentsTextHandler
export const ingestFileHandler = ragDocumentsFileHandler
export const ingestVaultHandler = ragBatchesCreateHandler
