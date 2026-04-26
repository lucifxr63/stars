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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Panel izquierdo — branding (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Orbs decorativos */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-violet-500/15 rounded-full blur-3xl" />

        <div className="relative z-10 text-center max-w-sm">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-12">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">ValidateAI</span>
          </div>

          {/* Mock score card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-bold">MediConnect</p>
                <p className="text-teal-400 text-sm">Validación completada</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-teal-500 flex flex-col items-center justify-center">
                <span className="text-white font-black text-lg leading-none">82</span>
                <span className="text-teal-200 text-xs">pts</span>
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
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-white font-medium">{item.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full">
                    <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <blockquote className="text-gray-400 text-sm italic leading-relaxed">
            "En 15 minutos supe si mi idea valía la pena construir. Ahorré meses de trabajo."
          </blockquote>
          <p className="text-gray-500 text-xs mt-2">— Usuario de ValidateAI</p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">ValidateAI</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-black text-gray-900 mb-1">
              {isSignUp ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}
            </h1>
            <p className="text-gray-500 text-sm">
              {isSignUp
                ? 'Empieza a validar ideas gratis'
                : 'Ingresa para continuar con tus validaciones'}
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            className="w-full py-3.5 bg-white border-2 border-gray-200 rounded-2xl text-sm font-semibold
                       text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]
                       transition-all flex items-center justify-center gap-2.5 mb-5 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">o con email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm
                           focus:border-teal-500 focus:ring-0 transition outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={6}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm
                           focus:border-teal-500 focus:ring-0 transition outline-none bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-teal-500 text-white font-bold rounded-2xl
                         hover:bg-teal-600 active:scale-[0.98] transition-all
                         shadow-lg shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
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
            className="w-full text-center text-sm text-gray-400 hover:text-teal-600 mt-5 transition font-medium"
          >
            {isSignUp
              ? '¿Ya tienes cuenta? Inicia sesión'
              : '¿No tienes cuenta? Regístrate gratis'}
          </button>
        </div>
      </div>
    </div>
  );
}
