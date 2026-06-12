import { supabase } from '@/lib/supabase';
import { trackValidationCompleted } from '@/hooks/useAnalytics';
import type { UserTier } from '@/hooks/useUserTier';

// ── Servicio de generación en background (híbrido) ────────────────────────────
// Encapsula la orquestación de los flujos NO-premium (quick / detailed) para que
// puedan dispararse y continuar ejecutándose aunque el componente del wizard se
// desmonte tras el redirect al Dashboard. El backend ya persiste el avance
// (validations.generation_progress vía RPC merge_generation_progress + status),
// así que el progreso sobrevive recargas y lo lee el GenerationStatusWidget.
//
// Premium NO pasa por aquí: mantiene su terminal en vivo (Labor Illusion) en
// StepGenerating para justificar el ticket price.

type NonPremiumMode = 'quick' | 'detailed';

interface GenTask {
  id: string;
  type: string;
}

// Mismo chunking por tier que la UI del wizard. Centralizado aquí para los jobs
// en background; la única fuente de verdad del flujo no-premium.
const TASK_DEFS: Record<string, GenTask[]> = {
  free: [{ id: 'summary', type: 'summary' }],
  basic: [
    { id: 'summary', type: 'summary' },
    { id: 'competitors', type: 'competitive_analysis' },
  ],
  pro: [
    { id: 'summary', type: 'summary' },
    { id: 'market', type: 'market_sizing' },
    { id: 'competitors', type: 'competitive_analysis' },
  ],
  premium: [
    { id: 'summary', type: 'summary' },
    { id: 'market', type: 'market_sizing' },
    { id: 'competitors', type: 'competitive_analysis' },
  ],
};

function tasksFor(tier: UserTier, mode: NonPremiumMode): GenTask[] {
  if (mode === 'quick') return [{ id: 'summary', type: 'summary_quick' }];
  return TASK_DEFS[tier] ?? TASK_DEFS.free;
}

export interface StartGenerationArgs {
  tier: UserTier;
  mode: NonPremiumMode;
  validationId: string | null;
  context: Record<string, unknown>;
}

export interface StartedJob {
  validationId: string;
  /** 'started' = job corriendo en background · 'completed' = no había tasks pendientes. */
  status: 'started' | 'completed';
}

/**
 * Crea/actualiza la fila de validación (status in_progress, step 4), determina
 * los tasks pendientes (reanuda si ya había progreso) y dispara los llamados a
 * ai-validate en background SIN await. Devuelve apenas la fila existe, para que
 * el caller pueda redirigir de inmediato al Dashboard.
 */
export async function startBackgroundGeneration(args: StartGenerationArgs): Promise<StartedJob> {
  const { tier, mode, context } = args;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  // 1. Crear o actualizar la fila → in_progress, current_step 4 (señal para el widget).
  let currentId = args.validationId;
  if (!currentId) {
    const { data, error } = await supabase
      .from('validations')
      .insert({
        user_id: session.user.id,
        status: 'in_progress',
        current_step: 4,
        validation_mode: mode,
        ...context,
      })
      .select('id')
      .single();
    if (error || !data?.id) throw error ?? new Error('No id returned');
    currentId = data.id as string;
  } else {
    await supabase
      .from('validations')
      .update({ ...context, validation_mode: mode, current_step: 4 })
      .eq('id', currentId);
  }

  // 2. Reanudar: no re-correr tasks ya exitosos.
  const { data: existing } = await supabase
    .from('validations')
    .select('generation_progress')
    .eq('id', currentId)
    .single();
  const prevProgress = (existing?.generation_progress ?? {}) as Record<string, string>;

  const tierTasks = tasksFor(tier, mode);
  const pendingTasks = tierTasks.filter((t) => prevProgress[t.id] !== 'success');

  // 3. Sin pendientes → marcar completada y avisar al caller.
  if (pendingTasks.length === 0) {
    await supabase.from('validations').update({ status: 'completed' }).eq('id', currentId);
    return { validationId: currentId, status: 'completed' };
  }

  // 4. Disparar el runner en background (fire-and-forget — NO await).
  void runTasksInBackground(currentId, pendingTasks, context, session.access_token, tier);

  return { validationId: currentId, status: 'started' };
}

async function runTasksInBackground(
  validationId: string,
  pending: GenTask[],
  context: Record<string, unknown>,
  accessToken: string,
  tier: UserTier,
): Promise<void> {
  await Promise.allSettled(
    pending.map(async (task) => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ validation_id: validationId, step: 4, prompt_type: task.type, context }),
        });
        if (!res.ok) throw new Error('Failed');
        await res.json();
        await supabase.rpc('merge_generation_progress', {
          p_id: validationId, p_key: task.id, p_status: 'success',
        });
      } catch {
        await supabase.rpc('merge_generation_progress', {
          p_id: validationId, p_key: task.id, p_status: 'error',
        });
      }
    }),
  );

  await supabase.from('validations').update({ status: 'completed' }).eq('id', validationId);

  // KPI: completada (score 0 — el real se calcula/persiste server-side).
  trackValidationCompleted(validationId, 0, (context.idea_industry as string) ?? '', tier);
}
