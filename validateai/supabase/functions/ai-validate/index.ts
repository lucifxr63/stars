import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { phCapture } from '../_shared/posthog.ts';
import { fetchBralidusContextForPrompt, BRALIDUS_CITE_DIRECTIVE } from '../_shared/bralidus.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { type PromptType, SYSTEM_PROMPTS, PLAYBOOK_MASTER_PROMPT } from '../_shared/prompts.ts';
import { CAC_MULTIPLIERS_BY_CHANNEL, SECTOR_BENCHMARKS } from '../_shared/benchmarks.ts';
import { retrieveRelevantCompetitors, retrieveRagPlaybooks, retrieveHybridGraphRAG, checkAnalysisCache, saveAnalysisCache, RAG_TAGS_BY_PROMPT } from '../_shared/rag.ts';
import { callAI, preprocessIdea } from '../_shared/aiProvider.ts';
import { validateOutput } from '../_shared/outputSchemas.ts';
import type { StructuredIdea, AIRequest } from '../_shared/types.ts';

// â”€â”€ Env vars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_PROMPT_TYPES = new Set<PromptType>(Object.keys(SYSTEM_PROMPTS) as PromptType[]);

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const { validation_id, step, prompt_type, context } = (await req.json()) as AIRequest;

    // Validate prompt_type
    if (!VALID_PROMPT_TYPES.has(prompt_type)) {
      return new Response(JSON.stringify({ error: `Invalid prompt_type: ${prompt_type}` }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // â”€â”€ Middleware Ley 21.719 (Consentimiento) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: consent } = await supabase
      .from('consent_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('flagged', true)
      .limit(1)
      .maybeSingle();

    if (!consent) {
      return new Response(JSON.stringify({ 
        error: 'consent_required', 
        message: 'Debe aceptar los tÃ©rminos de la Ley 21.719 para continuar.' 
      }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


    // --- Tier + Rate limiting ---------------------------------------------------
    // Usa RPC atomica (check_and_increment_usage) en lugar de COUNT(ai_interactions):
    //   - Elimina race condition: SELECT FOR UPDATE serializa requests concurrentes
    //   - O(1) en lugar de O(n): contador dedicado, no tabla de auditoria
    //   - Verifica tier_expires_at: suscripciones vencidas degradan a free automaticamente
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, tier_expires_at')
      .eq('id', user.id)
      .single();

    let userTier: 'free' | 'basic' | 'pro' | 'premium' =
      (['free', 'basic', 'pro', 'premium'].includes(profile?.tier ?? ''))
        ? (profile!.tier as 'free' | 'basic' | 'pro' | 'premium')
        : 'free';

    // Downgrade automatico si la suscripcion vencio (Lemon Squeezy cancel)
    if (profile?.tier_expires_at && new Date(profile.tier_expires_at) < new Date()) {
      userTier = 'free';
    }

    const EXPENSIVE_TYPES = new Set(['competitive_analysis', 'market_sizing', 'market_signals']);
    const isExpensive = EXPENSIVE_TYPES.has(prompt_type);

    const { data: rateCheck, error: rateError } = await supabase.rpc(
      'check_and_increment_usage',
      { p_user_id: user.id, p_prompt_type: prompt_type, p_is_expensive: isExpensive, p_tier: userTier },
    );

    if (rateError) {
      // Fail-open: si el RPC falla (DB issue), loguear y permitir el request.
      // Disponibilidad > enforcement en este escenario de baja probabilidad.
      console.warn('rate-limit RPC error (fail-open):', rateError.message);
    } else if (!rateCheck?.allowed) {
      const reason: string = rateCheck?.reason ?? 'monthly_limit';
      phCapture('paywall_hit', user.id, {
        prompt_type, tier: userTier, reason,
        used: rateCheck?.used, limit: rateCheck?.limit,
      });
      const MSG: Record<string, string> = {
        tier_blocked:    'Este analisis requiere plan Basic o superior.',
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        monthly_limit:   `Limite mensual de ${rateCheck?.limit} analisis para el plan ${userTier} alcanzado.`,
        expensive_limit: `Limite de ${rateCheck?.limit} analisis de mercado para el plan ${userTier} alcanzado.`,
      };
      return new Response(JSON.stringify({
        error:   reason,
        message: MSG[reason] ?? 'Limite alcanzado.',
        used:    rateCheck?.used,
        limit:   rateCheck?.limit,
        tier:    userTier,
      }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    // ---------------------------------------------------------------------------

    // Haiku pre-pass: enriquece el contexto con idea estructurada
    let enrichedContext = context;

    // ── BralidusPY (Fase 2) — Capa 4: disparar AHORA para correr en paralelo con
    // el pre-pass Haiku y el RAG. Gating por prompt_type + tier (Capa 1) y caché por
    // perfil (Capa 2) viven dentro de fetchBralidusContextForPrompt → retorna null
    // (sin red) si el prompt no aplica o el tier no lo habilita. Se resuelve más abajo.
    const bralidusQuery = [
      context.idea_name,
      context.idea_description ?? context.idea_problem,
      context.idea_industry ?? context.industry,
      context.business_model,
    ].filter(Boolean).join('. ').slice(0, 600);
    const bralidusPromise = fetchBralidusContextForPrompt(
      supabase, prompt_type, bralidusQuery, context, userTier,
    );
    const rawDescription = context.idea_description as string | undefined;
    let structuredIdea: StructuredIdea | null = null;
    if (rawDescription && rawDescription.length > 50) {
      structuredIdea = await preprocessIdea(rawDescription);
      if (structuredIdea) {
        enrichedContext = { ...context, structured_idea: structuredIdea };
      }
    }

    // RAG: inyectar competidores relevantes para competitive_analysis
    if (prompt_type === 'competitive_analysis' && structuredIdea) {
      const rag = await retrieveRelevantCompetitors(supabase, structuredIdea);
      if (rag.length > 0) {
        enrichedContext = { ...enrichedContext, rag_competitors: rag };
      }
    }

    // RAG: inyectar playbooks metodolÃ³gicos segÃºn el tipo de prompt
    let ragSystemOverride: string | undefined;
    const ragQueryText = rawDescription
      ? `${rawDescription} ${context.target_country ?? ''} ${context.business_model ?? ''}`.trim()
      : '';

    if (ragQueryText && RAG_TAGS_BY_PROMPT[prompt_type]) {
      // playbook_analysis usa el motor hÃ­brido GraphRAG (grafo + vector)
      // El resto de prompts sigue usando search_rag_playbooks (tenant_vectors)
      const ragChunks = prompt_type === 'playbook_analysis'
        ? await retrieveHybridGraphRAG(supabase, ragQueryText)
        : await retrieveRagPlaybooks(supabase, ragQueryText, prompt_type);

      if (ragChunks) {
        if (prompt_type === 'playbook_analysis') {
          ragSystemOverride = PLAYBOOK_MASTER_PROMPT(ragChunks);
        } else {
          const basePrompt = SYSTEM_PROMPTS[prompt_type];
          ragSystemOverride = `${basePrompt}\n\n# CONTEXTO METODOLÃ“GICO ADICIONAL (RAG)\n${ragChunks}`;
        }
      } else if (prompt_type === 'playbook_analysis') {
        // NingÃºn chunk superÃ³ el umbral 0.75 â€” degradaciÃ³n elegante sin llamar al LLM
        const fallback = { _fallo_elegante: true };
        if (validation_id) {
          await supabase.from('validations').update({ playbook_analysis: fallback }).eq('id', validation_id);
        }
        // Audit log: registrar el fallo para monitoreo del threshold
        supabase.from('ai_interactions').insert({
          user_id: user.id,
          validation_id,
          step,
          prompt_type,
          input_data: { idea_description: context.idea_description, idea_industry: context.idea_industry },
          output_data: { _fallo_elegante: true, _reason: 'no_rag_chunks_above_threshold_0.75' },
          tokens_used: 0,
          model: 'graceful_degradation',
        }).then(({ error: logErr }) => {
          if (logErr) console.warn('[fallback-log] Insert error:', logErr.message);
        });
        return new Response(JSON.stringify(fallback), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    // BCCh macro: inyectar Ãºltimas series IPC para market_sizing
    if (prompt_type === 'market_sizing') {
      const { data: bdeRows } = await supabase
        .from('market_bde_data')
        .select('series_desc, obs_date, value')
        .in('series_id', ['G073.IPC.IND.2023.M', 'G073.IPC.V12.2023.M'])
        .order('obs_date', { ascending: false })
        .limit(6);

      if (bdeRows && bdeRows.length > 0) {
        const summary = bdeRows.map(
          (r: { series_desc: string; obs_date: string; value: number }) =>
            `${r.series_desc} (${r.obs_date}): ${r.value}`,
        ).join(' | ');
        enrichedContext = { ...enrichedContext, bde_macro_context: summary };
      }
    }

    // Benchmarks sectoriales + CAC por canal: inyectar para unit_economics
    if (prompt_type === 'unit_economics') {
      const industry = (context.idea_industry ?? context.industry ?? '') as string;
      const model    = (context.business_model ?? '') as string;
      const benchmark = SECTOR_BENCHMARKS[industry]?.[model]
        ?? SECTOR_BENCHMARKS[industry]?.['default']
        ?? null;
      if (benchmark) {
        enrichedContext = { ...enrichedContext, industry_benchmarks: benchmark };
      }

      const channel = (context.acquisition_channel ?? '') as string;
      const channelBenchmark = CAC_MULTIPLIERS_BY_CHANNEL[channel] ?? null;
      if (channelBenchmark) {
        enrichedContext = { ...enrichedContext, channel_cac_benchmark: channelBenchmark };
      }
    }

    // ── Resolver BralidusPY (disparado al inicio) e inyectar contexto citable ──
    // Inyecta en el contexto (dato) Y en el system prompt (instrucción de uso+cita).
    // Degradación elegante: si el fetch falló o no aplica, bralidusResult es null.
    const bralidusResult = await bralidusPromise;
    if (bralidusResult && bralidusResult.context.contextBlock) {
      enrichedContext = { ...enrichedContext, bralidus_context: bralidusResult.context.contextBlock };
      const baseSystem = ragSystemOverride ?? SYSTEM_PROMPTS[prompt_type];
      ragSystemOverride =
        `${baseSystem}\n\n# INTELIGENCIA BRALIDUS (datos macro fechados + doctrina normativa)\n` +
        `${bralidusResult.context.contextBlock}\n\n${BRALIDUS_CITE_DIRECTIVE}`;
    }

    // CachÃ©: verificar si existe un anÃ¡lisis similar reciente
    const cacheableTypes = ['summary', 'risk_analysis', 'unit_economics', 'market_sizing'];
    const ideaCacheKey = rawDescription
      ? `${rawDescription} ${context.target_country ?? ''} ${context.business_model ?? ''}`.trim()
      : null;

    if (ideaCacheKey && cacheableTypes.includes(prompt_type)) {
      const cached = await checkAnalysisCache(supabase, ideaCacheKey, prompt_type);
      if (cached) {
        console.log(`[cache hit] ${prompt_type} similarity=${cached.similarity.toFixed(3)}`);
        return new Response(
          JSON.stringify({ ...cached.analysis_data, _fromCache: true, _cacheSimilarity: cached.similarity }),
          { headers: { ...cors, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Llamada AI con routing dual
    const tierForAI = (userTier === 'premium' ? 'pro' : userTier) as 'free' | 'basic' | 'pro';
    const { parsed, inputTokens, outputTokens, model } = await callAI(prompt_type, enrichedContext, ragSystemOverride, tierForAI);

    // Adjuntar evidencia Bralidus al resultado: auditable y respaldado (insumo EvidenceWall, Fase 3).
    // Clave `_bralidus` ignorada por los renderers del frontend que no la conocen.
    if (bralidusResult && bralidusResult.context.evidence.length > 0) {
      (parsed as Record<string, unknown>)._bralidus = {
        evidence:       bralidusResult.context.evidence,
        experts:        bralidusResult.context.experts,
        data_freshness: bralidusResult.context.dataFreshness,
        cached:         bralidusResult.cached,
      };
    }

    // T3.1 — Validación observe-only de la salida del LLM. Si el shape no cumple el
    // schema (alucinación de estructura) lo registramos, pero NO bloqueamos: persiste
    // igual para no romper al usuario por un falso positivo. Con la telemetría se
    // decide luego si endurecer (rechazar/reintentar).
    const outputCheck = validateOutput(prompt_type, parsed);
    if (!outputCheck.ok) {
      console.error(`[ai-output-invalid] ${prompt_type}: ${outputCheck.error}`);
      phCapture('ai_output_invalid', user.id, {
        prompt_type,
        tier: userTier,
        model,
        issue: outputCheck.error,
        validation_id: validation_id ?? null,
      });
    }

    phCapture('ai_prompt_called', user.id, {
      prompt_type,
      tier: userTier,
      model,
      tokens_in: inputTokens,
      tokens_out: outputTokens,
      tokens_total: inputTokens + outputTokens,
      validation_id: validation_id ?? null,
      bralidus_used: bralidusResult !== null,
      bralidus_cached: bralidusResult?.cached ?? false,
    });

    // Guardar en cachÃ© (no bloqueante)
    if (ideaCacheKey && cacheableTypes.includes(prompt_type)) {
      saveAnalysisCache(
        supabase, ideaCacheKey, prompt_type, parsed,
        context.idea_industry as string | undefined,
        context.target_country as string | undefined,
      ).catch((err) => console.warn('[cache-save] Error:', err));
    }

    // Persistencia bloqueante: el backend es el SSOT para campos derivados
    if (validation_id) {
      const persistUpdates: Record<string, unknown> = {};

      if (prompt_type === 'summary') {
        const scoreVal = typeof parsed.score === 'number' ? parsed.score : null;
        persistUpdates.summary_json     = parsed;
        persistUpdates.validation_score = scoreVal;
        persistUpdates.ai_feedback      = typeof parsed.feedback === 'string' ? parsed.feedback : null;
        persistUpdates.score_breakdown  = parsed.score_breakdown ?? null;
      } else if (prompt_type === 'competitive_analysis') {
        persistUpdates.competitive_analysis = parsed;
      } else if (prompt_type === 'market_sizing') {
        persistUpdates.market_sizing = parsed;
      } else if (prompt_type === 'risk_analysis') {
        persistUpdates.risk_analysis = parsed;
      } else if (prompt_type === 'unit_economics') {
        persistUpdates.unit_economics = parsed;
      } else if (prompt_type === 'founder_fit') {
        persistUpdates.founder_fit = parsed;
      } else if (prompt_type === 'market_signals') {
        persistUpdates.market_signals = parsed;
      } else if (prompt_type === 'governance_assessment') {
        persistUpdates.governance_assessment = parsed;
      } else if (prompt_type === 'fundraising_roadmap') {
        persistUpdates.fundraising_roadmap = parsed;
      } else if (prompt_type === 'playbook_analysis') {
        persistUpdates.playbook_analysis = parsed;
      } else if (prompt_type === 'pitch_deck') {
        persistUpdates.pitch_deck_content = parsed;
      } else if (prompt_type === 'lean_roadmap') {
        persistUpdates.lean_roadmap = parsed;
      } else if (prompt_type === 'financial_projection') {
        persistUpdates.financial_projection = parsed;
      } else if (prompt_type === 'compliance_roadmap') {
        persistUpdates.compliance_roadmap = parsed;
      }

      if (Object.keys(persistUpdates).length > 0) {
        const { error: persistErr } = await supabase
          .from('validations')
          .update(persistUpdates)
          .eq('id', validation_id);
        if (persistErr) console.warn('[persist] Error saving to validations:', persistErr.message);
      }
    }

    // Log de interacciÃ³n (no bloqueante)
    supabase.from('ai_interactions').insert({
      user_id: user.id,
      validation_id,
      step,
      prompt_type,
      input_data: context,
      output_data: parsed,
      tokens_used: inputTokens + outputTokens,
      model,
    }).then(({ error: logErr }) => {
      if (logErr) console.warn('[ai-log] Insert error:', logErr.message);
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ai-validate] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
