import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchReddit } from './reddit.ts';
import { fetchTrends } from './trends.ts';
import { synthesize, type ValidationContext } from './synthesis.ts';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}


// â”€â”€ Main handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  // Auth â€” verifica JWT del usuario
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401, req);

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401, req);

  // Verificar que el usuario sea premium
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  if (!profile || !['pro', 'premium'].includes(profile.tier)) {
    return json({ error: 'Pro tier required' }, 403, req);
  }

  // Body
  let body: { validation_id: string; idea_description: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req);
  }

  const { validation_id, idea_description } = body;
  if (!validation_id || !idea_description) {
    return json({ error: 'validation_id and idea_description are required' }, 400, req);
  }

  // Obtener el contexto completo de la validación para la síntesis enriquecida
  const { data: validation } = await supabase
    .from('validations')
    .select('id, user_id, idea_name, idea_description, idea_problem, current_solution, customer_segment, target_country, business_model, traction_status, team_composition')
    .eq('id', validation_id)
    .eq('user_id', user.id)
    .single();

  if (!validation) return json({ error: 'Validation not found' }, 404, req);

  const validationCtx: ValidationContext = {
    idea_name:        validation.idea_name,
    idea_description: validation.idea_description ?? idea_description,
    idea_problem:     validation.idea_problem,
    current_solution: validation.current_solution,
    customer_segment: validation.customer_segment,
    target_country:   validation.target_country,
    business_model:   validation.business_model,
    traction_status:  validation.traction_status,
    team_composition: validation.team_composition,
  };

  // Crear log inicial en estado 'pending'
  const { data: logRow, error: logInsertError } = await supabase
    .from('validation_agents_log')
    .insert({
      validation_id,
      user_id: user.id,
      reddit_status: 'pending',
      trends_status: 'pending',
    })
    .select('id')
    .single();

  if (logInsertError || !logRow) {
    return json({ error: 'Failed to create agent log' }, 500, req);
  }

  const logId = logRow.id;

  // â”€â”€ Fan-Out: dispara ambos agentes en paralelo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [redditResult, trendsResult] = await Promise.allSettled([
    fetchReddit(idea_description),
    fetchTrends(idea_description),
  ]);

  const redditData   = redditResult.status  === 'fulfilled' ? redditResult.value  : null;
  const trendsData   = trendsResult.status  === 'fulfilled' ? trendsResult.value  : null;
  const redditStatus = redditResult.status  === 'fulfilled' ? 'success' : 'error';
  const trendsStatus = trendsResult.status  === 'fulfilled' ? 'success' : 'error';

  const errorDetails: Record<string, string> = {};
  if (redditResult.status === 'rejected') errorDetails.reddit = String(redditResult.reason);
  if (trendsResult.status === 'rejected') errorDetails.trends = String(trendsResult.reason);

  // Actualizar log con resultados crudos de agentes
  await supabase
    .from('validation_agents_log')
    .update({
      reddit_data: redditData,
      trends_data: trendsData,
      reddit_status: redditStatus,
      trends_status: trendsStatus,
      agents_completed_at: new Date().toISOString(),
      error_details: Object.keys(errorDetails).length ? errorDetails : null,
    })
    .eq('id', logId);

  // â”€â”€ Sintetizador IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let executiveSummary: string | null = null;
  try {
    executiveSummary = await synthesize(validationCtx, redditData, trendsData);
  } catch (err) {
    // El reporte se genera igualmente, sin resumen ejecutivo
    errorDetails.synthesis = String(err);
    console.error('[premium-validate] Synthesis failed:', err);
  }

  // Guardar resumen y marcar validación como completada
  await supabase
    .from('validation_agents_log')
    .update({
      executive_summary: executiveSummary,
      synthesis_completed_at: executiveSummary ? new Date().toISOString() : null,
      error_details: Object.keys(errorDetails).length ? errorDetails : null,
    })
    .eq('id', logId);

  // Fix: validation_mode permanece 'premium' — no sobreescribir con 'quick'
  await supabase
    .from('validations')
    .update({ status: 'completed' })
    .eq('id', validation_id);

  return json({
    log_id: logId,
    reddit_status: redditStatus,
    trends_status: trendsStatus,
    executive_summary: executiveSummary,
    agents: {
      reddit: redditData,
      trends: trendsData,
    },
    errors: Object.keys(errorDetails).length ? errorDetails : null,
  }, 200, req);
});
