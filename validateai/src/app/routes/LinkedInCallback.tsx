import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { toast } from 'sonner';
import type { FounderProfileData } from '@/types/validation';

const EDGE_URL = import.meta.env.VITE_SUPABASE_URL?.replace('supabase.co', 'supabase.co/functions/v1');

export function LinkedInCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setFounderProfile } = useValidationStore();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function exchange() {
      const code  = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      const returnTo = (() => {
        try { return JSON.parse(atob(state ?? '')).return_to ?? '/validate'; }
        catch { return '/validate'; }
      })();

      if (error) {
        toast.error(`LinkedIn rechazó la conexión: ${error}`);
        navigate(returnTo, { replace: true });
        return;
      }

      // CSRF check
      const saved = sessionStorage.getItem('linkedin_oauth_state');
      if (!state || state !== saved) {
        toast.error('Estado OAuth inválido — intentá de nuevo.');
        navigate(returnTo, { replace: true });
        return;
      }
      sessionStorage.removeItem('linkedin_oauth_state');

      if (!code) {
        toast.error('No se recibió código de autorización de LinkedIn.');
        navigate(returnTo, { replace: true });
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no encontrada');

        const res = await fetch(`${EDGE_URL}/linkedin-oauth-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            code,
            redirect_uri: `${window.location.origin}/auth/linkedin/callback`,
          }),
        });

        const data = await res.json() as FounderProfileData & { error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? `Error ${res.status}`);

        setFounderProfile({ ...data, id: session.user.id });
        toast.success('Perfil de LinkedIn conectado');
        navigate(returnTo, { replace: true });

      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al conectar LinkedIn');
        navigate(returnTo, { replace: true });
      }
    }

    exchange();
  }, [navigate, params, setFounderProfile]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-[#0077B5] border-t-transparent animate-spin" />
        <p className="text-sm text-[#8B8AA0]">Conectando con LinkedIn...</p>
      </div>
    </div>
  );
}
