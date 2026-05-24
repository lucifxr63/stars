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
      // 1536 is the native dimension of text-embedding-3-small — no truncation needed
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error: ${err}`)
  }

  const data = await res.json()
  // data.data is an array of objects with .embedding
  return data.data.map((item: any) => item.embedding)
}

/**
 * Basic text chunker. Splits by double newline, then by length.
 */
function chunkText(text: string, maxLength = 1000): string[] {
  const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []
  
  for (const p of paragraphs) {
    if (p.length <= maxLength) {
      chunks.push(p)
    } else {
      // Very naive splitting for oversized paragraphs
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

/**
 * Endpoint: POST /rag/ingest/text
 */
export const ingestTextHandler = async (c: any) => {
  try {
    const { texts, metadata = {} } = await c.req.json()

    if (!Array.isArray(texts) || texts.length === 0) {
      return c.json({ error: 'Expected "texts" array in body' }, 400)
    }

    const profileId = c.get('profile_id')
    const apiKeyId = c.get('api_key_id')
    
    // Chunking text if it's too long
    const allChunks = texts.flatMap(t => chunkText(t))
    if (allChunks.length === 0) {
      return c.json({ error: 'No valid text to process' }, 400)
    }

    // Get embeddings
    const embeddings = await getEmbeddings(allChunks)

    // Prepare for DB
    const rows = allChunks.map((chunk, i) => ({
      profile_id: profileId,
      api_key_id: apiKeyId,
      content: chunk,
      metadata: metadata,
      embedding_version: EMBEDDING_VERSION,
      embedding: embeddings[i]
    }))

    const supabase = getSupabase()
    const { error } = await supabase.from('tenant_vectors').insert(rows)

    if (error) {
      console.error('DB Insert Error:', error)
      throw new Error('Failed to save vectors to database')
    }

    c.set('tokens_used', allChunks.length * 150) // Rough estimation for billing

    return c.json({ 
      success: true, 
      chunks_inserted: allChunks.length,
      embedding_version: EMBEDDING_VERSION,
      dimensions: EMBEDDING_DIMENSIONS
    })

  } catch (err: any) {
    console.error('ingestTextHandler error:', err)
    return c.json({ error: 'Failed to process text ingestion', details: err.message }, 500)
  }
}

/**
 * Endpoint: POST /rag/ingest/file
 * Orchestrates file parsing via LlamaParse and vectorizes the output.
 */
export const ingestFileHandler = async (c: any) => {
  try {
    if (!LLAMAPARSE_API_KEY) {
      return c.json({ error: 'LlamaParse API key is not configured' }, 503)
    }

    const formData = await c.req.parseBody()
    const file = formData.file as File
    
    if (!file) {
      return c.json({ error: 'No file uploaded. Use "file" field in form-data.' }, 400)
    }

    // Simple rate limiting / constraints for MVP: Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'File size exceeds 10MB limit for the basic tier.' }, 413)
    }

    const profileId = c.get('profile_id')
    const apiKeyId = c.get('api_key_id')

    // 1. Upload to LlamaParse
    const uploadForm = new FormData()
    uploadForm.append('file', file)

    const uploadRes = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
      },
      body: uploadForm
    })

    if (!uploadRes.ok) {
      throw new Error(`LlamaParse Upload failed: ${await uploadRes.text()}`)
    }

    const uploadData = await uploadRes.json()
    const jobId = uploadData.id

    // 2. Poll for completion (Max 15 seconds to avoid Edge Function timeout)
    let isReady = false
    let attempts = 0
    while (!isReady && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++
      
      const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: { 'Authorization': `Bearer ${LLAMAPARSE_API_KEY}` }
      })
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        if (statusData.status === 'SUCCESS') {
          isReady = true
        } else if (statusData.status === 'ERROR' || statusData.status === 'FAILED') {
          throw new Error('LlamaParse job failed to process document.')
        }
      }
    }

    if (!isReady) {
      return c.json({ 
        error: 'Parser_Timeout', 
        message: 'El documento es demasiado complejo o el servicio de extracción está saturado. Intenta con un documento más corto.' 
      }, 504)
    }

    // 3. Fetch Markdown result
    const resultRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
      headers: { 'Authorization': `Bearer ${LLAMAPARSE_API_KEY}` }
    })
    
    if (!resultRes.ok) {
      throw new Error('Failed to retrieve parsing results')
    }

    const resultData = await resultRes.json()
    const markdownText = resultData.markdown || ''

    if (!markdownText.trim()) {
      return c.json({ error: 'Could not extract any text from the document.' }, 422)
    }

    // 4. Chunk and Vectorize
    const allChunks = chunkText(markdownText, 1500) // Slightly larger chunks for documents
    
    // If it generated too many chunks, we might hit OpenAI limits or timeout.
    // For MVP, limit to 50 chunks (approx 15-20 pages) to avoid timeout.
    if (allChunks.length > 50) {
      return c.json({ 
        error: 'Document_Too_Large', 
        message: 'El documento extraído excede el límite de 50 fragmentos para el tier básico.' 
      }, 413)
    }

    const embeddings = await getEmbeddings(allChunks)

    const metadata = { filename: file.name, source: 'llamaparse' }
    const rows = allChunks.map((chunk, i) => ({
      profile_id: profileId,
      api_key_id: apiKeyId,
      content: chunk,
      metadata: metadata,
      embedding_version: EMBEDDING_VERSION,
      embedding: embeddings[i]
    }))

    const supabase = getSupabase()
    const { error } = await supabase.from('tenant_vectors').insert(rows)

    if (error) {
      console.error('DB Insert Error (File):', error)
      throw new Error('Failed to save file vectors to database')
    }

    c.set('tokens_used', allChunks.length * 200) // Estimation

    return c.json({ 
      success: true, 
      chunks_inserted: allChunks.length,
      filename: file.name,
      embedding_version: EMBEDDING_VERSION
    })

  } catch (err: any) {
    console.error('ingestFileHandler error:', err)
    // Map specific errors to status codes
    const status = err.message.includes('Timeout') ? 504 : 503
    return c.json({ error: 'Failed to process file ingestion', details: err.message }, status)
  }
}

// ── Types for Obsidian Vault payload ──────────────────────────────────────────
interface VaultNode {
  document_title: string
  header_path: string
  content: string
  category: 'normativa' | 'metodologia' | 'mercado'
  tags: string[]
  source_file: string
}

interface VaultEdge {
  source_title: string
  target_title: string
  relation_type: string
}

interface VaultPayload {
  nodes: VaultNode[]
  edges: VaultEdge[]
}

/**
 * Endpoint: POST /vault/ingest
 * Called by GitHub Actions from validateai-knowledge-vault on every push to main.
 * Auth: Supabase service role key as Bearer token (no RaaS API key needed).
 */
export const ingestVaultHandler = async (c: any) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const expectedBearer = VAULT_INGEST_SECRET
    ? `Bearer ${VAULT_INGEST_SECRET}`
    : `Bearer ${SUPABASE_SERVICE_KEY}`
  if (authHeader !== expectedBearer) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!OPENAI_API_KEY) {
    return c.json({ error: 'OPENAI_API_KEY not configured' }, 503)
  }

  let payload: VaultPayload
  try {
    payload = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const { nodes, edges } = payload
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return c.json({ error: 'Expected non-empty "nodes" array' }, 400)
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. Generate embeddings in batches of 20 (OpenAI limit awareness)
    const BATCH = 20
    const embeddings: number[][] = []
    for (let i = 0; i < nodes.length; i += BATCH) {
      const batch = nodes.slice(i, i + BATCH).map(n =>
        `${n.document_title} — ${n.header_path}\n\n${n.content}`.slice(0, 8000)
      )
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ input: batch, model: EMBEDDING_MODEL }),
      })
      if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`)
      const data = await res.json()
      embeddings.push(...data.data.map((d: any) => d.embedding))
    }

    // 2. Build rows for knowledge_base
    // WikiLinks from edges stored as tags: "wikilink:TargetTitle"
    const wikilinksByTitle = new Map<string, string[]>()
    for (const edge of (edges ?? [])) {
      const existing = wikilinksByTitle.get(edge.source_title) ?? []
      existing.push(`wikilink:${edge.target_title}`)
      wikilinksByTitle.set(edge.source_title, existing)
    }

    const rows = nodes.map((node, i) => ({
      title: `${node.document_title} — ${node.header_path}`,
      source: 'obsidian_vault',
      category: node.category,
      content: node.content,
      tags: [...(node.tags ?? []), ...(wikilinksByTitle.get(node.document_title) ?? [])],
      embedding: embeddings[i],
    }))

    // 3. Delete stale records for these document titles (idempotent upsert pattern)
    const docTitles = [...new Set(nodes.map(n => n.document_title))]
    for (const title of docTitles) {
      await supabase
        .from('knowledge_base')
        .delete()
        .eq('source', 'obsidian_vault')
        .like('title', `${title}%`)
      await supabase
        .from('knowledge_nodes')
        .delete()
        .eq('document_title', title)
      await supabase
        .from('knowledge_edges')
        .delete()
        .eq('source_title', title)
    }

    // 4. Insert into knowledge_base (backward compat)
    const { error: insertErr } = await supabase.from('knowledge_base').insert(rows)
    if (insertErr) throw new Error(`DB insert error: ${insertErr.message}`)

    // 5. Insert into knowledge_nodes + knowledge_edges (GraphRAG layer)
    const nodeRows = nodes.map((node, i) => ({
      document_title: node.document_title,
      header_path: node.header_path || 'Introduccion',
      content: node.content,
      category: node.category,
      tags: node.tags ?? [],
      embedding: embeddings[i],
    }))
    const { error: nodeErr } = await supabase.from('knowledge_nodes').insert(nodeRows)
    if (nodeErr) console.warn('[vault-ingest] knowledge_nodes insert warn:', nodeErr.message)

    const edgeRows = (edges ?? []).map(e => ({
      source_title: e.source_title,
      target_title: e.target_title,
      relation_type: e.relation_type || 'MENTIONS',
    }))
    if (edgeRows.length > 0) {
      const { error: edgeErr } = await supabase.from('knowledge_edges').insert(edgeRows)
      if (edgeErr) console.warn('[vault-ingest] knowledge_edges insert warn:', edgeErr.message)
    }

    console.log(`[vault-ingest] ${rows.length} nodes, ${edgeRows.length} edges from ${docTitles.length} documents`)

    return c.json({
      success: true,
      nodes_upserted: rows.length,
      edges_recorded: edgeRows.length,
      documents: docTitles.length,
    })

  } catch (err: any) {
    console.error('[vault-ingest] Error:', err.message)
    return c.json({ error: 'Vault ingestion failed', details: err.message }, 500)
  }
}
