import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

const ADMIN_EMAIL = 'lucianoalonso2000@gmail.com';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const reset = useValidationStore((s) => s.reset);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(data.user?.email === ADMIN_EMAIL);
    });
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    reset();
    toast.success('Sesión cerrada');
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const linkCls = (active: boolean) =>
    `block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
      active
        ? 'text-[#F0EFF8] bg-white/8'
        : 'text-[#8B8AA0] hover:text-[#F0EFF8] hover:bg-white/5'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-gray-50 dark:bg-[#0A0A0F]/80 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#7C6FF7] flex items-center justify-center group-hover:scale-105 transition-transform glow-brand-sm">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] tracking-tight">ValidateAI</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link to="/results" className={linkCls(isActive('/results'))}>
            Mis validaciones
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
        <div className="sm:hidden border-t border-white/[0.06] bg-white dark:bg-[#12121A] px-4 py-3 space-y-1">
          <Link to="/results" className={linkCls(isActive('/results'))}>
            Mis validaciones
          </Link>
          {isAdmin && (
            <Link to="/admin" className={linkCls(isActive('/admin'))}>
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
