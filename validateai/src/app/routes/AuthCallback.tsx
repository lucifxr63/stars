import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      let session = null;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          navigate('/login?error=auth_failed', { replace: true });
          return;
        }
        session = data.session;
      } else {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      if (!session?.user) {
        navigate('/login', { replace: true });
        return;
      }

      const meta = session.user.user_metadata;
      const name = meta?.full_name ?? meta?.name ?? null;
      const avatar = meta?.avatar_url ?? null;
      if (name || avatar) {
        // upsert (no update): si el trigger handle_new_user no creó la fila,
        // un .update() sería un no-op silencioso y el usuario quedaría sin
        // profile → 406 en toda la app. upsert garantiza que la fila exista.
        await supabase.from('profiles')
          .upsert(
            { id: session.user.id, full_name: name, avatar_url: avatar, updated_at: new Date().toISOString() },
            { onConflict: 'id' },
          );
      }

      navigate('/dashboard', { replace: true });
    }

    handleCallback();
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
