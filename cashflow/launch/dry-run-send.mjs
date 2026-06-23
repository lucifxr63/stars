// Dry-run del correo Silent Beta — envía SOLO a tu correo de dev/PM.
// Verifica renderizado y entregabilidad ANTES del blast real.
//
// Uso:
//   RESEND_API_KEY=re_xxx DEV_EMAIL=tu@correo.com node launch/dry-run-send.mjs
//
// No depende de paquetes: usa fetch nativo (Node 18+). No envía a nadie más.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'silent-beta-email.html'), 'utf8').replaceAll('{{name}}', 'Fundador (dry-run)');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEV_EMAIL = process.env.DEV_EMAIL;
const FROM = process.env.FROM_EMAIL ?? 'Validus <hola@scouttech.lat>';

if (!RESEND_API_KEY || !DEV_EMAIL) {
  console.error('Falta RESEND_API_KEY o DEV_EMAIL en el entorno.');
  process.exit(1);
}

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: FROM,
    to: [DEV_EMAIL], // SOLO el dev — nunca la lista real en un dry-run
    subject: 'Acceso Anticipado: Proyecta el Runway de tu Startup (Beta Exclusiva)',
    html,
  }),
});

const body = await res.json();
if (!res.ok) {
  console.error('Error de envío:', res.status, body);
  process.exit(1);
}
console.log(`OK — dry-run enviado a ${DEV_EMAIL}. id: ${body.id}`);
console.log('Revisa: renderizado, que NO caiga en spam, y que el CTA apunte a https://cashflow.scouttech.lat');
