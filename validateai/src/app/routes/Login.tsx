import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

function Logo({ className = 'w-7 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 338 426" className={className} aria-label="Validus" role="img">
      <path d="M111 187 A78 78 0 0 1 168 123" fill="none" className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt"/>
      <path d="M213 123 A78 78 0 0 1 271 187" fill="none" className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt"/>
      <path d="M66 198 H118 L169 292 L220 198 H272 L169 358 Z" className="fill-[#001431] dark:fill-white"/>
      <path d="M134 252 L152 252 L169 286 L187 252 L205 252 L169 324 Z" className="fill-white dark:fill-[#0A0A0F]"/>
      <path d="M155 253 L169 279 L192 253 L200 263 L169 303 L148 263 Z" className="fill-[#001431] dark:fill-white"/>
      <path d="M169 68 L193 257 L169 237 L156 254 Z" className="fill-[#ff2b23] dark:fill-[#7C6FF7]"/>
    </svg>
  );
}

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success('Revisa tu email para confirmar tu cuenta.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/validate');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit'))
        toast.error('Demasiados intentos. Espera unos minutos e intenta de nuevo.');
      else if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials') || msg.includes('400'))
        toast.error('Email o contraseña incorrectos.');
      else if (msg.toLowerCase().includes('email not confirmed'))
        toast.error('Confirma tu email antes de ingresar. Revisa tu bandeja.');
      else if (msg.toLowerCase().includes('user already registered'))
        { toast.error('Ya existe una cuenta con ese email. Inicia sesión.'); setIsSignUp(false); }
      else
        toast.error(msg || 'Error de autenticación. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] flex">

      {/* Panel izquierdo — branding (desktop) */}
      <div className="hidden lg:flex lg:w-[48%] bg-white dark:bg-[#12121A] border-r border-gray-100 dark:border-white/[0.06] relative overflow-hidden flex-col items-center justify-center p-12">
        <div className="absolute top-16 left-10 w-72 h-72 bg-[#7C6FF7]/8 rounded-full blur-3xl pointer-events-none"/>
        <div className="absolute bottom-16 right-10 w-56 h-56 bg-[#F7C56C]/6 rounded-full blur-3xl pointer-events-none"/>
        <div className="absolute inset-0 grid-pattern opacity-40"/>

        <div className="relative z-10 text-center max-w-sm">
          <div className="flex items-center justify-center gap-2.5 mb-10">
            <Logo className="w-8 h-10"/>
            <span className="font-heading text-lg font-bold text-gray-900 dark:text-[#F0EFF8]">Validus</span>
          </div>

          {/* Demo card */}
          <div className="glass-card rounded-2xl p-6 mb-8 text-left">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-900 dark:text-[#F0EFF8] font-semibold text-sm">MediConnect</p>
                <p className="text-[#34D399] text-xs mt-0.5">Validación completada</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#7C6FF7] flex flex-col items-center justify-center shrink-0">
                <span className="text-white font-black text-base font-heading leading-none">82</span>
                <span className="text-[#C4B5FD] text-[10px]">pts</span>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Problema validado', pct: 88, color: '#7C6FF7' },
                { label: 'Mercado objetivo',  pct: 75, color: '#34D399' },
                { label: 'Plan de MVP',        pct: 92, color: '#F7C56C' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-[#8B8AA0]">{item.label}</span>
                    <span className="text-gray-900 dark:text-[#F0EFF8] font-semibold tabular-nums">{item.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-white/[0.08] rounded-full">
                    <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <blockquote className="text-gray-500 dark:text-[#8B8AA0] text-sm italic leading-relaxed">
            "En 10 minutos supe si mi idea valía la pena construir. Ahorré meses de trabajo."
          </blockquote>
          <p className="text-gray-400 dark:text-[#4A495E] text-xs mt-2">— Founder en Santiago</p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col">
        {/* Topbar mobile */}
        <div className="flex items-center justify-between px-4 py-4 lg:justify-end lg:px-8">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <Logo className="w-6 h-7"/>
            <span className="font-heading text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Validus</span>
          </Link>
          <ThemeToggle/>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 pb-12">
          <div className="w-full max-w-sm">

            <div className="mb-8">
              <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">
                {isSignUp ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}
              </h1>
              <p className="text-gray-500 dark:text-[#8B8AA0] text-sm">
                {isSignUp ? 'Empieza a validar ideas gratis' : 'Ingresa para continuar con tus validaciones'}
              </p>
            </div>

            {/* Google */}
            <button onClick={handleGoogle}
              className="w-full py-3 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold
                         text-gray-700 dark:text-[#C4C4D4] hover:bg-gray-50 dark:hover:bg-white/[0.06] active:scale-[0.98]
                         transition-all flex items-center justify-center gap-2.5 mb-5 shadow-sm cursor-pointer">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.08]"/>
              <span className="text-xs text-gray-400 dark:text-[#4A495E] font-medium">o con email</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.08]"/>
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8B8AA0] mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com" autoComplete="email" required
                  className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm
                             text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#12121A]
                             placeholder:text-gray-400 dark:placeholder:text-[#4A495E]
                             focus:border-[#7C6FF7] focus:ring-2 focus:ring-[#7C6FF7]/20
                             hover:border-gray-300 dark:hover:border-white/15 transition-all outline-none"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-[#8B8AA0] mb-1.5">Contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required minLength={6}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm
                             text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#12121A]
                             placeholder:text-gray-400 dark:placeholder:text-[#4A495E]
                             focus:border-[#7C6FF7] focus:ring-2 focus:ring-[#7C6FF7]/20
                             hover:border-gray-300 dark:hover:border-white/15 transition-all outline-none"/>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-[#7C6FF7] text-white font-semibold rounded-xl
                           hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150
                           shadow-lg shadow-[#7C6FF7]/25 disabled:opacity-40 disabled:cursor-not-allowed mt-1 text-sm cursor-pointer">
                {loading
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Cargando...</span>
                  : isSignUp ? 'Crear cuenta' : 'Ingresar'
                }
              </button>
            </form>

            <button onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-center text-sm text-gray-500 dark:text-[#8B8AA0] hover:text-[#7C6FF7] mt-5 transition-colors font-medium cursor-pointer">
              {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
            </button>

            <p className="text-center text-xs text-gray-400 dark:text-[#4A495E] mt-6">
              Al continuar aceptas nuestros{' '}
              <span className="underline cursor-pointer hover:text-gray-600 dark:hover:text-[#8B8AA0]">Términos</span>
              {' '}y{' '}
              <span className="underline cursor-pointer hover:text-gray-600 dark:hover:text-[#8B8AA0]">Privacidad</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
