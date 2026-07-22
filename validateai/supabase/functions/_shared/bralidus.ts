// ─────────────────────────────────────────────────────────────────────────────
// _shared/bralidus.ts — Contrato único de integración con BralidusPY (GraphRAG macro/legal).
//
// Centraliza el bridge para que ai-validate (wizard) y assemble-mega-prompt (DD)
// compartan: tipos, llamadas MoE, extracción polimórfica de evidencia, ensamblado
// de contexto citable, y el orquestador cacheado por perfil.
//
// Procedencia: el metadata de Bralidus tiene DOS shapes (smoke test 2026-06-11):
//   - 'financial' (FRED/yfinance/OpenBB): ultimo_valor + ultima_fecha → cita fechada/auditable
//   - 'doctrine'  (Familia A): entity_type → referencia permanente, SIN fecha
// ─────────────────────────────────────────────────────────────────────────────

// ── Config (env) ──────────────────────────────────────────────────────────────
// En prod, BRALIDUS_URL apunta al deploy de Railway; en dev local cae a localhost.
export const BRALIDUS_URL     = Deno.env.get('BRALIDUS_URL') ?? 'http://localhost:8000';
export const BRALIDUS_API_KEY = Deno.env.get('BRALIDUS_API_KEY') ?? '';

export const BRALIDUS_TIER: Record<string, { topK: number; enabled: boolean; macroOnly: boolean }> = {
  free:    { topK: 0,  enabled: false, macroOnly: true  },
  basic:   { topK: 8,  enabled: true,  macroOnly: true  },
  pro:     { topK: 20, enabled: true,  macroOnly: false },
  premium: { topK: 25, enabled: true,  macroOnly: false },
  admin:   { topK: 25, enabled: true,  macroOnly: false },
};

// Entidades macro forzadas vía entity_override (datos fechados que el MoE puro
// desplaza del top-k por crowding-out de los expertos de doctrina).
export const BRALIDUS_MACRO_OVERRIDE = [
  'PIB USA (GDP)', 'Inflación USA (CPI All Urban Consumers)',
  'Tasa de Fondos Federales (Fed Funds Rate)', 'USD/CLP (Tipo de Cambio Chile)',
  'High Yield Credit Spread (Apetito Riesgo Credito)', 'IPSA (Indice Bursatil Chile)',
];

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface BraliduAlert {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
}

export interface BralidusEvidence {
  shape: 'financial' | 'doctrine';
  claim: string;             // document_title
  category: string | null;
  relevance: number;
  // shape 'financial' — dato fechado y auditable
  indicator?: string;        // series_id | symbol
  value?: number;            // ultimo_valor
  unit?: string;             // unidad
  date?: string;             // ultima_fecha
  source?: string;           // fuente
  source_url?: string;       // url_fuente
  // shape 'doctrine' — referencia permanente, SIN fecha
  entity_type?: string;
  entity_value?: string;
  dimension?: string;
  threshold?: number | string;
}

export interface BralidusExpert {
  expert_id: string;
  expert_name: string;
  score: number;
}

export interface BralidusBundle {
  contextForLLM: string;
  alerts: BraliduAlert[];
  evidence: BralidusEvidence[];
  experts: BralidusExpert[];
  dataFreshness: Record<string, string> | null;
}

// Contexto Bralidus listo para inyectar + estructurado (insumo del EvidenceWall, Fase 3).
export interface BralidusContext {
  contextBlock: string;
  evidence: BralidusEvidence[];
  experts: BralidusExpert[];
  dataFreshness: Record<string, string> | null;
}

export interface BralidusProfile { industry: string; stage: string; geography: string; }

// Cliente Supabase mínimo (solo lo que usa el caché). Consistente con el uso de
// `any` en las edge functions del repo.
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ── Severidad de alertas por familia normativa ────────────────────────────────
const _FAMILIA_A_SEVERITY: Record<string, 'critical' | 'warning' | 'info'> = {
  'Cumplimiento Normativo': 'critical',
  'Unit Economics':         'warning',
  'Gobernanza':             'warning',
  'Traccion y Evidencia':   'warning',
  'Estrategia Fundraising': 'info',
  'Moat Competitivo':       'info',
  'MVP Roadmap':            'info',
};

export function _extractBraliduAlerts(nodes: Array<Record<string, unknown>>): BraliduAlert[] {
  return nodes
    .filter(n => (n.metadata as Record<string, unknown> | null)?.entity_type)
    .map(n => ({
      severity: _FAMILIA_A_SEVERITY[n.category as string] ?? 'info',
      category: n.category as string,
      title: n.document_title as string,
    }));
}

// ── Extracción polimórfica de evidencia ───────────────────────────────────────
export function nodeToEvidence(n: Record<string, unknown>): BralidusEvidence | null {
  const md = (n.metadata ?? {}) as Record<string, unknown>;
  const base = {
    claim: (n.document_title as string) ?? 'N/D',
    category: (n.category as string) ?? null,
    relevance: typeof n.relevance === 'number' ? (n.relevance as number) : 0,
  };
  // Shape 1 — financiero/macro: valor + fecha → cita fechada y verificable.
  if (md.ultimo_valor !== undefined && md.ultimo_valor !== null && md.ultima_fecha) {
    return {
      ...base,
      shape: 'financial',
      indicator: (md.series_id as string) ?? (md.symbol as string) ?? undefined,
      value: md.ultimo_valor as number,
      unit: (md.unidad as string) ?? undefined,
      date: md.ultima_fecha as string,
      source: (md.fuente as string) ?? undefined,
      source_url: (md.url_fuente as string) ?? undefined,
    };
  }
  // Shape 2 — doctrina/Familia A: referencia permanente, sin frescura.
  if (md.entity_type) {
    return {
      ...base,
      shape: 'doctrine',
      entity_type: md.entity_type as string,
      entity_value: (md.entity_value as string) ?? undefined,
      dimension: (md.dimension as string) ?? undefined,
      threshold: (md.threshold ?? md.threshold_months) as number | string | undefined,
    };
  }
  return null;
}

// ── Llamada cruda a /query/moe ────────────────────────────────────────────────
export async function callBralidusMoE(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const authHeaders: Record<string, string> = BRALIDUS_API_KEY
    ? { 'Authorization': `Bearer ${BRALIDUS_API_KEY}` }
    : {};
  const res = await fetch(`${BRALIDUS_URL}/query/moe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`BralidusPY MoE HTTP ${res.status}`);
  return await res.json() as Record<string, unknown>;
}

// ── Ensamblado de contexto citable (compressBralidus) ─────────────────────────
// Shape 'financial' → cita fechada con valor/unidad/fuente/URL.
// Shape 'doctrine'  → referencia permanente sin fecha. Cap ~600 tokens (~2400 chars).
export function compressBralidus(
  evidence: BralidusEvidence[],
  alerts: BraliduAlert[],
  dataFreshness: Record<string, string> | null,
): string {
  if (evidence.length === 0 && alerts.length === 0) return '';
  const criticalWarning = alerts
    .filter(a => a.severity === 'critical' || a.severity === 'warning')
    .map(a => `  [${a.severity.toUpperCase()}] ${a.title}`)
    .join('\n');

  // Deduplicación sintáctica por clave única (claim + date + indicator)
  const seenKeys = new Set<string>();
  const uniqueEvidences: BralidusEvidence[] = [];
  for (const ev of evidence) {
    const key = `${ev.claim ?? ''}_${ev.date ?? ''}_${ev.indicator ?? ''}_${ev.entity_value ?? ''}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueEvidences.push(ev);
    }
  }

  const evLines: string[] = [];
  let budget = 2400; // Presupuesto total ~600 tokens
  for (const ev of uniqueEvidences) {
    let line: string;
    if (ev.shape === 'financial') {
      const val = typeof ev.value === 'number' ? ev.value.toLocaleString('es-CL') : String(ev.value ?? '');
      const ind = ev.indicator ? ` (${ev.indicator})` : '';
      const src = ev.source ? ` - fuente: ${ev.source}` : '';
      const url = ev.source_url ? ` <${ev.source_url}>` : '';
      line = `  - [DATO ${ev.date}] ${ev.claim}${ind}: ${val}${ev.unit ?? ''}${src}${url}`;
    } else {
      const dim = ev.dimension ? ` / ${ev.dimension}` : '';
      const thr = ev.threshold !== undefined ? ` (umbral: ${ev.threshold})` : '';
      line = `  - [DOCTRINA] ${ev.entity_value ?? ev.claim}${dim}${thr}`;
    }
    // Cota defensiva: truncar línea individual a máx 1400 caracteres (~350 tokens)
    if (line.length > 1400) line = line.slice(0, 1400) + '...';
    if (budget - line.length < 0) break;
    budget -= line.length;
    evLines.push(line);
  }

  const freshnessNote = dataFreshness
    ? `  Frescura de datos: ${Object.entries(dataFreshness).map(([k, v]) => `${k}=${v}`).join(', ')}`
    : '';
  return [
    '[BRALIDUS - Inteligencia GraphRAG (datos macro fechados + doctrina normativa)]',
    criticalWarning || '  (Sin alertas Familia A para este perfil)',
    '',
    '  EVIDENCIA CITABLE (cita estas fuentes y fechas al ajustar un score):',
    ...evLines,
    freshnessNote,
  ].filter(Boolean).join('\n');
}

// Directriz de cita inyectable en el system prompt de cualquier consumidor.
export const BRALIDUS_CITE_DIRECTIVE =
  'Cuando un dato de la sección [BRALIDUS] influya en tu evaluación, CITA el indicador, su valor y su ' +
  'fecha en el campo correspondiente (gaps / source_notes / assumptions / feedback). Los ítems "[DATO ' +
  'aaaa-mm-dd]" llevan fecha verificable — úsala. Los ítems "[DOCTRINA]" son referencias permanentes SIN ' +
  'fecha — cítalos por nombre, NUNCA inventes una fecha para ellos.';

// ── DD: doble pull holístico (assemble-mega-prompt) ───────────────────────────
// pro/premium (macroOnly=false): MoE semántico (doctrina + Radar Forense) + macro
// forzado (datos fechados). basic (macroOnly=true): solo el pull macro.
export async function fetchBralidusBundle(
  query: string,
  // company_rut/tenant_id opcionales: se forwardean verbatim a Bralidus (que los
  // usa para inyectar relaciones societarias de S-Pulse). Este pull NO usa la
  // caché por perfil (bralidus_context_cache), así que sumar el RUT no la envenena.
  startupContext: { industry: string; stage: string; geography: string; company_rut?: string; tenant_id?: string },
  tier: string,
): Promise<BralidusBundle> {
  const config = BRALIDUS_TIER[tier] ?? BRALIDUS_TIER.free;

  const calls: Promise<Record<string, unknown>>[] = [
    callBralidusMoE({
      query,
      startup_context: startupContext,
      top_k: BRALIDUS_MACRO_OVERRIDE.length,
      match_threshold: 0.30,
      entity_override: BRALIDUS_MACRO_OVERRIDE,
    }),
  ];
  if (!config.macroOnly) {
    calls.unshift(callBralidusMoE({
      query,
      startup_context: startupContext,
      top_k: config.topK,
      match_threshold: 0.30,
      max_experts: 3,
    }));
  }

  const settled = await Promise.allSettled(calls);
  const responses = settled
    .filter((s): s is PromiseFulfilledResult<Record<string, unknown>> => s.status === 'fulfilled')
    .map(s => s.value);
  if (responses.length === 0) throw new Error('BralidusPY: MoE + macro fallaron');

  return mergeResponses(responses);
}

// ── Wizard: gating + pull dirigido simple + caché por perfil ───────────────────

// Mapa prompt_type → cómo consultar Bralidus. Prompts AUSENTES no llaman a Bralidus
// (Capa 1: gating). Prompts con el mismo 'scope' comparten caché (más dedupe que prompt_type).
// 'scope' es la clave de caché: prompts con el MISMO scope comparten fila (pull idéntico).
// 'queryHint' sesga la query con keywords de dominio para que el GatingNetwork rute al
// experto correcto — sin hardcodear entidades (robusto a cambios del KG).
//
// ALCANCE (validado contra Bralidus vivo 2026-06-11): solo los prompts donde Bralidus
// aporta señal verificable y dirigida — datos macro FECHADOS + unit economics.
//   - market_sizing/risk → macroForce: 6 datos fechados (FRED/yfinance), aporte claro.
//   - unit_economics → queryHint enruta a experto 'unit_economics'; nodos LTV:CAC/Payback/
//     Burn/CAC correctos.
// DIFERIDOS (governance/compliance/fundraising/competitive): los nodos-hub de relevancia 1.0
// (benchmarks unit-econ) dominan el top-k incluso con el experto legal/estrategia activo, así
// que el retrieval NO surfacea su doctrina específica (SpA, Ley 21.719, Corfo). Además su
// SYSTEM_PROMPT ya es doctrina-rico. Re-habilitar requiere entity_override por experto
// (acoplar a títulos del KG) o que fluyan señales del Radar Forense. Follow-up post-Fase 0.
export const BRALIDUS_BY_PROMPT: Record<string, {
  scope: string; macroForce?: boolean; maxExperts?: number; queryHint?: string; ttlSeconds?: number;
}> = {
  // macroForce → entity_override macro (datos fechados). Mismo pull → comparten scope 'macro'.
  market_sizing:  { scope: 'macro', macroForce: true, ttlSeconds: 6 * 3600 },
  risk_analysis:  { scope: 'macro', macroForce: true, ttlSeconds: 6 * 3600 },
  risk_checklist: { scope: 'macro', macroForce: true, ttlSeconds: 6 * 3600 },
  // Doctrina dirigida por queryHint (cachea en su propio scope).
  unit_economics: { scope: 'unit_economics', maxExperts: 1, ttlSeconds: 7 * 24 * 3600,
    queryHint: 'CAC LTV churn burn rate runway payback NRR unit economics métricas SaaS' },
};

export function normalizeProfile(c: Record<string, unknown>): BralidusProfile {
  const industry = String(c.industry ?? c.idea_industry ?? 'default').toLowerCase().trim() || 'default';
  const stage    = String(c.stage ?? c.business_stage ?? 'seed').toLowerCase().trim() || 'seed';
  let geo        = String(c.geography ?? c.target_country ?? 'chile').toLowerCase().trim();
  geo = (geo === 'cl' || geo === '' ) ? 'chile' : geo;
  return { industry, stage, geography: geo };
}

// Lectura del caché (Capa 2 — correctness por filtro expires_at > now()).
export async function getCachedBralidusContext(
  supabase: SupabaseClient, scope: string, p: BralidusProfile,
): Promise<BralidusContext | null> {
  const { data, error } = await supabase
    .from('bralidus_context_cache')
    .select('context_block, evidence, experts, data_freshness')
    .eq('scope', scope).eq('industry', p.industry).eq('stage', p.stage).eq('geography', p.geography)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  // hit_count++ (no bloqueante, métrica de ROI del caché).
  supabase.rpc('bump_bralidus_cache_hit', {
    p_scope: scope, p_industry: p.industry, p_stage: p.stage, p_geo: p.geography,
  }).then(() => {}, () => {});
  return {
    contextBlock: (data.context_block as string) ?? '',
    evidence: (data.evidence as BralidusEvidence[]) ?? [],
    experts: (data.experts as BralidusExpert[]) ?? [],
    dataFreshness: (data.data_freshness as Record<string, string> | null) ?? null,
  };
}

// Escritura del caché (UPSERT sobre keyspace acotado → tabla auto-acotada).
export async function setCachedBralidusContext(
  supabase: SupabaseClient, scope: string, p: BralidusProfile, ctx: BralidusContext, ttlSeconds: number,
): Promise<void> {
  const now = new Date();
  await supabase.from('bralidus_context_cache').upsert({
    scope, industry: p.industry, stage: p.stage, geography: p.geography,
    context_block: ctx.contextBlock,
    evidence: ctx.evidence,
    experts: ctx.experts,
    data_freshness: ctx.dataFreshness,
    node_count: ctx.evidence.length,
    expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    refreshed_at: now.toISOString(),
  }, { onConflict: 'scope,industry,stage,geography' });
}

// Pull dirigido simple (sin doble pull — en el wizard cada prompt llama a su experto,
// no hay crowding-out). macroForce → entity_override macro (datos fechados);
// si no → MoE con max_experts acotado (doctrina del experto del prompt).
async function fetchTargetedBundle(
  query: string,
  p: BralidusProfile,
  route: { macroForce?: boolean; maxExperts?: number; queryHint?: string },
  tierCfg: { topK: number },
): Promise<BralidusBundle> {
  const startup_context = { industry: p.industry, stage: p.stage, geography: p.geography };
  // queryHint sesga el routing del GatingNetwork hacia el experto del prompt.
  const q = route.queryHint ? `${route.queryHint}. ${query}` : query;
  const body: Record<string, unknown> = route.macroForce
    ? { query: q, startup_context, top_k: BRALIDUS_MACRO_OVERRIDE.length, match_threshold: 0.30, entity_override: BRALIDUS_MACRO_OVERRIDE }
    : { query: q, startup_context, top_k: tierCfg.topK || 8, match_threshold: 0.30, max_experts: route.maxExperts ?? 1 };
  return mergeResponses([await callBralidusMoE(body)]);
}

// Orquestador del wizard: gating (Capa 1) → caché por perfil (Capa 2) → pull dirigido (Capa 3).
// Degrada a null ante cualquier fallo (el prompt corre sin Bralidus). La paralelización
// con el pre-pass Haiku (Capa 4) la hace el llamador (ai-validate).
export async function fetchBralidusContextForPrompt(
  supabase: SupabaseClient,
  promptType: string,
  query: string,
  rawCtx: Record<string, unknown>,
  tier: string,
): Promise<{ context: BralidusContext; cached: boolean } | null> {
  const route = BRALIDUS_BY_PROMPT[promptType];
  if (!route) return null;                                  // Capa 1: gating
  const tierCfg = BRALIDUS_TIER[tier] ?? BRALIDUS_TIER.free;
  if (!tierCfg.enabled) return null;

  const p = normalizeProfile(rawCtx);
  try {
    const hit = await getCachedBralidusContext(supabase, route.scope, p);   // Capa 2
    if (hit && hit.contextBlock) return { context: hit, cached: true };

    const bundle = await fetchTargetedBundle(query, p, route, tierCfg);      // Capa 3
    const contextBlock = compressBralidus(bundle.evidence, bundle.alerts, bundle.dataFreshness);
    const ctx: BralidusContext = {
      contextBlock,
      evidence: bundle.evidence,
      experts: bundle.experts,
      dataFreshness: bundle.dataFreshness,
    };
    if (contextBlock) {
      // Escritura no bloqueante: el usuario no espera el guardado del caché.
      setCachedBralidusContext(supabase, route.scope, p, ctx, route.ttlSeconds ?? 6 * 3600)
        .catch(() => {});
    }
    return { context: ctx, cached: false };
  } catch (_e) {
    return null;                                            // degradación elegante
  }
}

// ── Helper interno: merge de respuestas MoE → bundle ──────────────────────────
function mergeResponses(responses: Record<string, unknown>[]): BralidusBundle {
  const nodeByTitle = new Map<string, Record<string, unknown>>();
  const expertsById = new Map<string, BralidusExpert>();
  let dataFreshness: Record<string, string> | null = null;
  const contextParts: string[] = [];

  for (const r of responses) {
    for (const n of (r.nodes ?? []) as Record<string, unknown>[]) {
      const title = n.document_title as string;
      const prev = nodeByTitle.get(title);
      if (!prev || ((n.relevance as number) ?? 0) > ((prev.relevance as number) ?? 0)) {
        nodeByTitle.set(title, n);
      }
    }
    for (const e of (r.experts_activated ?? []) as Record<string, unknown>[]) {
      const id = e.expert_id as string;
      if (id && !expertsById.has(id)) {
        expertsById.set(id, {
          expert_id: id,
          expert_name: (e.expert_name as string) ?? id,
          score: (e.score as number) ?? 0,
        });
      }
    }
    if (r.data_freshness && !dataFreshness) dataFreshness = r.data_freshness as Record<string, string>;
    if (typeof r.context_for_llm === 'string' && r.context_for_llm) contextParts.push(r.context_for_llm);
  }

  const mergedNodes = [...nodeByTitle.values()];
  const evidence = mergedNodes
    .map(nodeToEvidence)
    .filter((e): e is BralidusEvidence => e !== null)
    .sort((a, b) => b.relevance - a.relevance);

  return {
    contextForLLM: contextParts.join('\n\n'),
    alerts: _extractBraliduAlerts(mergedNodes),
    evidence,
    experts: [...expertsById.values()],
    dataFreshness,
  };
}
