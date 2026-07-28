import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { markDeliberateLogout } from '@/lib/session';
import { EVENTS } from '@/lib/storageKeys';
import { useValidationStore } from '@/stores/validationStore';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { getPreviewTier, setPreviewTier, type UserTier } from '@/hooks/useUserTier';
import { useAdminRole } from '@/hooks/useAdminRole';

const PREVIEW_COLORS: Record<UserTier, string> = {
  free:    'bg-gray-800 text-gray-200 border-gray-600',
  basic:   'bg-sky-900 text-sky-200 border-sky-600',
  pro:     'bg-indigo-900 text-indigo-200 border-indigo-600',
  premium: 'bg-violet-900 text-violet-200 border-violet-600',
  admin:   'bg-rose-900 text-rose-200 border-rose-600',
};

import { isAnimusDomain } from '@/lib/domain';

export function Header() {
  const isAnimus = isAnimusDomain();
  const navigate = useNavigate();
  const location = useLocation();
  const reset = useValidationStore((s) => s.reset);
  const { isAdmin } = useAdminRole(); // multi-admin (Fase 3B)
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewTier, setPreviewTierState] = useState<UserTier | null>(() => getPreviewTier());

  useEffect(() => {
    const onPreview = (e: Event) => {
      setPreviewTierState((e as CustomEvent<UserTier | null>).detail);
    };
    window.addEventListener(EVENTS.tierPreview, onPreview);
    return () => window.removeEventListener(EVENTS.tierPreview, onPreview);
  }, []);

  const handleLogout = async () => {
    markDeliberateLogout();
    await supabase.auth.signOut();
    reset();
    toast.success('Sesión cerrada');
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const linkCls = (active: boolean) =>
    `block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
      active
        ? 'text-gray-900 dark:text-[#F0EFF8] bg-black/5 dark:bg-white/8'
        : 'text-gray-600 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] hover:bg-black/5 dark:hover:bg-white/5'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-gray-50 dark:bg-[#0A0A0F]/80 backdrop-blur-xl">
      {previewTier && (
        <div className={`flex items-center justify-between px-4 py-1.5 text-xs font-bold border-b ${PREVIEW_COLORS[previewTier]}`}>
          <span>Modo preview: vista como usuario <span className="uppercase">{previewTier}</span></span>
          <button
            onClick={() => { setPreviewTier(null); setPreviewTierState(null); }}
            className="ml-4 underline opacity-80 hover:opacity-100"
          >
            Salir del preview
          </button>
        </div>
      )}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to={isAnimus ? '/dashboard' : '/'} className="flex items-center gap-2.5 group shrink-0">
          <svg viewBox="0 0 500 500" className="w-7 h-7 group-hover:scale-105 transition-transform" aria-hidden="true">
            <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white"/>
            <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6"/>
            <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6"/>
          </svg>
          <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] tracking-tight">
            {isAnimus ? 'Animus Intelligence' : 'Validus'}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link to="/results" className={linkCls(isActive('/results'))}>
            Mis validaciones
          </Link>
          <Link to="/profile" className={linkCls(isActive('/profile'))}>
            Perfil
          </Link>
          <Link to="/developers" className={linkCls(isActive('/developers'))}>
            API & Devs
          </Link>
          {isAdmin && (
            <Link to="/admin" className={linkCls(isActive('/admin'))}>
              Admin
            </Link>
          )}
          <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-lg text-sm text-[#8B8AA0] hover:text-gray-900 dark:text-[#F0EFF8] hover:bg-gray-100 dark:bg-white/5 transition-all duration-150"
          >
            Salir
          </button>
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-lg text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:text-[#F0EFF8] dark:hover:text-gray-900 dark:text-[#F0EFF8] hover:bg-gray-100 dark:hover:bg-gray-100 dark:bg-white/5 transition-colors"
            aria-label="Menú"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="sm:hidden border-t border-black/[0.07] dark:border-white/[0.06] bg-white dark:bg-[#12121A] px-4 py-3 space-y-1">
          <Link to="/results" onClick={() => setMenuOpen(false)} className={linkCls(isActive('/results'))}>
            Mis validaciones
          </Link>
          <Link to="/profile" onClick={() => setMenuOpen(false)} className={linkCls(isActive('/profile'))}>
            Perfil
          </Link>
          <Link to="/developers" onClick={() => setMenuOpen(false)} className={linkCls(isActive('/developers'))}>
            API & Devs
          </Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setMenuOpen(false)} className={linkCls(isActive('/admin'))}>
              Admin
            </Link>
          )}
          <div className="pt-1 border-t border-white/[0.06] mt-1">
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-[#8B8AA0] hover:text-gray-900 dark:text-[#F0EFF8] hover:bg-gray-100 dark:bg-white/5 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
