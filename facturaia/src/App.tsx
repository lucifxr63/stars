import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import Landing from '@/app/routes/Landing'
import Login from '@/app/routes/Login'
import AuthCallback from '@/app/routes/AuthCallback'
import Dashboard from '@/app/routes/Dashboard'
import Admin from '@/app/routes/Admin'

export default function App() {
  const { setSession, setLoading } = useAuthStore()

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession, setLoading])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111827',
            border: '1px solid #1e293b',
            color: '#e2e8f0',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
