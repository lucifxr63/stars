import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, Rocket, Settings, Shield, LogOut, X, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier } from '@/hooks/useUserTier';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

const ADMIN_EMAIL = 'lucianoalonso2000@gmail.com';

const TIER_LABEL: Record<string, string> = {
  free: 'Free', basic: 'Basic', pro: 'Pro', premium: 'Premium',
};
const TIER_CLS: Record<string, string> = {
  free:    'bg-gray-500/10 text-gray-400',
  basic:   'bg-sky-500/10 text-sky-400',
  pro:     'bg-indigo-500/10 text-indigo-400',
  premium: 'bg-violet-500/10 text-violet-400',
};

const NAV_ITEMS = [
  { label: 'Inicio',           path: '/dashboard', Icon: Home },
  { label: 'Mis Validaciones', path: '/results',   Icon: BarChart2 },
  { label: 'Encuestas',        path: '/surveys',   Icon: ClipboardList },
  { label: 'Mi Startup',       path: '/startup',   Icon: Rocket },
  { label: 'Configuración',    path: '/profile',   Icon: Settings },
] as const;

function SidebarLogo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5 group">
      <svg viewBox="0 0 338 426" className="w-6 h-8 shrink-0 group-hover:scale-105 transition-transform" aria-hidden="true">
        <path d="M111 187 A78 78 0 0 1 168 123" fill="none" className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt"/>
        <path d="M213 123 A78 78 0 0 1 271 187" fill="none" className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt"/>
        <path d="M66 198 H118 L169 292 L220 198 H272 L169 358 Z" className="fill-[#001431] dark:fill-white"/>
        <path d="M134 252 L152 252 L169 286 L187 252 L205 252 L169 324 Z" className="fill-white dark:fill-[#0A0A0F]"/>
        <path d="M155 253 L169 279 L192 253 L200 263 L169 303 L148 263 Z" className="fill-[#001431] dark:fill-white"/>
        <path d="M169 68 L193 257 L169 237 L156 254 Z" className="fill-[#ff2b23] dark:fill-[#7C6FF7]"/>
      </svg>
      <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] tracking-tight">Validus</span>
    </Link>
  );
}

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const reset = useValidationStore((s) => s.reset);
  const { tier } = useUserTier();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      setIsAdmin(user.email === ADMIN_EMAIL);
      const name =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split('@')[0] ??
        '';
      setUserName(name);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    reset();
    toast.success('Sesión cerrada');
    navigate('/');
  };

  const isActive = (path: string) =>
    path === '/results'
      ? location.pathname === '/results' || location.pathname.startsWith('/results/')
      : location.pathname === path || location.pathname.startsWith(path + '/');

  const navCls = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
      active
        ? 'bg-[#7C6FF7]/10 text-[#7C6FF7] dark:text-[#A99FF9]'
        : 'text-gray-600 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
    }`;

  const iconCls = (active: boolean) =>
    `w-4 h-4 shrink-0 ${
      active
        ? 'text-[#7C6FF7]'
        : 'text-gray-400 dark:text-[#4A495E] group-hover:text-gray-600 dark:group-hover:text-[#8B8AA0]'
    }`;

  return (
    <div className="flex flex-col h-full select-none">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-100 dark:border-white/[0.06] shrink-0">
        <SidebarLogo />
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, path, Icon }) => {
          const active = isActive(path);
          return (
            <Link key={path} to={path} onClick={onClose} className={navCls(active)}>
              <Icon className={iconCls(active)} />
              <span className="flex-1">{label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF7] shrink-0" />}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-2 border-t border-gray-100 dark:border-white/[0.06]" />
            <Link
              to="/admin"
              onClick={onClose}
              className={navCls(isActive('/admin'))}
            >
              <Shield className={iconCls(isActive('/admin'))} />
              <span className="flex-1">Admin</span>
            </Link>
          </>
        )}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-gray-100 dark:border-white/[0.06] shrink-0 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-[#7C6FF7] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {userName ? userName[0].toUpperCase() : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-900 dark:text-[#F0EFF8] truncate leading-tight">
              {userName || 'Usuario'}
            </p>
            <span className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-bold ${TIER_CLS[tier] ?? TIER_CLS.free}`}>
              {TIER_LABEL[tier] ?? 'Free'}
            </span>
          </div>
          <ThemeToggle />
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Cerrar sesión
        </button>

        <Link
          to="/privacy-policy"
          onClick={onClose}
          className="block text-center text-[10px] text-gray-400 dark:text-[#4A495E] hover:text-[#7C6FF7] dark:hover:text-[#7C6FF7] transition-colors py-1"
        >
          Política de privacidad
        </Link>
      </div>
    </div>
  );
}
