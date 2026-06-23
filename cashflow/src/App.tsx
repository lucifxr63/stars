import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '@/store/auth';
import { ConfirmProvider } from '@/components/ui/confirm';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { SaasCashflow } from '@/pages/SaasCashflow';
import { AuthCallback } from '@/components/AuthCallback';
import { RequireAuth } from '@/components/RequireAuth';

export default function App() {
  // Inicializa la sesión y la suscripción a cambios de auth una sola vez.
  useEffect(() => useAuth.getState().init(), []);

  return (
    <ConfirmProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/saas"
          element={
            <RequireAuth>
              <SaasCashflow />
            </RequireAuth>
          }
        />
      </Routes>
      <Toaster richColors position="top-right" theme="dark" />
    </ConfirmProvider>
  );
}
