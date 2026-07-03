import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// ── useAdminRole ──────────────────────────────────────────────────────────────
// Gate UX de admin multi-operador (Pilotos Fase 3B). Fuente de verdad = RPC
// `get_my_admin_role()` (que valida contra `admin_users` + fallback legacy).
// La seguridad REAL es la RLS `is_admin()`; esto es solo para mostrar/ocultar la
// superficie admin en el cliente.
//
// Fallback: si la RPC aún no existe (migración no aplicada), cae al chequeo legacy
// por email para no bloquear al owner actual durante la transición. TEMPORAL.

const LEGACY_ADMIN_EMAIL = 'lucianoalonso2000@gmail.com';

export interface AdminRoleState {
  isAdmin: boolean;
  role: string | null;
  loading: boolean;
}

export function useAdminRole(): AdminRoleState {
  const [state, setState] = useState<AdminRoleState>({ isAdmin: false, role: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const legacy = (session?.user?.email ?? '').toLowerCase() === LEGACY_ADMIN_EMAIL;

      const { data, error } = await supabase.rpc('get_my_admin_role');
      if (cancelled) return;

      // RPC ausente (migración no aplicada) o error → fallback legacy client-side.
      if (error || !data) {
        setState({ isAdmin: legacy, role: legacy ? 'owner_legacy' : null, loading: false });
        return;
      }
      const d = data as { is_admin?: boolean; role?: string | null };
      const isAdmin = Boolean(d.is_admin) || legacy;
      setState({ isAdmin, role: d.role ?? (legacy ? 'owner_legacy' : null), loading: false });
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
