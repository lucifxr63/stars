import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';

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

  // Cerrar menu al cambiar de ruta
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    reset();
    toast.success('Sesión cerrada');
    navigate('/');
  };

  const linkCls = (active: boolean) =>
    `block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      active ? 'bg-teal-50 text-teal-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
    }`;

  return (
    <header className="border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center group-hover:scale-105 transition-transform">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">ValidateAI</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link to="/results" className={linkCls(location.pathname === '/results')}>
            Mis validaciones
          </Link>
          {isAdmin && (
            <Link to="/admin" className={linkCls(location.pathname.startsWith('/admin'))}>
              Admin
            </Link>
          )}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cerrar sesión
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="sm:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
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

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1 shadow-lg">
          <Link to="/results" className={linkCls(location.pathname === '/results')}>
            Mis validaciones
          </Link>
          {isAdmin && (
            <Link to="/admin" className={linkCls(location.pathname.startsWith('/admin'))}>
              Admin
            </Link>
          )}
          <div className="pt-1 border-t border-gray-100 mt-1">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
