// Edge Function: process-generation-jobs  (Fase 15 / 11C-b — cron janitor)
// Red de seguridad del async por waitUntil: cuando la instancia que ejecutaba un
// job muere (reciclaje del runtime, crash de enqueue antes de terminar), el job
// queda 'running'/'queued' sin avanzar. Este worker, invocado por pg_cron con el
// service_role key, FINALIZA los jobs colgados de forma honesta (partial/failed)
// y sincroniza validations.status. NO re-ejecuta tasks: no tiene el JWT del
// usuario y ai-validate/premium-validate lo exigen (rate-limit + scoping). El
// usuario reintenta desde la UI (botón Reintentar del widget).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Un job que lleva más de esto sin actualizar 'updated_at' se considera colgado.
const STUCK_MS = 5 * 60 * 1000;

type Task = { id: string; type: string; status: string };

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Guard: solo el service_role key (que trae pg_cron) puede invocar.
  const auth = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (auth !== SUPABASE_SRK) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SRK);
  const cutoff = new Date(Date.now() - STUCK_MS).toISOString();

  const { data: stuck, error } = await supabase
    .from('generation_jobs')
    .select('id, validation_id, tasks, status')
    .in('status', ['queued', 'running'])
    .lt('updated_at', cutoff);

  if (error) {
    console.error('[process-generation-jobs] query error:', error);
    return new Response(JSON.stringify({ error: 'query_failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let finalized = 0;
  for (const job of stuck ?? []) {
    const tasks = (job.tasks ?? []) as Task[];
    const okCount = tasks.filter((t) => t.status === 'success').length;
    // Sin tasks OK → failed; con algunas → partial. (done nunca cuelga aquí.)
    const jobStatus = okCount === 0 ? 'failed' : 'partial';
    const valStatus = okCount === 0 ? 'failed' : 'partial';
    const now = new Date().toISOString();
    await supabase.from('generation_jobs')
      .update({ status: jobStatus, last_error: 'janitor: stuck timeout', updated_at: now })
      .eq('id', job.id);
    await supabase.from('validations')
      .update({ status: valStatus })
      .eq('id', job.validation_id);
    finalized++;
  }

  return new Response(JSON.stringify({ finalized }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
