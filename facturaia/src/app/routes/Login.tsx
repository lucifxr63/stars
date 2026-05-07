import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

export default function Login() {
  const { user } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setSuccessMsg('Revisa tu email para confirmar tu cuenta.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(translateError(msg))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">FacturaIA</span>
        </div>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crear cuenta'}
          </h1>
          <p className="text-slate-400 text-sm mb-6">
            {mode === 'login'
              ? 'Accede a tu panel de liquidez'
              : 'Registra tu PYME en FacturaIA'}
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4"
            >
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4"
            >
              <span className="text-sm text-green-400">{successMsg}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="gerencia@mipyme.cl"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg py-2.5 pl-10 pr-10 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition',
                'bg-blue-600 hover:bg-blue-500 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                'Ingresar'
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#111827] px-2 text-slate-500">o continúa con</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60 transition text-sm font-medium disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            {mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              {mode === 'login' ? 'Regístrate gratis' : 'Ingresa aquí'}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-600">
          Al usar FacturaIA aceptas nuestros{' '}
          <a href="#" className="text-slate-500 hover:text-slate-400">Términos de Servicio</a>{' '}
          y{' '}
          <a href="#" className="text-slate-500 hover:text-slate-400">Política de Privacidad</a>{' '}
          conforme a la Ley 19.628.
        </p>
      </motion.div>
    </div>
  )
}

function translateError(msg: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Email o contraseña incorrectos.',
    'Email not confirmed': 'Debes confirmar tu email antes de ingresar.',
    'User already registered': 'Ya existe una cuenta con este email.',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
  }
  return map[msg] ?? msg
}
