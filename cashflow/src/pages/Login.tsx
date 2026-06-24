import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/GoogleIcon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { signInWithGoogle } from '@/lib/auth';
import { useAuth } from '@/store/auth';

export function Login() {
  const { session, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión, no mostramos el login.
  if (!authLoading && session) return <Navigate to="/dashboard" replace />;

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle(); // redirige el navegador a Google
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión. Intenta de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[32rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]"
      />
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-xl bg-primary/15 text-primary">
            <Wallet className="size-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold">Entra a Denarius</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona el flujo de caja de tu negocio en un solo lugar.
          </p>
        </div>

        <Button
          variant="outline"
          size="lg"
          className="w-full bg-white text-slate-900 hover:bg-white/90"
          onClick={handleGoogle}
          disabled={submitting}
          aria-label="Continuar con Google"
        >
          <GoogleIcon />
          {submitting ? 'Conectando…' : 'Continuar con Google'}
        </Button>

        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-danger">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Al continuar aceptas nuestros Términos y Política de Privacidad.
        </p>
      </div>
    </main>
  );
}
