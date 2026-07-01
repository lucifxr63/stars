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

type Task = { id: string; type: string; status: string; attempts: number; last_error?: string };

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

// EdgeRuntime.waitUntil mantiene viva la instancia para terminar el trabajo en
// background tras devolver la respuesta (Supabase Edge). Declarado por si el tipo
// no está en el ambiente; con fallback a ejecución fire-and-forget local.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

interface JobRow {
  id: string;
  validation_id: string;
  tasks: Task[];
  context: Record<string, unknown>;
}

// El cliente Deno no tiene los tipos del schema (Database), así que .update()/.rpc()
// se infieren como 'never'. Se afloja a un tipo laxo, consistente con las demás Edge.
// deno-lint-ignore no-explicit-any
type SupaClient = any;

// Ejecuta el job server-side usando el JWT FRESCO del usuario (no service-role):
// así ai-validate/premium-validate conservan rate-limit y scoping por usuario sin
// que tengamos que tocarlas ni guardar tokens. Tab-independiente vía waitUntil.
async function runJob(job: JobRow, userToken: string, supabase: SupaClient): Promise<void> {
  const now = () => new Date().toISOString();
  await supabase.from('generation_jobs').update({ status: 'running', updated_at: now() }).eq('id', job.id);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // Fase 16 (11D): 1 reintento por-task en fallos TRANSITORIOS (red / 5xx) con
  // backoff corto. NO se reintenta en 4xx/429 (rate-limit o error de cliente) para
  // no quemar tokens ni golpear la cuota — esos se marcan error de inmediato.
  const MAX_ATTEMPTS = 2;

  const tasks = job.tasks;
  for (const task of tasks) {
    if (task.status === 'success') continue;
    const endpoint = task.type === 'premium_validate' ? 'premium-validate' : 'ai-validate';
    const body = task.type === 'premium_validate'
      ? { validation_id: job.validation_id, idea_description: job.context.idea_description ?? job.context.idea_name }
      : { validation_id: job.validation_id, step: 4, prompt_type: task.type, context: job.context };

    let ok = false;
    let lastErr = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      task.attempts = attempt;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
          body: JSON.stringify(body),
        });
        // 4xx (incl. 429): error de cliente / cuota → no reintentar.
        if (res.status >= 400 && res.status < 500) { lastErr = `${endpoint}_${res.status}`; break; }
        if (!res.ok) throw new Error(`${endpoint}_${res.status}`); // 5xx → transitorio
        await res.json();
        ok = true;
        break;
      } catch (e) {
        lastErr = String(e);
        if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt); // backoff lineal
      }
    }

    if (ok) {
      task.status = 'success';
      await supabase.rpc('merge_generation_progress', { p_id: job.validation_id, p_key: task.id, p_status: 'success' });
    } else {
      task.status = 'error';
      task.last_error = lastErr;
      await supabase.rpc('merge_generation_progress', { p_id: job.validation_id, p_key: task.id, p_status: 'error' });
    }
    await supabase.from('generation_jobs').update({ tasks, updated_at: now() }).eq('id', job.id);
  }

  // Finalizar: estado honesto del job y de la validación (consistente con 11B).
  const okCount = tasks.filter((t) => t.status === 'success').length;
  const jobStatus = okCount === tasks.length ? 'done' : okCount === 0 ? 'failed' : 'partial';
  const valStatus = okCount === tasks.length ? 'completed' : okCount === 0 ? 'failed' : 'partial';
  await supabase.from('generation_jobs').update({ status: jobStatus, updated_at: now() }).eq('id', job.id);
  await supabase.from('validations').update({ status: valStatus }).eq('id', job.validation_id);
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

    // Ejecuta el job server-side con el JWT FRESCO del usuario, tab-independiente.
    // waitUntil mantiene viva la instancia tras devolver la respuesta.
    const userToken = authHeader.replace('Bearer ', '');
    const jobRow: JobRow = { id: job.id, validation_id: validationId, tasks, context: body.context ?? {} };
    const work = runJob(jobRow, userToken, supabase);
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) EdgeRuntime.waitUntil(work);
    else void work;

    return json({ job_id: job.id, status: 'running', reused: false }, 200, cors);
  } catch (err) {
    console.error('[enqueue-generation] error:', err);
    return json({ error: 'Error interno' }, 500, cors);
  }
});
