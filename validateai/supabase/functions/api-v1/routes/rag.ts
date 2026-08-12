import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = () => Deno.env.get('OPENAI_API_KEY')!
const ANTHROPIC_API_KEY = () => Deno.env.get('ANTHROPIC_API_KEY')!

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

// ── Embedding ────────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY()}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // token safety cap
    }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Embedding error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.data[0].embedding as number[]
}

// ── Retrieval ────────────────────────────────────────────────────────────────

interface KnowledgeChunk {
  id: string
  title: string
  source: string
  category: string
  content: string
  tags: string[]
  similarity: number
  origin: 'knowledge_base' | 'rag_playbooks' | 'tenant_vectors'
}

async function retrieveChunks(
  // Ver la nota en validate.ts: `ReturnType<typeof createClient>` usa los
  // genéricos por defecto y no acepta el cliente que devuelve una llamada real.
  supabase: ReturnType<typeof getSupabase>,
  embedding: number[],
  profileId: string,
  filterCategory?: string,
): Promise<KnowledgeChunk[]> {

  // Search knowledge_base (shared corpus: Ley Fintec, CMF, GTM)
  const kbPromise = supabase.rpc('search_knowledge_base', {
    query_embedding: embedding,
    filter_category: filterCategory ?? null,
    filter_tags: null,
    match_threshold: 0.45,
    match_count: 5,
  })

  // Search rag_playbooks (methodologies, GTM playbooks)
  const playbookPromise = supabase.rpc('search_rag_playbooks', {
    query_embedding: embedding,
    filter_tags: null,
    match_threshold: 0.50,
    match_count: 3,
  })

  // Search tenant_vectors (user's own ingested documents)
  const tenantPromise = supabase.rpc('search_tenant_vectors', {
    query_embedding: embedding,
    target_profile_id: profileId,
    target_version: 'oai-v3-small-1536',
    match_threshold: 0.45,
    match_count: 3,
  })

  const [kb, playbooks, tenant] = await Promise.allSettled([kbPromise, playbookPromise, tenantPromise])

  const chunks: KnowledgeChunk[] = []

  if (kb.status === 'fulfilled' && kb.value.data) {
    for (const row of kb.value.data) {
      chunks.push({ ...row, origin: 'knowledge_base' })
    }
  }

  if (playbooks.status === 'fulfilled' && playbooks.value.data) {
    for (const row of playbooks.value.data) {
      chunks.push({
        id: row.id,
        title: row.title,
        source: row.title,
        category: 'methodology',
        content: row.content,
        tags: row.tags ?? [],
        similarity: row.similarity,
        origin: 'rag_playbooks',
      })
    }
  }

  if (tenant.status === 'fulfilled' && tenant.value.data) {
    for (const row of tenant.value.data) {
      chunks.push({
        id: row.id,
        title: (row.metadata as any)?.title ?? 'Documento propio',
        source: (row.metadata as any)?.source ?? 'Base de conocimiento privada',
        category: (row.metadata as any)?.category ?? 'custom',
        content: row.content,
        tags: [],
        similarity: row.similarity,
        origin: 'tenant_vectors',
      })
    }
  }

  // Deduplicate by content similarity and sort by relevance
  return chunks
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 8)
}

// ── LLM synthesis ────────────────────────────────────────────────────────────

async function synthesizeAnswer(
  query: string,
  chunks: KnowledgeChunk[],
): Promise<{ answer: string; sources: Array<{ title: string; source: string; category: string; excerpt: string }> }> {

  if (chunks.length === 0) {
    return {
      answer: 'No encontré información relevante en mis fuentes para responder esta consulta. Intenta reformular la pregunta o amplía el alcance de la búsqueda.',
      sources: [],
    }
  }

  const context = chunks.map((c, i) =>
    `[FUENTE ${i + 1}] ${c.title} (${c.source})\n${c.content.slice(0, 800)}`
  ).join('\n\n---\n\n')

  const systemPrompt = `Eres un asistente especializado en el ecosistema de startups y regulación financiera en Chile.
Respondes ÚNICAMENTE basándote en las fuentes documentales proporcionadas.
REGLA CRÍTICA: Cita siempre la fuente usando el formato [FUENTE N] al final de cada afirmación.
Si la información no está en las fuentes, di explícitamente: "No tengo información en mis fuentes sobre este punto."
Responde en español, de forma clara y estructurada. Máximo 4 párrafos.`

  const userMessage = `Consulta: ${query}\n\nFuentes disponibles:\n\n${context}\n\nResponde citando las fuentes relevantes.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY(),
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(25000),
  })

  if (!res.ok) throw new Error(`Claude error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const answer = data.content?.[0]?.text ?? ''

  const sources = chunks.slice(0, 5).map(c => ({
    title: c.title,
    source: c.source,
    category: c.category,
    excerpt: c.content.slice(0, 200) + (c.content.length > 200 ? '...' : ''),
  }))

  return { answer, sources }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const ragQueryHandler = async (c: any) => {
  try {
    const body = await c.req.json()
    const { query, filters } = body

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return c.json({ error: '"query" debe ser un string de al menos 3 caracteres' }, 400)
    }

    const profileId: string = c.get('profile_id')
    const supabase = getSupabase()

    // 1. Generate embedding for the query
    const embedding = await generateEmbedding(query.trim())

    // 2. Retrieve relevant chunks from all sources
    const chunks = await retrieveChunks(
      supabase,
      embedding,
      profileId,
      filters?.category ?? undefined,
    )

    // 3. Synthesize grounded answer with Claude Haiku (fast + cheap)
    const { answer, sources } = await synthesizeAnswer(query, chunks)

    // 4. Log token usage estimate
    c.set('tokens_used', 300 + chunks.length * 50)

    return c.json({
      answer,
      sources,
      metadata: {
        query,
        chunks_retrieved: chunks.length,
        model: 'claude-haiku-4-5-20251001',
        retrieval_sources: [...new Set(chunks.map(ch => ch.origin))],
      },
    })

  } catch (err) {
    console.error('RAG query error:', err)
    return c.json({ error: 'Error procesando la consulta RAG', detail: String(err) }, 500)
  }
}
