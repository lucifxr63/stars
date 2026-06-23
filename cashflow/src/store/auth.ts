import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  init: () => () => void; // devuelve unsubscribe
}

// Store de sesión. Llamar init() una vez al montar la app (App.tsx):
//   useEffect(() => useAuth.getState().init(), [])
export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  init: () => {
    // Sesión actual (al cargar) — detectSessionInUrl ya intercambió el ?code= del callback.
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, loading: false });
    });
    // Cambios en vivo: login, logout, refresh de token.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  },
}));
