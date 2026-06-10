import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function CheckoutSuccess() {
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Lemon Squeezy pasa ?checkout[custom][validation_id] y otros params
  // Leemos el tier actualizado directamente desde la DB
  useEffect(() => {
    const poll = async () => {
      // Polling hasta 16 segundos (8 intentos × 2s) — el webhook de LS puede demorar
      const MAX_ATTEMPTS = 8;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) break;
        const { data } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', user.id)
          .single();
        if (data?.tier && data.tier !== 'free') {
          setTier(data.tier);
          break;
        }
        if (attempt < MAX_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 2000));
      }
      setLoading(false);
    };
    poll();
  }, []);

  const TIER_LABEL: Record<string, string> = {
    basic: 'Basic', pro: 'Pro', premium: 'Premium',
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0A0A0F]">
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          {loading ? (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">Confirmando tu suscripción...</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-8 shadow-sm space-y-6">
              {/* Checkmark */}
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-2">
                  {tier ? '¡Suscripción activada!' : 'Pago recibido'}
                </h1>
                {tier ? (
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">
                    Tu plan <span className="font-bold text-indigo-600 dark:text-indigo-400">{TIER_LABEL[tier] ?? tier}</span> ya está activo.
                    Puedes acceder a todos los análisis avanzados.
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">
                    Recibimos tu pago. Tu plan se actualizará en los próximos minutos.
                    Si no ves el cambio, recarga la página.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/validate"
                  className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Ir al wizard →
                </Link>
                <Link
                  to="/results"
                  className="px-5 py-2.5 border border-gray-200 dark:border-white/8 text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] rounded-xl hover:border-indigo-300 transition-colors"
                >
                  Ver mis resultados
                </Link>
              </div>

              <p className="text-[11px] text-gray-400 dark:text-[#afaebb]">
                ¿Problemas?{' '}
                <a href="mailto:contacto@validus.scouttech.lat" className="text-indigo-500 hover:underline">
                  contacto@validus.scouttech.lat
                </a>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
