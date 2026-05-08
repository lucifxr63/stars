import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const EDGE_URL = import.meta.env.VITE_SUPABASE_URL?.replace('supabase.co', 'supabase.co/functions/v1');

export function FigmaCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function exchange() {
      const code = params.get('code');
      const error = params.get('error');
      const returnTo = params.get('state')
        ? (() => {
            try {
              const decoded = JSON.parse(atob(params.get('state')!));
              return decoded.return_to ?? '/validate';
            } catch {
              return '/validate';
            }
          })()
        : '/validate';

      if (error) {
        toast.error(`Figma rechazó la conexión: ${error}`);
        navigate(returnTo, { replace: true });
        return;
      }

      if (!code) {
        toast.error('No se recibió código de autorización de Figma.');
        navigate(returnTo, { replace: true });
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesión no encontrada');

        const res = await fetch(`${EDGE_URL}/figma-oauth-handler/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            code,
            redirect_uri: `${window.location.origin}/figma/callback`,
          }),
        });

        const data = await res.json() as { connected?: boolean; figma_handle?: string; error?: string };

        if (!res.ok || data.error) throw new Error(data.error ?? 'Error al conectar con Figma');

        toast.success(`¡Figma conectado! Hola, ${data.figma_handle ?? 'usuario'}`);
        navigate(returnTo, { replace: true });

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        toast.error(msg);
        navigate(returnTo, { replace: true });
      }
    }

    exchange();
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-[#7C6FF7] border-t-transparent animate-spin" />
        <p className="text-sm text-[#8B8AA0]">Conectando con Figma...</p>
      </div>
    </div>
  );
}
