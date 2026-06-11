import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

function Logo({ className = 'w-7 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} aria-label="Validus" role="img">
      <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white" />
      <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6" />
      <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6" />
    </svg>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Ingresa un email válido (ej: nombre@dominio.com).');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      // No revelamos si el email existe o no (anti-enumeración): siempre éxito.
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit'))
        toast.error('Demasiados intentos. Espera unos minutos e intenta de nuevo.');
      else
        toast.error('No se pudo enviar el correo. Intenta de nuevo en un momento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 lg:px-8">
        <Link to="/login" className="flex items-center gap-2">
          <Logo className="w-6 h-7" />
          <span className="font-heading text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Validus</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">
              Recuperar contraseña
            </h1>
            <p className="text-gray-500 dark:text-[#8B8AA0] text-sm">
              {sent
                ? 'Si existe una cuenta con ese email, te enviamos un enlace para restablecer tu contraseña.'
                : 'Te enviaremos un enlace para crear una nueva contraseña.'}
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0EB5C6]/10 mx-auto">
                <svg className="w-7 h-7 text-[#0EB5C6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-[#8B8AA0]">
                Revisa tu bandeja de entrada (y la carpeta de spam). El enlace expira en 1 hora.
              </p>
              <Link
                to="/login"
                className="block w-full text-center py-3 bg-[#0EB5C6] text-white font-semibold rounded-xl
                           hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150 shadow-lg shadow-[#0EB5C6]/25 text-sm">
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8B8AA0] mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com" autoComplete="email" required autoFocus
                  className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm
                             text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#12121A]
                             placeholder:text-gray-400 dark:placeholder:text-[#afaebb]
                             focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20
                             hover:border-gray-300 dark:hover:border-white/15 transition-all outline-none"/>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-[#0EB5C6] text-white font-semibold rounded-xl
                           hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150
                           shadow-lg shadow-[#0EB5C6]/25 disabled:opacity-40 disabled:cursor-not-allowed mt-1 text-sm cursor-pointer">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</span>
                  : 'Enviar enlace de recuperación'}
              </button>

              <Link to="/login"
                className="block w-full text-center text-sm text-gray-500 dark:text-[#8B8AA0] hover:text-[#0EB5C6] mt-4 transition-colors font-medium">
                ← Volver a iniciar sesión
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
