import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, Rocket, Settings, Shield, LogOut, X, ClipboardList, Code2, Radar, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { markDeliberateLogout } from '@/lib/session';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier } from '@/hooks/useUserTier';
import { useUsage } from '@/hooks/useUsage';
import { useAdminRole } from '@/hooks/useAdminRole';
import { UsageBar } from '@/components/shared/UsageBar';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

const TIER_LABEL: Record<string, string> = {
  free: 'Free', basic: 'Basic', pro: 'Pro', premium: 'Premium',
};
const TIER_CLS: Record<string, string> = {
  free: 'bg-gray-500/10 text-gray-400',
  basic: 'bg-sky-500/10 text-sky-400',
  pro: 'bg-indigo-500/10 text-indigo-400',
  premium: 'bg-violet-500/10 text-violet-400',
};

const NAV_ITEMS = [
  { label: 'Inicio', path: '/dashboard', Icon: Home },
  { label: 'Mis Validaciones', path: '/results', Icon: BarChart2 },
  { label: 'Inteligencia de Mercado', path: '/market-intelligence', Icon: Radar },
  { label: 'Encuestas', path: '/surveys', Icon: ClipboardList },
  { label: 'Mi Startup', path: '/startup', Icon: Rocket },
  { label: 'Configuración', path: '/profile', Icon: Settings },
] as const;

import { isBralidusDomain } from '@/lib/domain';
import { Zap, Database, Brain, Play, Key, Server, Layers } from 'lucide-react';

const BRALIDUS_NAV_ITEMS = [
  { label: 'Dashboard RaaS', path: '/developers?tab=overview', tab: 'overview', Icon: Layers },
  { label: 'Costos Bralidus', path: '/developers?tab=costs', tab: 'costs', Icon: Zap },
  { label: 'Muro Evidencias', path: '/developers?tab=evidences', tab: 'evidences', Icon: Database },
  { label: 'Cuotas & Tiers', path: '/developers?tab=quotas', tab: 'quotas', Icon: ShieldCheck },
  { label: 'Knowledge Graph', path: '/developers?tab=graph', tab: 'graph', Icon: Brain },
  { label: 'Inteligencia Macro', path: '/developers?tab=financial', tab: 'financial', Icon: BarChart2 },
  { label: 'Playground API', path: '/developers?tab=playground', tab: 'playground', Icon: Play },
  { label: 'RAG Audit', path: '/developers?tab=audit', tab: 'audit', Icon: ShieldCheck },
  { label: 'API Keys', path: '/developers?tab=apikeys', tab: 'apikeys', Icon: Key },
  { label: 'Servicios', path: '/developers?tab=services', tab: 'services', Icon: Server },
] as const;

function SidebarLogo() {
  const isBralidus = isBralidusDomain() || window.location.pathname.startsWith('/developers') || window.location.pathname.startsWith('/bralidus');
  return (
    <Link to={isBralidus ? '/developers' : '/dashboard'} className="flex items-center gap-2.5 group">
      <svg viewBox="0 0 500 500" className="w-7 h-7 shrink-0 group-hover:scale-105 transition-transform" aria-hidden="true">
        <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white" />
        <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6" />
        <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6" />
      </svg>
      <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] tracking-tight">
        {isBralidus ? 'Bralidus' : 'Validus'}
      </span>
      {isBralidus && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0EB5C6]/10 text-[#0EB5C6] border border-[#0EB5C6]/20">
          MoE RaaS
        </span>
      )}
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
  const { usage, limits, remaining } = useUsage(tier);
  const { isAdmin } = useAdminRole(); // multi-admin (Fase 3B)
  const [userName, setUserName] = useState('');

  const isBralidusMode = isBralidusDomain() || location.pathname.startsWith('/developers') || location.pathname.startsWith('/bralidus');
  const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const name =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split('@')[0] ??
        '';
      setUserName(name);
    });
  }, []);

  const handleLogout = async () => {
    markDeliberateLogout();
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
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${active
      ? 'bg-[#0EB5C6]/10 text-[#0EB5C6] dark:text-[#A99FF9]'
      : 'text-gray-600 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
    }`;

  const iconCls = (active: boolean) =>
    `w-4 h-4 shrink-0 ${active
      ? 'text-[#0EB5C6]'
      : 'text-gray-400 dark:text-[#afaebb] group-hover:text-gray-600 dark:group-hover:text-[#8B8AA0]'
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
        {isBralidusMode ? (
          <>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#8B8AA0] mb-2">
              Bralidus Engine
            </p>
            {BRALIDUS_NAV_ITEMS.map(({ label, path, tab, Icon }) => {
              const active = currentTab === tab;
              return (
                <Link key={path} to={path} onClick={onClose} className={navCls(active)} aria-current={active ? 'page' : undefined}>
                  <Icon className={iconCls(active)} />
                  <span className="flex-1">{label}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-[#0EB5C6] shrink-0" aria-hidden="true" />}
                </Link>
              );
            })}
          </>
        ) : (
          NAV_ITEMS.map(({ label, path, Icon }) => {
            const active = isActive(path);
            return (
              <Link key={path} to={path} onClick={onClose} className={navCls(active)} aria-current={active ? 'page' : undefined}>
                <Icon className={iconCls(active)} />
                <span className="flex-1">{label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-[#0EB5C6] shrink-0" aria-hidden="true" />}
              </Link>
            );
          })
        )}

        {isAdmin && !isBralidusMode && (
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
            <Link
              to="/developers"
              onClick={onClose}
              className={navCls(isActive('/developers'))}
            >
              <Code2 className={iconCls(isActive('/developers'))} />
              <span className="flex-1">Bralidus Portal</span>
            </Link>
          </>
        )}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-gray-100 dark:border-white/[0.06] shrink-0 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-[#0EB5C6] flex items-center justify-center text-white text-xs font-bold shrink-0">
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

        {/* UsageBar: solo visible en free y basic — pro/premium son prácticamente ilimitados.
            Fuente única (useUsage → get_usage_summary), compartida con /dashboard vía <UsageBar>. */}
        {(tier === 'free' || tier === 'basic') && (
          <div className="mx-1 mt-1">
            <UsageBar
              used={usage?.total ?? 0}
              limit={limits.total}
              remaining={remaining}
              resetAt={usage?.reset_at}
              variant="muted"
            >
              {tier === 'free' && remaining <= 1 && (
                <Link
                  to="/profile"
                  onClick={onClose}
                  className="block mt-2 text-center text-[10px] font-bold text-[#0EB5C6] hover:underline"
                >
                  Actualizar plan →
                </Link>
              )}
            </UsageBar>
          </div>
        )}

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
          className="block text-center text-[10px] text-gray-400 dark:text-[#afaebb] hover:text-[#0EB5C6] dark:hover:text-[#0EB5C6] transition-colors py-1"
        >
          Política de privacidad
        </Link>
      </div>
    </div>
  );
}
