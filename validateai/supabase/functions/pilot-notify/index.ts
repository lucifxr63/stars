// Edge Function: pilot-notify
// Notifica al equipo Scouttech cuando un founder crea una solicitud de piloto.
//
// Seguridad:
//   - Requiere JWT (usuario autenticado); 401 sin sesión válida.
//   - Verifica que el `pilot_id` pertenece al usuario autenticado (403 si no).
//   - Lee la fila con SERVICE_ROLE porque el founder NO tiene SELECT sobre `pilots`
//     (RLS: solo admin lee). El uso de service_role se limita a leer esa fila por id.
//   - El email va SOLO al equipo interno (PILOT_NOTIFY_TO). Nunca incluye `admin_notes`.
//   - Sin RESEND_API_KEY → DRY RUN (no envía; loguea solo metadata segura).
//   - No confía en el email del cliente: lee todo desde la DB por `pilot_id`.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
  'https://validateai.cl',
  'https://www.validateai.cl',
  'http://localhost:5173',
  'http://localhost:4173',
];

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Validus <hola@scouttech.lat>';
const NOTIFY_TO  = Deno.env.get('PILOT_NOTIFY_TO') ?? 'contacto@scouttech.lat';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://validus.scouttech.lat';
const OBJECTIVE_MAX = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  };
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

interface PilotRow {
  user_id: string;
  email: string;
  segment: string;
  stage: string | null;
  plan_interes: string | null;
  source: string;
  objective: string | null;
  created_at: string;
}

function buildEmail(p: PilotRow): { subject: string; text: string } {
  const objective = p.objective?.trim()
    ? p.objective.trim().slice(0, OBJECTIVE_MAX) + (p.objective.trim().length > OBJECTIVE_MAX ? '…' : '')
    : '—';
  const subject = 'Nueva solicitud de piloto — Validus';
  const text =
    `Nueva solicitud de piloto recibida.\n\n` +
    `Founder: ${p.email}\n` +
    `Segmento: ${p.segment}\n` +
    `Etapa: ${p.stage ?? '—'}\n` +
    `Plan de interés: ${p.plan_interes ?? '—'}\n` +
    `Fuente: ${p.source}\n` +
    `Fecha: ${new Date(p.created_at).toISOString()}\n\n` +
    `Objetivo:\n${objective}\n\n` +
    `Revisar y gestionar en ${APP_URL}/admin → Pilotos.`;
  return { subject, text };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors);

  try {
    // 1. Auth obligatoria.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401, cors);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Invalid session' }, 401, cors);

    // 2. Body.
    const body = await req.json().catch(() => ({}));
    const pilotId = typeof body?.pilot_id === 'string' ? body.pilot_id : '';
    if (!UUID_RE.test(pilotId)) return jsonResponse({ error: 'pilot_id inválido' }, 400, cors);

    // 3. Leer la fila con service_role (el founder no tiene SELECT sobre pilots).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: pilot, error: readErr } = await admin
      .from('pilots')
      .select('user_id, email, segment, stage, plan_interes, source, objective, created_at')
      .eq('id', pilotId)
      .maybeSingle<PilotRow>();

    if (readErr) return jsonResponse({ error: 'read_failed' }, 500, cors);
    if (!pilot) return jsonResponse({ error: 'not_found' }, 404, cors);

    // 4. Ownership: solo el dueño puede disparar la notificación de su solicitud.
    if (pilot.user_id !== user.id) return jsonResponse({ error: 'forbidden' }, 403, cors);

    // 5. DRY RUN sin RESEND_API_KEY: loguear solo metadata segura (nunca email/objective).
    if (!RESEND_KEY) {
      console.log(`[pilot-notify] DRY RUN — pilot=${pilotId} segment=${pilot.segment} stage=${pilot.stage ?? '-'} plan=${pilot.plan_interes ?? '-'} source=${pilot.source}`);
      return jsonResponse({ ok: true, dry_run: true }, 200, cors);
    }

    // 6. Enviar email SOLO al equipo interno. Nunca admin_notes.
    const { subject, text } = buildEmail(pilot);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: [NOTIFY_TO], subject, text }),
    });

    if (!res.ok) {
      console.error(`[pilot-notify] Resend error status=${res.status} pilot=${pilotId}`);
      return jsonResponse({ ok: false, error: 'email_failed' }, 502, cors);
    }

    return jsonResponse({ ok: true, dry_run: false }, 200, cors);

  } catch (err) {
    console.error('[pilot-notify] Unexpected error:', err instanceof Error ? err.message : 'unknown');
    return jsonResponse({ error: 'Internal server error' }, 500, cors);
  }
});
