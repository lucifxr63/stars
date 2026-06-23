import { supabase } from '@/lib/supabase';

// Login con Google (OAuth + PKCE). El proveedor ya está habilitado en el proyecto
// Supabase compartido con Validus; este redirectTo (origin actual + /auth/callback)
// ya está en la allowlist para dev (localhost:5174) y se debe añadir el dominio
// de prod cuando exista.
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
  // No retorna: el navegador redirige a Google y vuelve a /auth/callback.
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
