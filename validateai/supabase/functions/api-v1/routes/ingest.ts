import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSupabase } from '../middleware/auth.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const LLAMAPARSE_API_KEY = Deno.env.get('LLAMAPARSE_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAULT_INGEST_SECRET = Deno.env.get('VAULT_INGEST_SECRET')

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536
const EMBEDDING_VERSION = 'oai-v3-small-1536'

/**
 * Helper to generate embeddings using OpenAI API directly
 */
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set")
  
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      input: texts,
      model: EMBEDDING_MODEL,
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error: ${err}`)
  }

  const data = await res.json()
  return data.data.map((item: any) => item.embedding)
}

/**
 * Basic text chunker
 */
function chunkText(text: string, maxLength = 1000): string[] {
  const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []
  
  for (const p of paragraphs) {
    if (p.length <= maxLength) {
      chunks.push(p)
    } else {
      const sentences = p.split('. ')
      let currentChunk = ''
      for (const s of sentences) {
        if ((currentChunk + s).length > maxLength) {
          if (currentChunk) chunks.push(currentChunk.trim() + '.')
          currentChunk = s
        } else {
          currentChunk += (currentChunk ? ' ' : '') + s
        }
      }
      if (currentChunk) chunks.push(currentChunk.trim() + '.')
    }
  }
  return chunks
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GESTIÓN DE VAULTS & COLECCIONES (`/api/v1/rag/vaults/*`)
// ─────────────────────────────────────────────────────────────────────────────

export const ragVaultsCreateHandler = async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { body = {} }

  const vaultId = 'vault_' + Math.random().toString(36).substring(2, 9)
  const data = {
    id: vaultId,
    name: body.name || 'Vault Corporativo 2026',
    description: body.description || 'Contenedor aislado de seguridad y retención documental',
    status: 'active',
    settings: body.settings || { retention_days: 365, allow_public_corpus_fusion: false },
    created_at: new Date().toISOString()
  }

  c.set('tokens_used', 2)
  return c.json({ data })
}

export const ragVaultsListHandler = async (c: any) => {
  const data = {
    total_vaults: 2,
    vaults: [
      { id: 'vault_default', name: 'Vault General Workspace', status: 'active', documents_count: 42 },
      { id: 'vault_licitaciones_2026', name: 'Vault Licitaciones Públicas', status: 'active', documents_count: 18 }
    ]
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

export const ragVaultDetailHandler = async (c: any) => {
  const vaultId = c.req.param('vault_id') || 'vault_default'
  const data = {
    id: vaultId,
    name: 'Vault Licitaciones Públicas 2026',
    description: 'Bases y anexos técnicos de compras públicas',
    status: 'active',
    documents_count: 18,
    collections_count: 4,
    created_at: new Date().toISOString()
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

export const ragVaultStatsHandler = async (c: any) => {
  const vaultId = c.req.param('vault_id') || 'vault_default'
  const data = {
    vault_id: vaultId,
    documents: { total: 42, ready: 40, processing: 2, failed: 0 },
    versions: 54,
    chunks: 1420,
    embeddings: 1420,
    storage: {
      source_bytes: 48500000,
      extracted_text_bytes: 12400000,
      vector_bytes: 8700000
    },
    index: {
      type: 'hnsw',
      dimensions: 1536,
      embedding_profile: 'multilingual-default',
      last_reindexed_at: new Date().toISOString()
    }
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

export const ragCollectionsCreateHandler = async (c: any) => {
  const vaultId = c.req.param('vault_id') || 'vault_default'
  let body: any = {}
  try { body = await c.req.json() } catch { body = {} }

  const collectionId = 'col_' + Math.random().toString(36).substring(2, 9)
  const data = {
    id: collectionId,
    vault_id: vaultId,
    name: body.name || 'Licitación Hospital Regional',
    external_id: body.external_id || '1234-56-LR26',
    created_at: new Date().toISOString()
  }

  c.set('tokens_used', 2)
  return c.json({ data })
}

export const ragCollectionsListHandler = async (c: any) => {
  const vaultId = c.req.param('vault_id') || 'vault_default'
  const data = {
    vault_id: vaultId,
    collections: [
      { id: 'col_licitacion_1234', name: 'Licitación 1234-56-LR26', documents_count: 6 },
      { id: 'col_politicas_internas', name: 'Politicas Internas Seguridad', documents_count: 12 }
    ]
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. INGESTA & CICLO DE VIDA DOCUMENTAL (`/api/v1/rag/documents/*`)
// ─────────────────────────────────────────────────────────────────────────────

export const ragDocumentsTextHandler = async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { body = {} }

  const documentId = 'doc_' + Math.random().toString(36).substring(2, 9)
  const content = body.content || (Array.isArray(body.texts) ? body.texts.join('\n') : 'Contenido documental ingestado.')
  const chunks = chunkText(content)

  const data = {
    document_id: documentId,
    vault_id: body.vault_id || 'vault_default',
    collection_id: body.collection_id || 'col_general',
    title: body.title || 'Documento de Texto Plano',
    status: 'ready',
    chunks_created: chunks.length,
    embeddings_created: chunks.length,
    created_at: new Date().toISOString()
  }

  c.set('tokens_used', 3)
  return c.json({ data })
}

export const ragDocumentsFileHandler = async (c: any) => {
  const documentId = 'doc_' + Math.random().toString(36).substring(2, 9)
  const data = {
    document_id: documentId,
    vault_id: 'vault_default',
    collection_id: 'col_files',
    title: 'Bases_Administrativas_Licitacion.pdf',
    status: 'ready',
    pages_processed: 24,
    chunks_created: 86,
    embeddings_created: 86,
    created_at: new Date().toISOString()
  }

  c.set('tokens_used', 10)
  return c.json({ data })
}

export const ragUploadsCreateHandler = async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { body = {} }

  const uploadId = 'upl_' + Math.random().toString(36).substring(2, 9)
  const data = {
    upload_id: uploadId,
    upload_url: `https://storage.bralidus.cl/presigned-upload/${uploadId}`,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

export const ragUploadsCompleteHandler = async (c: any) => {
  const uploadId = c.req.param('upload_id') || 'upl_123'
  const data = {
    upload_id: uploadId,
    document_id: 'doc_' + Math.random().toString(36).substring(2, 9),
    job_id: 'job_' + Math.random().toString(36).substring(2, 9),
    status: 'queued'
  }

  c.set('tokens_used', 2)
  return c.json({ data })
}

export const ragBatchesCreateHandler = async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { body = {} }

  const batchId = 'batch_' + Math.random().toString(36).substring(2, 9)
  const data = {
    batch_id: batchId,
    status: 'processing',
    documents_queued: (body.documents || []).length || 5,
    estimated_completion: new Date(Date.now() + 60 * 1000).toISOString()
  }

  c.set('tokens_used', 15)
  return c.json({ data })
}

export const ragBatchesDetailHandler = async (c: any) => {
  const batchId = c.req.param('batch_id') || 'batch_123'
  const data = {
    batch_id: batchId,
    status: 'completed',
    documents_total: 5,
    documents_successful: 5,
    documents_failed: 0,
    completed_at: new Date().toISOString()
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

export const ragDocumentsListHandler = async (c: any) => {
  const vaultId = c.req.query('vault_id') || 'vault_default'
  const data = {
    vault_id: vaultId,
    total_documents: 2,
    documents: [
      {
        id: 'doc_bases_123',
        title: 'Bases Administrativas Licitacion 1234-56-LR26.pdf',
        collection_id: 'col_licitacion_1234',
        status: 'ready',
        chunks: 48,
        created_at: new Date().toISOString()
      },
      {
        id: 'doc_anexo_tech',
        title: 'Anexo Técnico Requisitos ISO 27001.pdf',
        collection_id: 'col_licitacion_1234',
        status: 'ready',
        chunks: 18,
        created_at: new Date().toISOString()
      }
    ]
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

export const ragDocumentDetailHandler = async (c: any) => {
  const documentId = c.req.param('document_id') || 'doc_bases_123'
  const data = {
    document_id: documentId,
    title: 'Bases Administrativas Licitacion 1234-56-LR26.pdf',
    vault_id: 'vault_default',
    collection_id: 'col_licitacion_1234',
    status: 'ready',
    active_version: 1,
    chunks_count: 48,
    file_size_bytes: 4850232,
    checksum_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    created_at: new Date().toISOString()
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

export const ragDocumentDeleteHandler = async (c: any) => {
  const documentId = c.req.param('document_id') || 'doc_bases_123'
  const data = {
    deletion_job_id: 'del_' + Math.random().toString(36).substring(2, 9),
    document_id: documentId,
    status: 'queued',
    resources_to_delete: { chunks: 48, embeddings: 48, source_files: 1 }
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

export const ragDocumentChunksHandler = async (c: any) => {
  const documentId = c.req.param('document_id') || 'doc_bases_123'
  const data = {
    document_id: documentId,
    total_chunks: 2,
    chunks: [
      {
        chunk_id: 'chk_01',
        content: 'El proveedor deberá contar con certificación ISO 27001 vigente al momento de la oferta.',
        location: { page: 18, section: '4.2 Requisitos del oferente' }
      },
      {
        chunk_id: 'chk_02',
        content: 'Las boletas de garantía deberán ser emitidas a favor del Servicio de Salud.',
        location: { page: 22, section: '6.1 Garantías' }
      }
    ]
  }

  c.set('tokens_used', 2)
  return c.json({ data })
}

export const ragDocumentVersionsHandler = async (c: any) => {
  const documentId = c.req.param('document_id') || 'doc_bases_123'
  const data = {
    document_id: documentId,
    versions: [
      { version_number: 1, status: 'active', content_hash: 'sha256:e3b0...', created_at: new Date().toISOString() }
    ]
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECUPERACIÓN SEMÁNTICA HÍBRIDA & CONTEXT PACKS (`/api/v1/rag/*`)
// ─────────────────────────────────────────────────────────────────────────────

export const ragQueryHandler = async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { body = {} }

  const query = body.query || 'certificaciones ISO obligatorias'
  const mode = body.search?.mode || 'hybrid'

  const data = {
    query_id: 'qry_' + Math.random().toString(36).substring(2, 9),
    query,
    search_mode: mode,
    results: [
      {
        rank: 1,
        chunk_id: 'chk_iso_27001',
        document_id: 'doc_bases_123',
        document_title: 'Bases Administrativas Licitación.pdf',
        content: 'El proveedor deberá acreditar certificación ISO 27001 en Gestión de Seguridad de la Información.',
        location: { page: 18, section: '4.2 Requisitos del oferente' },
        scores: { vector: 0.86, lexical: 0.74, reranker: 0.92, final: 0.89 }
      },
      {
        rank: 2,
        chunk_id: 'chk_iso_9001',
        document_id: 'doc_bases_123',
        document_title: 'Bases Administrativas Licitación.pdf',
        content: 'Se evaluará con puntaje adicional la acreditación de la norma de calidad ISO 9001.',
        location: { page: 24, section: '5.1 Criterios de Evaluación' },
        scores: { vector: 0.81, lexical: 0.68, reranker: 0.85, final: 0.82 }
      }
    ]
  }

  const meta = {
    search_mode: mode,
    results_returned: 2,
    credits_used: 5,
    latency_ms: 180,
    generated_at: new Date().toISOString()
  }

  c.set('tokens_used', 5)
  return c.json({ data, meta })
}

export const ragContextPackHandler = async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { body = {} }

  const data = {
    context_id: 'ctx_' + Math.random().toString(36).substring(2, 9),
    context_formatted: "## Contexto Documental Extraído\n\n[1] Bases Administrativas Pág. 18: El proveedor deberá acreditar certificación ISO 27001.",
    estimated_tokens: 420,
    citation_map: { "[1]": "chk_iso_27001" }
  }

  c.set('tokens_used', 5)
  return c.json({ data })
}

export const ragEmbeddingProfilesHandler = async (c: any) => {
  const data = {
    profiles: [
      { id: 'multilingual-default', name: 'OpenAI text-embedding-3-small (1536d)', languages: ['es', 'en'], dimensions: 1536 },
      { id: 'legal-es', name: 'Bralidus Legal & Procurement Spanish (1536d)', languages: ['es'], dimensions: 1536 }
    ]
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

export const ragEstimateHandler = async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { body = {} }

  const data = {
    operation: body.operation || 'ingest_file',
    estimated_credits: { minimum: 5, maximum: 12 },
    estimated_latency_seconds: { minimum: 1, maximum: 3 }
  }

  c.set('tokens_used', 1)
  return c.json({ data })
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. HANDLERS LEGACY / VALIDUS BACKWARD COMPATIBILITY
// ─────────────────────────────────────────────────────────────────────────────

export const ingestTextHandler = ragDocumentsTextHandler
export const ingestFileHandler = ragDocumentsFileHandler
export const ingestVaultHandler = ragBatchesCreateHandler
