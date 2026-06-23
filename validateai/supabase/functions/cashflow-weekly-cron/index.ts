// Edge Function: cashflow-weekly-cron (CASHFLOW_PRD_PHASE_2)
// Alertas proactivas: evalúa el riesgo de liquidez de cada tenant con alertas
// activas y envía un resumen por Resend si hay deuda vencida o caja negativa.
//
// ⚠️ DORMANTE: NO está programada en pg_cron. Para activarla (post-lanzamiento),
// ver supabase/functions/cashflow-weekly-cron/ACTIVATE.md. Requiere dominio
// verificado en Resend. Se invoca con el SERVICE_ROLE_KEY (guard interno).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Validus <hola@scouttech.lat>';
const APP_URL = Deno.env.get('CASHFLOW_APP_URL') ?? 'https://cashflow.scouttech.lat';

function fmtCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

async function sendEmail(to: string, overdue: number) {
  if (!RESEND_API_KEY) return { skipped: 'no RESEND_API_KEY' };
  const html = `<h2>Resumen Semanal de tu Caja</h2>
    <p>Tienes <strong>${fmtCLP(overdue)}</strong> en facturas vencidas por cobrar.</p>
    <p>Entra al simulador para planificar tu semana y proteger tu Runway.</p>
    <p><a href="${APP_URL}">Abrir mi Dashboard de Cashflow →</a></p>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: 'Resumen Semanal: tu liquidez necesita atención', html }),
  });
  return { ok: res.ok, status: res.status };
}

Deno.serve(async (req) => {
  // Guard: solo invocable con el service role (pg_cron / interno).
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false }, db: { schema: 'cashflow' } });
  const today = new Date().toISOString().slice(0, 10);

  const { data: tenants, error } = await admin.from('tenant').select('id, owner_id, name').eq('weekly_alerts_enabled', true);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  let evaluated = 0;
  let alerted = 0;
  for (const t of tenants ?? []) {
    evaluated++;
    // Deuda vencida por cobrar (A/R pendientes con vencimiento pasado).
    const { data: overdueInv } = await admin
      .from('invoice')
      .select('total_amount')
      .eq('owner_id', t.owner_id)
      .eq('type', 'AR')
      .eq('status', 'PENDING')
      .lt('due_date', today);
    const overdue = (overdueInv ?? []).reduce((s, i) => s + Number(i.total_amount), 0);

    // ¿Alguna cuenta en negativo?
    const { data: negAcc } = await admin.from('bank_account').select('id').eq('owner_id', t.owner_id).lt('current_balance', 0).limit(1);
    const hasNegative = (negAcc ?? []).length > 0;

    if (overdue > 0 || hasNegative) {
      const { data: u } = await admin.auth.admin.getUserById(t.owner_id);
      const email = u.user?.email;
      if (email) {
        await sendEmail(email, overdue);
        alerted++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, evaluated, alerted }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
