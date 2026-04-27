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
        const meta = session.user.user_metadata;
        const name = meta?.full_name ?? meta?.name ?? null;
        const avatar = meta?.avatar_url ?? null;
        if (name || avatar) {
          await supabase.from('profiles').upsert(
            { id: session.user.id, full_name: name, avatar_url: avatar, updated_at: new Date().toISOString() },
            { onConflict: 'id', ignoreDuplicates: false }
          );
        }
        // Pequeño tick para que la sesión quede persistida antes de que ProtectedLayout la lea
        await new Promise(r => setTimeout(r, 50));
        navigate('/validate', { replace: true });
      }
    });

    // Fallback: si la sesión ya existe al llegar (ej: refresh)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await new Promise(r => setTimeout(r, 50));
        navigate('/validate', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0F]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">Iniciando sesión...</p>
      </div>
    </div>
  );
}
