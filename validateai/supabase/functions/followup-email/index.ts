import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL            = Deno.env.get('APP_URL') ?? 'https://validateai-mu.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FollowUpRow {
  id: string;
  user_id: string;
  validation_id: string;
  idea_name: string | null;
  validation_score: number | null;
  user_email: string;
  user_name: string | null;
  sent_at: string | null;
}

function buildEmailHtml(row: FollowUpRow): string {
  const score = row.validation_score ?? 0;
  const scoreColor = score >= 70 ? '#14b8a6' : score >= 50 ? '#f59e0b' : '#ef4444';
  const idea = row.idea_name ?? 'tu idea';
  const detailUrl = `${APP_URL}/results/${row.validation_id}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>¿Cómo va ${idea}?</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:24px;border:1px solid #e5e7eb;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:28px 32px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:32px;height:32px;background:#14b8a6;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
                  <span style="color:white;font-weight:900;font-size:14px;">✓</span>
                </div>
                <span style="color:white;font-weight:700;font-size:16px;margin-left:10px;">ValidateAI</span>
              </div>
            </td>
          </tr>

          <!-- Score badge -->
          <tr>
            <td style="padding:32px 32px 0;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:72px;height:72px;border-radius:50%;background:${scoreColor};color:white;font-size:26px;font-weight:900;line-height:72px;text-align:center;">${score}</div>
                <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">puntos de validación</p>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 32px 32px;">
              <h1 style="font-size:20px;font-weight:900;color:#111827;margin:0 0 12px;">
                Han pasado 7 días desde que validaste ${idea}
              </h1>
              <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
                ¿Tomaste alguna acción con los insights del análisis? Ya sea que hayas avanzado, pivotado o pausado el proyecto, es un buen momento para reflexionar.
              </p>

              <p style="font-size:14px;color:#374151;font-weight:600;margin:0 0 12px;">Algunos recursos que podrían ayudarte ahora:</p>
              <ul style="font-size:14px;color:#6b7280;line-height:2;margin:0 0 24px;padding-left:20px;">
                <li>Kit de validación de 48 horas (en tu reporte)</li>
                <li>Guión de entrevistas con clientes potenciales</li>
                <li>Fondos CORFO aplicables a tu etapa</li>
              </ul>

              <div style="text-align:center;">
                <a href="${detailUrl}"
                   style="display:inline-block;background:#14b8a6;color:white;font-weight:700;font-size:15px;
                          padding:14px 32px;border-radius:14px;text-decoration:none;">
                  Ver mi reporte completo →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #f3f4f6;">
              <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">
                ValidateAI · Santiago, Chile ·
                <a href="${APP_URL}" style="color:#9ca3af;">validateai.cl</a>
              </p>
              <p style="font-size:11px;color:#d1d5db;margin:6px 0 0;text-align:center;">
                Recibiste este email porque validaste una idea en ValidateAI hace 7 días.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find completed validations from 7 days ago (±12h window) that haven't received follow-up
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const windowStart  = new Date(sevenDaysAgo.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const windowEnd    = new Date(sevenDaysAgo.getTime() + 12 * 60 * 60 * 1000).toISOString();

    const { data: validations, error: fetchError } = await supabase
      .from('validations')
      .select(`
        id,
        user_id,
        idea_name,
        validation_score,
        completed_at,
        profiles!inner(email, full_name)
      `)
      .eq('status', 'completed')
      .gte('completed_at', windowStart)
      .lte('completed_at', windowEnd);

    if (fetchError) throw fetchError;
    if (!validations || validations.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No validations in window' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check which ones already got a follow-up email
    const validationIds = validations.map((v) => v.id);
    const { data: alreadySent } = await supabase
      .from('email_logs')
      .select('validation_id')
      .eq('email_type', 'followup_7d')
      .in('validation_id', validationIds);

    const sentIds = new Set((alreadySent ?? []).map((r: { validation_id: string }) => r.validation_id));
    const toSend = validations.filter((v) => !sentIds.has(v.id));

    let sentCount = 0;
    for (const v of toSend) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = (v as any).profiles;
      const userEmail = profile?.email;
      if (!userEmail) continue;

      const row: FollowUpRow = {
        id:               v.id,
        user_id:          v.user_id,
        validation_id:    v.id,
        idea_name:        v.idea_name,
        validation_score: v.validation_score,
        user_email:       userEmail,
        user_name:        profile?.full_name ?? null,
        sent_at:          null,
      };

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'ValidateAI <noreply@validateai.cl>',
          to:      [userEmail],
          subject: `¿Cómo va ${row.idea_name ?? 'tu idea'}? — Seguimiento ValidateAI`,
          html:    buildEmailHtml(row),
        }),
      });

      if (res.ok) {
        sentCount++;
        // Log the sent email
        await supabase.from('email_logs').insert({
          user_id:       v.user_id,
          validation_id: v.id,
          email_type:    'followup_7d',
          sent_at:       new Date().toISOString(),
        });
      } else {
        const body = await res.text();
        console.error(`[followup-email] Failed for ${v.id}: ${body}`);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, eligible: toSend.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[followup-email] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
