import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';

// Guard de rutas protegidas. Mientras carga la sesión muestra un placeholder;
// sin sesión redirige a /login.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Cargando…</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
