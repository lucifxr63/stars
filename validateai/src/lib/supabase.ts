import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // detectSessionInUrl (default: true) intercambia el ?code= del redirect — tanto
  // del OAuth de Google (/auth/callback) como del email de recovery (/reset-password).
  // Por eso AuthCallback.tsx NO debe volver a hacer exchangeCodeForSession: el code
  // es de un solo uso y el code_verifier se consume en el primer intercambio.
  auth: { flowType: 'pkce' },
});
