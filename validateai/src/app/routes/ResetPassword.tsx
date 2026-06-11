import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { markDeliberateLogout } from '@/lib/session';
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

// 'checking' = esperando que detectSessionInUrl procese el ?code= del email
// 'ready'    = sesión de recovery válida → mostrar form
// 'invalid'  = enlace expirado / inválido / abierto sin token
type Phase = 'checking' | 'ready' | 'invalid';

export function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let settled = false;

    // PASSWORD_RECOVERY se emite cuando el cliente intercambia el código del email.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        settled = true;
        setPhase('ready');
      }
    });

    // Fallback: con detectSessionInUrl el código puede haberse procesado antes de
    // montar el listener. Damos un margen y luego comprobamos la sesión activa.
    const timer = setTimeout(async () => {
      if (settled) return;
      const { data } = await supabase.auth.getSession();
      setPhase(data.session ? 'ready' : 'invalid');
    }, 1500);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Cerramos la sesión de recovery y forzamos login limpio con la nueva clave.
      // Marcamos el signOut como deliberado: es el cierre del flujo de reset, no
      // una expiración — evita un falso toast "sesión expiró" si esta vista llega
      // a montarse bajo un layout con el listener de auth.
      markDeliberateLogout();
      await supabase.auth.signOut();
      toast.success('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('same') )
        toast.error('La nueva contraseña no puede ser igual a la anterior.');
      else
        toast.error('No se pudo actualizar la contraseña. Solicita un nuevo enlace.');
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

          {phase === 'checking' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-8 h-8 border-2 border-[#0EB5C6] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">Validando el enlace...</p>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="space-y-4 text-center">
              <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8]">
                Enlace inválido o expirado
              </h1>
              <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">
                El enlace de recuperación ya no es válido. Solicita uno nuevo para continuar.
              </p>
              <Link to="/forgot-password"
                className="block w-full text-center py-3 bg-[#0EB5C6] text-white font-semibold rounded-xl
                           hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150 shadow-lg shadow-[#0EB5C6]/25 text-sm">
                Solicitar nuevo enlace
              </Link>
            </div>
          )}

          {phase === 'ready' && (
            <>
              <div className="mb-8">
                <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">
                  Nueva contraseña
                </h1>
                <p className="text-gray-500 dark:text-[#8B8AA0] text-sm">
                  Elige una contraseña segura para tu cuenta.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-[#8B8AA0] mb-1.5">Nueva contraseña</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="new-password" required minLength={6} autoFocus
                    className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm
                               text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#12121A]
                               placeholder:text-gray-400 dark:placeholder:text-[#afaebb]
                               focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20
                               hover:border-gray-300 dark:hover:border-white/15 transition-all outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-[#8B8AA0] mb-1.5">Confirmar contraseña</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••" autoComplete="new-password" required minLength={6}
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
                    ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</span>
                    : 'Guardar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
