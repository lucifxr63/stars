// Edge Function: enqueue-generation
// Fase 15 (11C-a): encola un job de generación en generation_jobs y devuelve su id.
// NO ejecuta los prompts — eso lo hace el worker process-generation-jobs (cron).
// Valida el JWT del usuario, verifica que la validación le pertenece, materializa
// la lista de tasks según modo/tier e inserta el job (idempotente: si ya hay un job
// activo para esa validación, lo devuelve en vez de duplicar).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Task = { id: string; type: string; status: 'pending'; attempts: number };

// Espejo de TASK_DEFS en src/lib/generationService.ts — mantener en sync.
const TASK_DEFS: Record<string, { id: string; type: string }[]> = {
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

function buildTasks(mode: string, tier: string, isPremium: boolean): Task[] {
  let defs: { id: string; type: string }[];
  if (isPremium || mode === 'premium') {
    // Premium = una task que el worker resuelve llamando a premium-validate.
    defs = [{ id: 'premium', type: 'premium_validate' }];
  } else if (mode === 'quick') {
    defs = [{ id: 'summary', type: 'summary_quick' }];
  } else {
    defs = TASK_DEFS[tier] ?? TASK_DEFS.free;
  }
  return defs.map((d) => ({ id: d.id, type: d.type, status: 'pending', attempts: 0 }));
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401, cors);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SRK);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) return json({ error: 'Unauthorized' }, 401, cors);

    const body = await req.json() as {
      validation_id?: string;
      tier?: string;
      mode?: string;
      is_premium?: boolean;
      context?: Record<string, unknown>;
    };

    const validationId = body.validation_id;
    if (!validationId) return json({ error: 'validation_id requerido' }, 400, cors);

    // Verificar propiedad de la validación.
    const { data: validation, error: vErr } = await supabase
      .from('validations')
      .select('id, user_id')
      .eq('id', validationId)
      .single();
    if (vErr || !validation || validation.user_id !== user.id) {
      return json({ error: 'Validación no encontrada' }, 404, cors);
    }

    // Idempotencia: ¿ya hay un job activo para esta validación?
    const { data: existing } = await supabase
      .from('generation_jobs')
      .select('id, status')
      .eq('validation_id', validationId)
      .in('status', ['queued', 'running'])
      .maybeSingle();
    if (existing) {
      return json({ job_id: existing.id, status: existing.status, reused: true }, 200, cors);
    }

    const tier = body.tier ?? 'free';
    const mode = body.mode ?? 'detailed';
    const isPremium = body.is_premium ?? false;
    const tasks = buildTasks(mode, tier, isPremium);

    const { data: job, error: insErr } = await supabase
      .from('generation_jobs')
      .insert({
        validation_id: validationId,
        user_id: user.id,
        tier,
        mode,
        is_premium: isPremium,
        status: 'queued',
        tasks,
        context: body.context ?? {},
      })
      .select('id, status')
      .single();
    if (insErr || !job) {
      // Carrera con el índice único parcial → devolver el job activo existente.
      const { data: raced } = await supabase
        .from('generation_jobs')
        .select('id, status')
        .eq('validation_id', validationId)
        .in('status', ['queued', 'running'])
        .maybeSingle();
      if (raced) return json({ job_id: raced.id, status: raced.status, reused: true }, 200, cors);
      return json({ error: 'No se pudo encolar' }, 500, cors);
    }

    // Señal para el widget: la validación está en proceso.
    await supabase.from('validations').update({ status: 'in_progress', current_step: 4 }).eq('id', validationId);

    return json({ job_id: job.id, status: job.status, reused: false }, 200, cors);
  } catch (err) {
    console.error('[enqueue-generation] error:', err);
    return json({ error: 'Error interno' }, 500, cors);
  }
});
