// Edge Function: send-quick-lead
// Captura el email de un usuario que abandona el flujo Rápido (exit-intent).
// Inserta el lead en email_leads y envía un email transaccional via Resend
// con el score parcial y un enlace directo al reporte.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const APP_URL      = Deno.env.get('APP_URL') ?? 'https://validus.scouttech.lat';
// Remitente sobre scouttech.lat (dominio ya controlado) mientras validateai.cl
// no esté comprado/verificado. Override por env FROM_EMAIL si se quiere cambiar
// sin redeploy. Verificar este dominio en Resend (SPF/DKIM/DMARC) para salir de spam.
const FROM_EMAIL   = Deno.env.get('FROM_EMAIL') ?? 'Validus <hola@scouttech.lat>';

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function buildEmailHtml(params: {
  ideaName: string;
  score: number | null;
  resultsUrl: string | null;
}): string {
  const { ideaName, score, resultsUrl } = params;
  const scoreDisplay = score !== null ? `${score}/50` : '—';
  const scoreColor = score === null ? '#6b7280'
    : score >= 35 ? '#10b981'
    : score >= 20 ? '#f59e0b'
    : '#ef4444';

  const ctaBlock = resultsUrl
    ? `<a href="${resultsUrl}"
         style="display:inline-block;margin-top:20px;padding:14px 28px;background:#7C6FF7;color:#fff;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">
        Ver mi análisis y desbloquear score real →
       </a>`
    : `<a href="${APP_URL}/validate"
         style="display:inline-block;margin-top:20px;padding:14px 28px;background:#7C6FF7;color:#fff;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">
        Retomar análisis →
       </a>`;

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F3FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7C6FF7,#A78BFA);padding:28px 32px">
      <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:1px">ValidateAI</p>
      <h1 style="margin:8px 0 0;font-size:22px;color:#fff;font-weight:800">Tu análisis rápido está listo</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
        Evaluamos <strong>${ideaName}</strong> con criterios de Venture Capital.<br>
        Aquí está tu resultado inicial:
      </p>

      <!-- Score -->
      <div style="background:#F9F8FF;border:2px solid #E8E5FF;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Score Rápido (Problema + Solución)</p>
        <p style="margin:0;font-size:48px;font-weight:900;color:${scoreColor};line-height:1">${scoreDisplay}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">Mercado, Competencia y Ejecución requieren más datos</p>
      </div>

      <!-- Message -->
      <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6">
        Tu score global está <strong>incompleto</strong> porque el flujo rápido solo evalúa 2 de las 5 dimensiones VC.
        Las 3 restantes (que pesan un 50%) necesitan más contexto.
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6">
        Completa el análisis Detallado en 5 minutos para desbloquear tu score real.
      </p>

      ${ctaBlock}
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #f3f4f6;background:#fafafa">
      <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5">
        ValidateAI · Este email fue solicitado desde el flujo de análisis rápido.
        <a href="${APP_URL}/profile" style="color:#7C6FF7;text-decoration:none">Gestionar preferencias</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  try {
    const body = await req.json() as { email?: string; validation_id?: string };
    const email = (body.email ?? '').trim();
    const validationId = body.validation_id ?? null;

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Email inválido' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SRK);

    // Obtener score e idea_name si hay validation_id
    let score: number | null = null;
    let ideaName = 'tu idea';
    let resultsUrl: string | null = null;

    if (validationId) {
      const { data: validation } = await supabase
        .from('validations')
        .select('validation_score, idea_name, status')
        .eq('id', validationId)
        .single();

      if (validation) {
        score = validation.validation_score;
        ideaName = validation.idea_name ?? 'tu idea';
        if (validation.status === 'completed') {
          resultsUrl = `${APP_URL}/results/${validationId}`;
        }
      }
    }

    // Guardar lead
    await supabase.from('email_leads').insert({
      email,
      validation_id: validationId,
      validation_score: score,
    });

    // Enviar email si Resend está configurado
    if (RESEND_KEY) {
      const subject = score !== null
        ? `Tu Score Rápido: ${score}/50 — ${ideaName}`
        : `Tu análisis de ${ideaName} te espera`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          subject,
          html: buildEmailHtml({ ideaName, score, resultsUrl }),
        }),
      });
    } else {
      console.log(`[send-quick-lead] DRY RUN — to: ${email}, score: ${score}, id: ${validationId}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[send-quick-lead] error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
