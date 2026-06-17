import { createClient } from '@supabase/supabase-js';
// Tipos de DB generados disponibles en @/lib/database.types (regen: `npm run gen:types`).
// El cliente aún NO está tipado con <Database>: hacerlo requiere alinear los tipos de
// dominio (Validation, ValidationFull, FounderProfileData…) con las Row generadas —
// migración enfocada pendiente (ver docs/DB_TYPES_ADOPTION.md). Hoy el archivo sirve
// como fuente de verdad del schema y para tipar queries/RPC nuevas de forma puntual.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // detectSessionInUrl (default: true) intercambia el ?code= del redirect — tanto
  // del OAuth de Google (/auth/callback) como del email de recovery (/reset-password).
  // Por eso AuthCallback.tsx NO debe volver a hacer exchangeCodeForSession: el code
  // es de un solo uso y el code_verifier se consume en el primer intercambio.
  auth: { flowType: 'pkce' },
});
