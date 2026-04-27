import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('email rate limit')) {
        toast.error('Demasiados intentos. Espera unos minutos e intenta de nuevo.');
      } else if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials') || msg.includes('400')) {
        toast.error('Email o contraseña incorrectos.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        toast.error('Confirma tu email antes de ingresar. Revisa tu bandeja de entrada.');
      } else if (msg.toLowerCase().includes('user already registered')) {
        toast.error('Ya existe una cuenta con ese email. Inicia sesión.');
        setIsSignUp(false);
      } else {
        toast.error(msg || 'Error de autenticación. Intenta de nuevo.');
      }
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex">
      {/* Panel izquierdo — branding (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-white dark:bg-[#12121A] border-r border-white/[0.06] relative overflow-hidden flex-col items-center justify-center p-12">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#7C6FF7]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-56 h-56 bg-[#F7C56C]/6 rounded-full blur-3xl" />

        <div className="relative z-10 text-center max-w-sm">
          <div className="flex items-center justify-center gap-2.5 mb-12">
            <div className="w-9 h-9 rounded-xl bg-[#7C6FF7] flex items-center justify-center glow-brand-sm">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-heading text-lg font-semibold text-gray-900 dark:text-[#F0EFF8]">ValidateAI</span>
          </div>

          <div className="glass-card rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-900 dark:text-[#F0EFF8] font-semibold text-sm">MediConnect</p>
                <p className="text-[#34D399] text-xs">Validación completada</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#7C6FF7] flex flex-col items-center justify-center">
                <span className="text-white font-black text-base font-heading leading-none">82</span>
                <span className="text-[#A78BFA] text-[10px]">pts</span>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Problema validado', pct: 88 },
                { label: 'Mercado objetivo', pct: 75 },
                { label: 'Plan de MVP', pct: 92 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-[#8B8AA0]">{item.label}</span>
                    <span className="text-gray-900 dark:text-[#F0EFF8] font-medium tabular-nums">{item.pct}%</span>
                  </div>
                  <div className="h-1 bg-white dark:bg-[#12121A]/8 rounded-full">
                    <div className="h-full bg-[#7C6FF7] rounded-full" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <blockquote className="text-gray-500 dark:text-[#8B8AA0] text-sm italic leading-relaxed">
            "En 10 minutos supe si mi idea valía la pena construir. Ahorré meses de trabajo."
          </blockquote>
          <p className="text-[#4A495E] text-xs mt-2">— Usuario de ValidateAI</p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-[#7C6FF7] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">ValidateAI</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">
              {isSignUp ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}
            </h1>
            <p className="text-gray-500 dark:text-[#8B8AA0] text-sm">
              {isSignUp ? 'Empieza a validar ideas gratis' : 'Ingresa para continuar con tus validaciones'}
            </p>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full py-3 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium
                       text-gray-700 dark:text-[#C4C4D4] hover:bg-gray-50 dark:bg-[#0A0A0F] active:scale-[0.98]
                       transition-all flex items-center justify-center gap-2.5 mb-5 shadow-sm"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white dark:bg-[#12121A]/[0.06]" />
            <span className="text-xs text-[#4A495E] font-medium">o con email</span>
            <div className="flex-1 h-px bg-white dark:bg-[#12121A]/[0.06]" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-[#8B8AA0] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                required
                className="w-full px-4 py-3 border border-gray-200 dark:border-white/8 rounded-xl text-sm text-gray-900 dark:text-[#F0EFF8]
                           bg-white dark:bg-[#12121A] placeholder:text-[#4A495E]
                           focus:border-[#7C6FF7] focus:ring-2 focus:ring-[#7C6FF7]/20
                           hover:border-white/15 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-[#8B8AA0] mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-200 dark:border-white/8 rounded-xl text-sm text-gray-900 dark:text-[#F0EFF8]
                           bg-white dark:bg-[#12121A] placeholder:text-[#4A495E]
                           focus:border-[#7C6FF7] focus:ring-2 focus:ring-[#7C6FF7]/20
                           hover:border-white/15 transition-all outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#7C6FF7] text-white font-semibold rounded-xl
                         hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150
                         shadow-lg shadow-[#7C6FF7]/25 disabled:opacity-40 disabled:cursor-not-allowed mt-1 text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Cargando...
                </span>
              ) : (
                isSignUp ? 'Crear cuenta' : 'Ingresar'
              )}
            </button>
          </form>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-center text-sm text-gray-500 dark:text-[#8B8AA0] hover:text-[#A78BFA] mt-5 transition-colors font-medium"
          >
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
          </button>
        </div>
      </div>
    </div>
  );
}
