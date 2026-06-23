import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/GoogleIcon';
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
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-xl bg-primary/15 text-primary">
            <Wallet className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold">Entra a Cashflow</h1>
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
