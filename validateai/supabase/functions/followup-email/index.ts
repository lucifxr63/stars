// Edge Function: followup-email
// Cron recomendado: "0 10 * * *" (diariamente a las 10:00 UTC)
//
// Selecciona usuarios en tier free que completaron su primera validaciÃ³n hace
// exactamente 7 dÃ­as y aÃºn no han hecho upgrade.
// Cuando RESEND_API_KEY estÃ© configurado, envÃ­a el email real; si no, solo loguea.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL   = 'ValidateAI <hola@validateai.cl>';

interface EligibleUser {
  user_id: string;
  email: string;
  idea_name: string | null;
  validation_score: number | null;
  completed_at: string;
}

async function sendFollowupEmail(user: EligibleUser): Promise<boolean> {
  if (!RESEND_KEY) {
    console.log(`[followup-email] DRY RUN â€” would send to ${user.email} (idea: "${user.idea_name}")`);
    return true;
  }

  const score = user.validation_score ?? 0;
  const ideaName = user.idea_name ?? 'tu idea';

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
      <h2 style="color:#7C6FF7">Â¿CÃ³mo va ${ideaName}?</h2>
      <p>Hace 7 dÃ­as validaste tu idea y obtuviste un score de <strong>${score}/100</strong>.</p>
      <p>Con el plan Basic puedes desbloquear:</p>
      <ul>
        <li>AnÃ¡lisis de Riesgo detallado</li>
        <li>Unit Economics (CAC/LTV)</li>
        <li>ExportaciÃ³n PDF investor-ready</li>
      </ul>
      <a href="https://validus.scouttech.lat/pricing"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#7C6FF7;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">
        Ver planes â†’
      </a>
      <p style="color:#999;font-size:12px;margin-top:32px">
        ValidateAI Â· <a href="https://validus.scouttech.lat/profile">Gestionar preferencias</a>
      </p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [user.email],
      subject: `Â¿CÃ³mo va ${ideaName}? Tu anÃ¡lisis de ValidateAI`,
      html,
    }),
  });

  if (!res.ok) {
    console.error(`[followup-email] Resend error for ${user.email}:`, res.status, await res.text());
    return false;
  }
  return true;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SRK);

  const now = new Date();
  // Ventana: validaciones completadas entre 7d 1h y 6d 23h atrÃ¡s (Â±1h para cubrir desfases de cron)
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000).toISOString();
  const windowEnd   = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000).toISOString();

  // Obtener usuarios free que completaron su primera validaciÃ³n en la ventana
  const { data: candidates, error } = await supabase
    .from('validations')
    .select(`
      user_id,
      idea_name,
      validation_score,
      completed_at,
      profiles!inner(tier, full_name),
      auth_users:user_id(email)
    `)
    .eq('status', 'completed')
    .eq('profiles.tier', 'free')
    .gte('completed_at', windowStart)
    .lte('completed_at', windowEnd)
    .limit(100);

  if (error) {
    console.error('[followup-email] Query error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    console.log('[followup-email] No eligible users today');
    return new Response(JSON.stringify({ sent: 0, dry_run: !RESEND_KEY }), { status: 200 });
  }

  // Obtener emails de auth.users (service_role puede leerlos)
  const userIds = [...new Set(candidates.map((c) => c.user_id))];
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  const emailMap = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, u.email ?? ''])
  );

  let sent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const email = emailMap.get(candidate.user_id);
    if (!email) { failed++; continue; }

    const ok = await sendFollowupEmail({
      user_id: candidate.user_id,
      email,
      idea_name: candidate.idea_name,
      validation_score: candidate.validation_score,
      completed_at: candidate.completed_at,
    });
    if (ok) sent++; else failed++;
  }

  console.log(`[followup-email] sent=${sent} failed=${failed} dry_run=${!RESEND_KEY}`);
  return new Response(
    JSON.stringify({ sent, failed, total: candidates.length, dry_run: !RESEND_KEY }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
