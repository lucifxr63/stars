import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase maneja el intercambio PKCE automáticamente vía onAuthStateChange.
    // Solo esperamos la sesión y redirigimos.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Upsert de perfil con datos de Google
        const meta = session.user.user_metadata;
        const name = meta?.full_name ?? meta?.name ?? null;
        const avatar = meta?.avatar_url ?? null;
        if (name || avatar) {
          await supabase.from('profiles').upsert(
            { id: session.user.id, full_name: name, avatar_url: avatar, updated_at: new Date().toISOString() },
            { onConflict: 'id', ignoreDuplicates: false }
          );
        }
        navigate('/validate', { replace: true });
      }
    });

    // Fallback: si la sesión ya existe cuando llegamos (ej: refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/validate', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500">Iniciando sesión...</p>
      </div>
    </div>
  );
}
