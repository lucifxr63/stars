import { create } from 'zustand';

export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cf_theme';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* noop */ }
  return 'system';
}

function applyResolved(pref: ThemePref): 'light' | 'dark' {
  const resolved = pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }
  return resolved;
}

interface ThemeState {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  /** Suscribe a cambios del sistema (cuando pref === 'system'). Llamar una vez. */
  init: () => () => void;
  /** Alterna explícitamente entre light/dark (deja de seguir el sistema). */
  toggle: () => void;
  setPref: (pref: ThemePref) => void;
}

export const useTheme = create<ThemeState>((set, get) => {
  const pref = readPref();
  return {
    pref,
    resolved: applyResolved(pref),
    init: () => {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (get().pref === 'system') set({ resolved: applyResolved('system') });
      };
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    toggle: () => get().setPref(get().resolved === 'dark' ? 'light' : 'dark'),
    setPref: (next) => {
      try {
        if (next === 'system') localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, next);
      } catch { /* noop */ }
      set({ pref: next, resolved: applyResolved(next) });
    },
  };
});
