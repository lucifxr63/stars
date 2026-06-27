import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';

// Página a la que Google redirige tras el login (/auth/callback).
// supabase-js (detectSessionInUrl: true) intercambia el ?code= automáticamente,
// así que aquí NO se llama exchangeCodeForSession (el code es de un solo uso).
// Solo esperamos a que la sesión quede establecida y redirigimos al dashboard.
export function AuthCallback() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      navigate(session ? '/dashboard' : '/login', { replace: true });
    }
  }, [session, loading, navigate]);

  return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Iniciando sesión…</div>;
}
