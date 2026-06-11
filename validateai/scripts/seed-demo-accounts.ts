/**
 * Seed script: crea cuentas de prueba deterministas para el "Demo 100".
 *
 * Genera un usuario por cada tier (free / basic / pro / premium) con el
 * onboarding ya completado, de modo que al iniciar sesión caen directo en
 * /dashboard sin pasar por el wizard de onboarding ni el consent gating.
 *
 * Uso:
 *   npx tsx scripts/seed-demo-accounts.ts            # crea / actualiza
 *   npx tsx scripts/seed-demo-accounts.ts --reset    # borra y recrea desde cero
 *
 * Requiere en .env.local:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   <- NUNCA debe vivir en el frontend ni commitearse
 *
 * La service_role key bypassa RLS: este script SOLO corre en local / CI,
 * jamás en el bundle del cliente.
 */
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { buildGoldenValidation, buildGoldenAgentsLog, GOLDEN_IDEA_NAME } from './golden-mediconnect';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '✗ Faltan variables de entorno. Define VITE_SUPABASE_URL y ' +
    'SUPABASE_SERVICE_ROLE_KEY en .env.local antes de correr este script.',
  );
  process.exit(1);
}

// Cliente admin (service_role) — bypassa RLS. Solo uso local.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Password compartido para todas las cuentas demo. Se imprime al final.
const DEMO_PASSWORD = 'DemoValidus2026!';

type Tier = 'free' | 'basic' | 'pro' | 'premium';

interface DemoAccount {
  email: string;
  tier: Tier;
  full_name: string;
  startup_name: string;
  startup_sector: string;
  founder_pitch: string;
}

const ACCOUNTS: DemoAccount[] = [
  {
    email: 'demo_free@validus.lat',
    tier: 'free',
    full_name: 'Camila Free',
    startup_name: 'AgendaPyme',
    startup_sector: 'SaaS / Productividad',
    founder_pitch: 'Agenda inteligente para pymes de servicios en Chile.',
  },
  {
    email: 'demo_basic@validus.lat',
    tier: 'basic',
    full_name: 'Diego Basic',
    startup_name: 'FrescoBox',
    startup_sector: 'Foodtech / Logística',
    founder_pitch: 'Suscripción de frutas y verduras de temporada a domicilio.',
  },
  {
    email: 'demo_pro@validus.lat',
    tier: 'pro',
    full_name: 'Valentina Pro',
    startup_name: 'MediConnect',
    startup_sector: 'Healthtech',
    founder_pitch: 'Telemedicina para zonas rurales con cobertura limitada.',
  },
  {
    // Mismo sujeto que Pro (MediConnect) para el recurso narrativo del pitch:
    // "misma idea, mirá lo que desbloquea Premium" (gobernanza + fundraising + EvidenceWall).
    email: 'demo_premium@validus.lat',
    tier: 'premium',
    full_name: 'Tomás Premium',
    startup_name: 'MediConnect',
    startup_sector: 'Healthtech',
    founder_pitch: 'Telemedicina offline-first para la atención primaria rural en Chile.',
  },
];

/** Busca un usuario por email recorriendo la paginación de admin.listUsers. */
async function findUserByEmail(email: string): Promise<User | null> {
  const target = email.toLowerCase();
  let page = 1;
  // perPage máximo de la Admin API es 1000.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers falló: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

/** Crea el usuario auth si no existe; devuelve el id en ambos casos. */
async function ensureAuthUser(acc: DemoAccount): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: acc.email,
    password: DEMO_PASSWORD,
    email_confirm: true, // saltea el correo de confirmación → login inmediato
    user_metadata: { full_name: acc.full_name },
  });

  if (!error && data.user) {
    console.log(`  + auth user creado (${acc.email})`);
    return data.user.id;
  }

  // Ya existe → recuperar id y resetear la password al valor demo conocido.
  const existing = await findUserByEmail(acc.email);
  if (!existing) {
    throw new Error(`createUser falló y el usuario no aparece en listUsers: ${error?.message}`);
  }
  await admin.auth.admin.updateUserById(existing.id, {
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: acc.full_name },
  });
  console.log(`  ~ auth user ya existía, password reseteada (${acc.email})`);
  return existing.id;
}

/** El trigger handle_new_user crea la fila profiles; aquí la completamos. */
async function upsertProfile(id: string, acc: DemoAccount): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: acc.full_name,
      tier: acc.tier,
      onboarding_completed: true, // demo cae directo en /dashboard
      role: 'founder',
      startup_name: acc.startup_name,
      startup_sector: acc.startup_sector,
      founder_pitch: acc.founder_pitch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(`update profiles falló (${acc.email}): ${error.message}`);
  console.log(`  ✓ profile → tier=${acc.tier}, onboarding=done`);
}

/**
 * Pre-siembra el consentimiento Ley 21.719 (consent_logs) para que las cuentas
 * demo no vean el ConsentModal obligatorio durante el pitch. useConsentGuard
 * busca una fila con flagged=true; los INSERT solo los hace service_role.
 * Idempotente: inserta solo si no existe ya un consentimiento válido.
 */
async function ensureConsent(userId: string): Promise<void> {
  const { data: existing } = await admin
    .from('consent_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('flagged', true)
    .limit(1)
    .maybeSingle();
  if (existing) { console.log('  ~ consentimiento ya registrado'); return; }

  const { error } = await admin.from('consent_logs').insert({
    user_id: userId,
    consent_type: 'data_processing',
    flagged: true,
  });
  if (error) throw new Error(`insert consent_logs falló: ${error.message}`);
  console.log('  ✓ consentimiento Ley 21.719 pre-registrado (sin modal)');
}

/**
 * Siembra la Golden Validation (MediConnect) para las cuentas pro/premium.
 * Idempotente: borra primero cualquier validación previa del usuario (el log de
 * agentes cae por ON DELETE CASCADE) y luego inserta la golden fresca.
 */
async function seedGoldenValidation(userId: string, tier: 'pro' | 'premium'): Promise<void> {
  // Limpieza idempotente — wipe de validaciones de la cuenta demo.
  const { error: delErr } = await admin.from('validations').delete().eq('user_id', userId);
  if (delErr) throw new Error(`limpieza de validations falló: ${delErr.message}`);

  const row = buildGoldenValidation(userId, tier);
  const { data: inserted, error: insErr } = await admin
    .from('validations')
    .insert(row)
    .select('id')
    .single();
  if (insErr) throw new Error(`insert golden validation falló: ${insErr.message}`);
  const validationId = inserted!.id as string;
  console.log(`  ✓ golden validation "${GOLDEN_IDEA_NAME}" (${tier}) → ${validationId}`);

  // EvidenceWall: solo Premium lleva el log de agentes (Reddit + Trends).
  if (tier === 'premium') {
    const { error: logErr } = await admin
      .from('validation_agents_log')
      .insert(buildGoldenAgentsLog(validationId, userId));
    if (logErr) throw new Error(`insert agents_log falló: ${logErr.message}`);
    console.log('  ✓ validation_agents_log (EvidenceWall) sembrado');
  }
}

async function deleteAccount(acc: DemoAccount): Promise<void> {
  const existing = await findUserByEmail(acc.email);
  if (!existing) return;
  // profiles se borra en cascada por el FK on delete cascade.
  const { error } = await admin.auth.admin.deleteUser(existing.id);
  if (error) throw new Error(`deleteUser falló (${acc.email}): ${error.message}`);
  console.log(`  - eliminada ${acc.email}`);
}

async function main() {
  const reset = process.argv.includes('--reset');

  console.log(`\nSeed de cuentas demo — proyecto ${SUPABASE_URL}\n`);

  if (reset) {
    console.log('Modo --reset: eliminando cuentas demo existentes...');
    for (const acc of ACCOUNTS) await deleteAccount(acc);
    console.log('');
  }

  for (const acc of ACCOUNTS) {
    console.log(`• ${acc.tier.toUpperCase()} — ${acc.email}`);
    const id = await ensureAuthUser(acc);
    await upsertProfile(id, acc);
    await ensureConsent(id);
    if (acc.tier === 'pro' || acc.tier === 'premium') {
      await seedGoldenValidation(id, acc.tier);
    }
  }

  console.log('\n────────────────────────────────────────────');
  console.log('Cuentas demo listas. Credenciales para el pitch:\n');
  for (const acc of ACCOUNTS) {
    console.log(`  ${acc.tier.padEnd(8)} ${acc.email.padEnd(28)} ${DEMO_PASSWORD}`);
  }
  console.log('\n  (mismo password para todas — solo para el Demo 100)');
  console.log('────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('\n✗ Seed falló:', err.message);
  process.exit(1);
});
