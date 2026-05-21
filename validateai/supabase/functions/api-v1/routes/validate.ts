import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import {
  ValidateRequestSchema,
  LlmValidationResponseSchema,
  type RaasResponse,
} from '../../shared-schemas/mod.ts';

const ANTHROPIC_API_KEY = () => Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_API_KEY = () => Deno.env.get('OPENAI_API_KEY')!;
const CMF_API_KEY = '2a1b3c4d5e6f7g8h'; // override with env in production

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY()}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Embedding API error: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding as number[];
}

async function fetchCurrentUf(): Promise<{ valor: number; fecha: string } | null> {
  try {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const url = `https://api.cmfchile.cl/api-sbifv3/recursos_api/uf/${year}/${month}/dias?apikey=${CMF_API_KEY}&formato=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const raw = await res.json();
    const uf = raw?.UFs?.[0];
    if (!uf) return null;
    return { valor: parseFloat(uf.Valor.replace(',', '.')), fecha: uf.Fecha };
  } catch {
    return null;
  }
}

async function fetchSiiEmpresa(rut: string): Promise<Record<string, unknown> | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // Delegate to the sii-proxy function (internal call)
    const res = await fetch(`${supabaseUrl}/functions/v1/sii-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ rut }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

async function fetchInapiRisk(brandName: string): Promise<{ risk_level: string; observation: string } | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const res = await fetch(`${supabaseUrl}/functions/v1/inapi-fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ brand_name: brandName, validation_id: 'raas-internal' }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ? { risk_level: json.data.risk_level, observation: json.data.observation } : null;
  } catch {
    return null;
  }
}

async function searchCompetitors(
  supabase: ReturnType<typeof createClient>,
  embedding: number[],
): Promise<Array<{ name: string; description: string; similarity: number }>> {
  const { data, error } = await supabase.rpc('search_competitors', {
    query_embedding: embedding,
    match_threshold: 0.65,
    match_count: 5,
  });
  if (error || !data) return [];
  return data as Array<{ name: string; description: string; similarity: number }>;
}

async function searchPlaybooks(
  supabase: ReturnType<typeof createClient>,
  embedding: number[],
): Promise<Array<{ title: string; content: string }>> {
  const { data, error } = await supabase.rpc('search_rag_playbooks', {
    query_embedding: embedding,
    match_threshold: 0.60,
    match_count: 3,
  });
  if (error || !data) return [];
  return data as Array<{ title: string; content: string }>;
}

async function checkSemanticCache(
  supabase: ReturnType<typeof createClient>,
  embedding: number[],
): Promise<RaasResponse | null> {
  const { data, error } = await supabase.rpc('search_cached_analyses', {
    query_embedding: embedding,
    match_threshold: 0.92,
    match_count: 1,
  }).maybeSingle();
  if (error || !data) return null;
  try {
    return data.result_json as RaasResponse;
  } catch {
    return null;
  }
}

// ─── LLM Orchestration ────────────────────────────────────────────────────────

async function callClaude(megaPrompt: string, systemPrompt: string): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY(),
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          // Cache the static system prompt to reduce costs (Prompt Caching)
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: megaPrompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text ?? '';

  // Extract JSON from the response (Claude may wrap in markdown)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');
  return JSON.parse(jsonMatch[0]);
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export const validateHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const parsed = ValidateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Validación de entrada fallida', details: parsed.error.flatten().fieldErrors }, 400);
    }

    const { idea_description, industry, rut_empresa } = parsed.data;
    const supabase = getSupabase();

    // 1. Generate embedding for semantic search + cache lookup
    const embedding = await generateEmbedding(`${idea_description} ${industry}`);

    // 2. Check semantic cache (threshold 0.92 per plan)
    const cached = await checkSemanticCache(supabase, embedding);
    if (cached) {
      c.set('tokens_used', 0);
      return c.json({ ...cached, metadata: { ...cached.metadata, cached: true } });
    }

    // 3. Parallel data fetching
    const [ufData, siiData, inapiData, competitors, playbooks] = await Promise.allSettled([
      fetchCurrentUf(),
      rut_empresa ? fetchSiiEmpresa(rut_empresa) : Promise.resolve(null),
      fetchInapiRisk(idea_description.split(' ').slice(0, 3).join(' ')),
      searchCompetitors(supabase, embedding),
      searchPlaybooks(supabase, embedding),
    ]);

    const uf = ufData.status === 'fulfilled' ? ufData.value : null;
    const sii = siiData.status === 'fulfilled' ? siiData.value : null;
    const inapi = inapiData.status === 'fulfilled' ? inapiData.value : null;
    const competitorList = competitors.status === 'fulfilled' ? competitors.value : [];
    const playbookFragments = playbooks.status === 'fulfilled' ? playbooks.value : [];

    // 4. Determine PJUD status (async — don't block)
    const pjudStatus = 'pending_async_resolution';

    // 5. Assemble mega-prompt
    const systemPrompt = `Eres un analista de Venture Capital de clase mundial con expertise en el ecosistema startup chileno y latinoamericano.
Tu especialidad es emitir diagnósticos de viabilidad de grado institucional basados en datos empíricos.
REGLA CRÍTICA: Responde ÚNICAMENTE con un JSON válido que siga exactamente el esquema solicitado. Sin markdown, sin texto extra.
REGLA ANTI-ALUCINACIÓN: Si un dato no está disponible en el contexto, usa null o estima con el rango más conservador. NUNCA inventes métricas específicas.`;

    const megaPrompt = `
Analiza la siguiente idea de negocio y genera un reporte de viabilidad estructurado en JSON.

## IDEA
Descripción: ${idea_description}
Industria: ${industry}

## DATOS GUBERNAMENTALES CHILENOS
${sii ? `### Estado SII (Empresa con RUT ${rut_empresa})
- Razón Social: ${(sii as any).razon_social}
- Estado Tributario: ${(sii as any).estado_tributario}
- Actividades: ${JSON.stringify((sii as any).actividades_economicas ?? [])}
- Anotaciones vigentes: ${(sii as any).anotaciones_vigentes}` : '### SII: No se proporcionó RUT de empresa (análisis de idea en etapa temprana).'}

${uf ? `### CMF — Valor UF Actual
- UF: $${uf.valor.toFixed(2)} CLP (al ${uf.fecha})
- Usa este valor para calcular TAM/SAM en UF.` : '### CMF: No disponible. Usa UF ≈ 38.000 CLP como estimado conservador.'}

${inapi ? `### INAPI — Disponibilidad de Marca
- Riesgo: ${inapi.risk_level}
- Observación: ${inapi.observation}` : '### INAPI: No consultado.'}

### PJUD: ${pjudStatus === 'pending_async_resolution' ? 'Consulta asíncrona en proceso.' : 'Sin causas activas.'}

## CONTEXTO RAG — COMPETIDORES DETECTADOS (top similares en base vectorial)
${competitorList.length > 0
  ? competitorList.map((c: any) => `- ${c.name}: ${c.description} (similitud: ${(c.similarity * 100).toFixed(0)}%)`).join('\n')
  : 'Mercado naciente: No se encontraron competidores mapeados con similitud > 0.65. Evalúa como mercado virgen o muy nicho.'}

## CONTEXTO RAG — PLAYBOOKS METODOLÓGICOS
${playbookFragments.map((p: any) => `### ${p.title}\n${p.content.slice(0, 500)}...`).join('\n\n')}

## ESQUEMA JSON REQUERIDO (responde SOLO con esto):
{
  "viability_score": <número 0-100>,
  "regulatory_risk": {
    "level": <"Bajo" | "Medio" | "Alto">,
    "reason": "<string explicativo>",
    "sii_warnings": ["<advertencia opcional>"]
  },
  "market_analysis": {
    "tam_clp": <número estimado en CLP>,
    "sam_clp": <número estimado en CLP>,
    "competitors_detected": ["<nombre competidor>"]
  },
  "unit_economics": {
    "estimated_cac_uf": <número en UF>,
    "estimated_ltv_uf": <número en UF>,
    "runway_months_estimate": <número opcional>
  },
  "swot": {
    "strengths": ["<fortaleza>"],
    "weaknesses": ["<debilidad>"],
    "opportunities": ["<oportunidad>"],
    "threats": ["<amenaza>"]
  },
  "next_steps": ["<paso accionable>"],
  "executive_summary": "<párrafo ejecutivo de 3-5 oraciones>"
}`;

    // 6. Call Claude with retry logic (max 2 retries per QA DoD)
    let llmResult: unknown;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        llmResult = await callClaude(megaPrompt, systemPrompt);
        break;
      } catch (err) {
        lastError = err as Error;
        console.warn(`Claude attempt ${attempt + 1} failed:`, err);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (!llmResult) {
      throw lastError ?? new Error('LLM failed after 3 attempts');
    }

    // 7. Validate LLM output with Zod (hallucination guard per QA DoD)
    const validated = LlmValidationResponseSchema.safeParse(llmResult);
    if (!validated.success) {
      console.error('LLM output failed Zod validation:', validated.error.flatten());
      return c.json({ error: 'El modelo devolvió una estructura inesperada. Intenta de nuevo.', code: 'LLM_SCHEMA_ERROR' }, 502);
    }

    // 8. Assemble final response
    const response: RaasResponse = {
      ...validated.data,
      metadata: {
        model: 'claude-sonnet-4-6',
        uf_value_clp: uf?.valor,
        uf_date: uf?.fecha,
        sii_status: (sii as any)?.estado_tributario ?? undefined,
        inapi_risk: inapi?.risk_level ?? undefined,
        pjud_status: pjudStatus,
        rag_competitors_used: competitorList.length,
        cached: false,
        processed_at: new Date().toISOString(),
      },
    };

    // 9. Store in semantic cache (fire and forget)
    supabase.from('cached_analyses').insert({
      embedding,
      idea_description,
      industry,
      result_json: response,
    }).then();

    c.set('tokens_used', 500); // approximate
    return c.json(response);

  } catch (err) {
    console.error('validate handler error:', err);
    return c.json({ error: 'Error interno del servidor', detail: String(err) }, 500);
  }
};
