// Capa de proveedores de IA (Anthropic/OpenAI) + pre-pass Haiku, extraída de
// ai-validate (#5 W3). Bodies byte-identical; env consts relocadas verbatim.
import type { PromptType } from './prompts.ts';
import { SYSTEM_PROMPTS } from './prompts.ts';
import { buildUserContent, extractJSON } from './promptContext.ts';
import type { StructuredIdea, AIResult } from './types.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const OPENAI_API_KEY    = Deno.env.get('OPENAI_API_KEY');
const AI_PROVIDER = (Deno.env.get('AI_PROVIDER') ?? 'anthropic') as 'anthropic' | 'openai';

export async function preprocessIdea(rawDescription: string): Promise<StructuredIdea | null> {
  if (!ANTHROPIC_API_KEY || !rawDescription) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'Eres un extractor de datos. Tu Ãºnica tarea es estructurar una idea de negocio en JSON. Responde SOLO con JSON vÃ¡lido, sin texto adicional.',
        messages: [{
          role: 'user',
          content: `Extrae y estructura esta idea de negocio:\n\n${rawDescription}\n\nResponde en este formato JSON exacto:\n{"problem":"...","solution":"...","targetAudience":"...","market":"...","revenueModel":"...","stage":"idea|validating|mvp|launched","geography":"..."}`,
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    return JSON.parse(extractJSON(text)) as StructuredIdea;
  } catch {
    return null;
  }
}

// â”€â”€ Providers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ── Defensa Nivel 1: ruteo de modelo + throttle dinámico de costo ─────────────
// Centraliza la selección de modelo (antes inline en callAnthropic). Permite un
// downgrade dinámico ante picos de burn rate SIN redeploy: Ops setea
// THROTTLE_MODE=on y los prompts estándar no-premium caen a Haiku.
// Default 'off' → comportamiento IDÉNTICO a producción actual (switch inerte).
// Sonnet queda reservado al flujo premium (premium-validate, función aparte) y a
// los prompts con web_search (bajo volumen, calidad de búsqueda crítica).
const MODEL_SONNET = 'claude-sonnet-4-20250514';
const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const THROTTLE_MODE = (Deno.env.get('THROTTLE_MODE') ?? 'off') as 'on' | 'off';

export function usesWebSearch(promptType: PromptType): boolean {
  return promptType === 'competitive_analysis'
    || promptType === 'market_sizing'
    || promptType === 'market_signals';
}

export function selectModel(promptType: PromptType, tier?: 'free' | 'basic' | 'pro'): string {
  // Regla base (inmutable): free y summary_quick ya usan Haiku por estrategia de coste.
  if (tier === 'free' || promptType === 'summary_quick') return MODEL_HAIKU;
  // Throttle dinámico: bajo presión de caja, basic/pro estándar → Haiku.
  // Los prompts con web_search se mantienen en Sonnet (bajo volumen, calidad crítica).
  if (THROTTLE_MODE === 'on' && !usesWebSearch(promptType)) return MODEL_HAIKU;
  return MODEL_SONNET;
}

async function callAnthropic(
  promptType: PromptType,
  context: Record<string, unknown>,
  systemOverride?: string,
  tier?: 'free' | 'basic' | 'pro',
): Promise<AIResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no estÃ¡ configurada en los secrets de Supabase.');
  }

  const useWebSearch = usesWebSearch(promptType);
  const selectedModel = selectModel(promptType, tier);

  const body: Record<string, unknown> = {
    model: selectedModel,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: systemOverride ?? SYSTEM_PROMPTS[promptType],
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildUserContent(promptType, context),
      },
    ],
  };

  if (useWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  if (Deno.env.get('DENO_ENV') !== 'production') {
    console.log(`[cache] ${promptType} â€” read: ${data.usage?.cache_read_input_tokens ?? 0}, created: ${data.usage?.cache_creation_input_tokens ?? 0}`);
  }

  const textContent = (data.content as Array<{ type: string; text?: string }>)
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');

  const parsed = JSON.parse(extractJSON(textContent));

  return {
    parsed,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    model: selectedModel,
  };
}

async function callOpenAI(
  promptType: PromptType,
  context: Record<string, unknown>,
  systemOverride?: string,
): Promise<AIResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no estÃ¡ configurada en los secrets de Supabase.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: (() => {
            const p = systemOverride ?? SYSTEM_PROMPTS[promptType];
            return /json/i.test(p) ? p : `${p}\n\nResponde SOLO con JSON vÃ¡lido, sin texto adicional, sin markdown.`;
          })(),
        },
        {
          role: 'user',
          content: buildUserContent(promptType, context),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(extractJSON(text));

  return {
    parsed,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    model: 'gpt-4o-mini',
  };
}

/**
 * Routing principal:
 * - competitive_analysis y market_sizing â†’ siempre Anthropic (web_search)
 * - Resto â†’ segÃºn AI_PROVIDER, con fallback automÃ¡tico si falta la key
 */
export async function callAI(
  promptType: PromptType,
  context: Record<string, unknown>,
  systemOverride?: string,
  tier?: 'free' | 'basic' | 'pro',
): Promise<AIResult> {
  // Prompts que idealmente usan web_search (solo Anthropic), pero si no hay crÃ©ditos caen a OpenAI
  const requiresAnthropic = usesWebSearch(promptType);

  if (requiresAnthropic && ANTHROPIC_API_KEY) {
    try {
      return await callAnthropic(promptType, context, systemOverride, tier);
    } catch (err) {
      console.warn(`[callAI] Anthropic failed for ${promptType}, falling back to OpenAI:`, err);
    }
  }

  // Para el resto, usar el provider configurado con fallback
  if (AI_PROVIDER === 'openai') {
    if (OPENAI_API_KEY) return callOpenAI(promptType, context, systemOverride);
    console.warn('AI_PROVIDER=openai pero no hay OPENAI_API_KEY. Usando Anthropic como fallback.');
    return callAnthropic(promptType, context, systemOverride, tier);
  }

  // Default: Anthropic
  if (ANTHROPIC_API_KEY) return callAnthropic(promptType, context, systemOverride, tier);
  // Ãšltimo fallback: intentar OpenAI si hay key
  if (OPENAI_API_KEY) {
    console.warn('No hay ANTHROPIC_API_KEY. Usando OpenAI como fallback.');
    return callOpenAI(promptType, context, systemOverride);
  }

  throw new Error('No hay ningÃºn AI provider configurado. Agrega ANTHROPIC_API_KEY o OPENAI_API_KEY a los secrets de Supabase.');
}

// ── CAC multipliers by acquisition channel ────────────────────────────────────
// Source: internal analysis + HubSpot State of Marketing 2024, OpenView PLG 2024.
// multiplier_vs_benchmark: factor applied on top of the sector CAC baseline.

// â”€â”€ Handler HTTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ Prompt type whitelist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
