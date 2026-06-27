import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// Cliente Supabase del MVP Cashflow. Comparte el proyecto Supabase con Validus
// (mismo VITE_SUPABASE_URL/ANON_KEY en .env.local) pero opera bajo el esquema
// AISLADO `cashflow`. Al fijar `db.schema = 'cashflow'`, todas las llamadas
// `supabase.from('transactions' | 'categories' | 'profiles')` resuelven contra
// cashflow.* sin repetir `.schema('cashflow')` en cada query.
//
// Regenerar tipos tras cada migración de cashflow: `npm run gen:types`.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient<Database, 'cashflow'>(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'cashflow' },
  // PKCE: igual que Validus. detectSessionInUrl (default true) intercambia el
  // ?code= del redirect de Google OAuth en /auth/callback. El callback NO debe
  // volver a llamar exchangeCodeForSession (el code es de un solo uso).
  auth: { flowType: 'pkce' },
});
