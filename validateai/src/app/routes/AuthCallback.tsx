import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let settled = false;

    // El cliente Supabase (detectSessionInUrl) intercambia el ?code= del redirect
    // OAuth al inicializarse. NO hacemos exchangeCodeForSession aquí: sería un
    // segundo intercambio del mismo code (de un solo uso) → falla y rebotaba a
    // /login?error=auth_failed aunque el login fuera exitoso. Solo esperamos la
    // sesión resultante, igual que ResetPassword.

    async function onSession(session: import('@supabase/supabase-js').Session) {
      if (settled) return;
      settled = true;

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

    // SIGNED_IN se emite cuando el cliente termina de intercambiar el code.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) onSession(session);
    });

    // Fallback: el code pudo procesarse antes de montar el listener. Damos un
    // margen y comprobamos la sesión activa; si no hay, el login falló.
    const timer = setTimeout(async () => {
      if (settled) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) onSession(data.session);
      else {
        settled = true;
        navigate('/login?error=auth_failed', { replace: true });
      }
    }, 2500);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
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
