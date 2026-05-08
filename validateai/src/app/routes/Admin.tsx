import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
const DataStoryEngine = lazy(() => import('@/components/admin/DataStoryEngine'));
const FigmaAdminPanel = lazy(() => import('@/components/figma/FigmaAdminPanel').then(m => ({ default: m.FigmaAdminPanel })));
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '@/lib/supabase';

const ADMIN_EMAIL = 'lucianoalonso2000@gmail.com';
const COLORS = ['#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

type Tab = 'metrics' | 'users' | 'validations' | 'ai' | 'health' | 'content' | 'figma';
type StatusFilter = 'all' | 'completed' | 'in_progress' | 'archived';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  tier: string | null;
  created_at: string;
  validations_count?: number;
}

interface Validation {
  id: string;
  user_id: string;
  idea_name: string | null;
  idea_description: string | null;
  idea_industry: string | null;
  target_country: string | null;
  business_stage: string | null;
  status: string;
  validation_score: number | null;
  current_step: number;
  ai_feedback: string | null;
  summary_json: Record<string, unknown> | null;
  competitive_analysis: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

interface AiInteraction {
  id: string;
  validation_id: string;
  user_id: string;
  step: number;
  prompt_type: string | null;
  model: string;
  tokens_used: number | null;
  created_at: string;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function scoreBg(score: number | null) {
  if (score === null) return 'bg-gray-100 text-gray-400';
  if (score >= 75) return 'bg-emerald-50 text-emerald-700';
  if (score >= 50) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-600';
}

function modelBadge(model: string | null) {
  if (!model) return 'bg-gray-100 text-gray-400';
  if (model.includes('claude')) return 'bg-teal-50 text-teal-700';
  if (model.includes('gpt')) return 'bg-green-50 text-green-700';
  return 'bg-gray-100 text-gray-500';
}

function modelLabel(model: string | null) {
  if (!model) return '—';
  if (model.includes('claude')) return model.replace('claude-', '').replace(/-\d{8}$/, '');
  return model;
}

function estimateCost(interactions: AiInteraction[]) {
  let cost = 0;
  for (const a of interactions) {
    const t = a.tokens_used ?? 0;
    if (a.model?.includes('gpt-4o-mini')) cost += (t / 1_000_000) * 0.40;
    else if (a.model?.includes('gpt-4o')) cost += (t / 1_000_000) * 5;
    else cost += (t / 1_000_000) * 3; // claude sonnet default
  }
  return cost.toFixed(4);
}

function Avatar({ name, url, size = 8 }: { name: string | null; url: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold`;
  if (url) return <img src={url} alt={name ?? ''} className={`${cls} object-cover`} />;
  return (
    <div className={`${cls} bg-teal-100 text-teal-700`}>
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  );
}

function KPI({ label, value, sub, icon, accent = '#14b8a6', trend }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; accent?: string;
  trend?: { value: number; label: string };
}) {
  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accent + '18' }}>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8] leading-none">{value}</p>
        <div className="flex items-center gap-2 mt-1">
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
          {trend && (
            <span className={`text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)} {trend.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children, className = '', action }: {
  title: string; children: React.ReactNode; className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 dark:text-[#C4C4D4]">{title}</h3>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'metrics', label: 'Métricas',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    id: 'users', label: 'Usuarios',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    id: 'validations', label: 'Validaciones',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    id: 'ai', label: 'AI Usage',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  },
  {
    id: 'health', label: 'Sistema',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>,
  },
  {
    id: 'content', label: 'Contenido',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    id: 'figma', label: 'Figma',
    icon: <svg className="w-4 h-4" viewBox="0 0 38 57" fill="currentColor"><path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" opacity=".9"/><path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" opacity=".5"/><path d="M19 0v19h9.5a9.5 9.5 0 0 0 0-19H19z" opacity=".7"/><path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" opacity=".6"/><path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" opacity=".8"/></svg>,
  },
];

function PaginationBar({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-white/5 text-xs text-gray-400">
      <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}</span>
      <div className="flex gap-1">
        <button
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5 transition"
        >← Prev</button>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5 transition"
        >Next →</button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('metrics');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [validations, setValidations] = useState<Validation[]>([]);
  const [aiInteractions, setAiInteractions] = useState<AiInteraction[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [valPage, setValPage] = useState(0);
  const [valTotal, setValTotal] = useState(0);
  const [aiPage, setAiPage] = useState(0);
  const [aiTotal, setAiTotal] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email !== ADMIN_EMAIL) navigate('/validate', { replace: true });
    });
  }, [navigate]);

  const load = useCallback(async (vPage = 0, aPage = 0) => {
    setLoading(true);
    const vFrom = vPage * PAGE_SIZE;
    const aFrom = aPage * PAGE_SIZE;

    const [{ data: profs }, { data: vals, count: vCount }, { data: ais, count: aCount }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('validations')
        .select('*, profile:profiles(full_name, avatar_url)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(vFrom, vFrom + PAGE_SIZE - 1),
      supabase.from('ai_interactions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(aFrom, aFrom + PAGE_SIZE - 1),
    ]);

    const enriched = (profs ?? []).map((p: Profile) => ({
      ...p,
      validations_count: (vals ?? []).filter((v: Validation) => v.user_id === p.id).length,
    }));
    setProfiles(enriched);
    setValidations(vals ?? []);
    setValTotal(vCount ?? 0);
    setAiInteractions(ais ?? []);
    setAiTotal(aCount ?? 0);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(valPage, aiPage); }, [load, valPage, aiPage]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const completed = validations.filter(v => v.status === 'completed');
  const inProgress = validations.filter(v => v.status === 'in_progress');
  const avgScore = completed.length
    ? Math.round(completed.reduce((s, v) => s + (v.validation_score ?? 0), 0) / completed.length)
    : 0;
  const completionRate = validations.length ? Math.round((completed.length / validations.length) * 100) : 0;
  const totalTokens = aiInteractions.reduce((s, a) => s + (a.tokens_used ?? 0), 0);

  // Usuarios nuevos esta semana
  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const usersThisWeek = profiles.filter(p => new Date(p.created_at) >= oneWeekAgo).length;
  const prevWeekStart = new Date(); prevWeekStart.setDate(prevWeekStart.getDate() - 14);
  const usersLastWeek = profiles.filter(p => {
    const d = new Date(p.created_at);
    return d >= prevWeekStart && d < oneWeekAgo;
  }).length;
  const userTrend = usersThisWeek - usersLastWeek;

  // Validaciones por día — últimos 14 días
  const valsByDay = (() => {
    const map: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    validations.forEach(v => { const k = v.created_at.slice(0, 10); if (k in map) map[k]++; });
    return Object.entries(map).map(([date, count]) => ({ date: date.slice(5), count }));
  })();

  // Tokens por día — últimos 14 días
  const tokensByDay = (() => {
    const map: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    aiInteractions.forEach(a => { const k = a.created_at.slice(0, 10); if (k in map) map[k] += (a.tokens_used ?? 0); });
    return Object.entries(map).map(([date, tokens]) => ({ date: date.slice(5), tokens }));
  })();

  // Score dist
  const scoreDist = [
    { label: '0–25', count: completed.filter(v => (v.validation_score ?? 0) <= 25).length },
    { label: '26–50', count: completed.filter(v => (v.validation_score ?? 0) > 25 && (v.validation_score ?? 0) <= 50).length },
    { label: '51–75', count: completed.filter(v => (v.validation_score ?? 0) > 50 && (v.validation_score ?? 0) <= 75).length },
    { label: '76–100', count: completed.filter(v => (v.validation_score ?? 0) > 75).length },
  ];

  // Industrias
  const indMap: Record<string, number> = {};
  validations.forEach(v => { const k = v.idea_industry ?? 'Sin categoría'; indMap[k] = (indMap[k] ?? 0) + 1; });
  const industries = Object.entries(indMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

  // Países
  const countryMap: Record<string, number> = {};
  validations.forEach(v => { if (v.target_country) { countryMap[v.target_country] = (countryMap[v.target_country] ?? 0) + 1; } });
  const countries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

  // Etapas
  const stageMap: Record<string, number> = {};
  validations.forEach(v => { if (v.business_stage) { stageMap[v.business_stage] = (stageMap[v.business_stage] ?? 0) + 1; } });
  const stages = Object.entries(stageMap).sort((a, b) => b[1] - a[1]).map(([stage, count]) => ({ stage, count }));

  // AI por step
  const stepMap: Record<number, number> = {};
  aiInteractions.forEach(a => { stepMap[a.step] = (stepMap[a.step] ?? 0) + 1; });
  const byStep = Object.entries(stepMap).sort((a, b) => +a[0] - +b[0]).map(([step, count]) => ({ step: `S${step}`, count }));

  // Predicción
  const avg7 = valsByDay.slice(-7).reduce((s, d) => s + d.count, 0) / 7;
  const projected30 = Math.round(avg7 * 30);

  // Filtro de validaciones
  const filteredValidations = statusFilter === 'all' ? validations : validations.filter(v => v.status === statusFilter);

  // ── Sistema / Health ──────────────────────────────────────────────────────

  // Funnel de wizard
  const wizardFunnel = [
    { step: 'Iniciaron', count: validations.length },
    { step: 'Paso 1', count: validations.filter(v => v.current_step >= 1).length },
    { step: 'Paso 2', count: validations.filter(v => v.current_step >= 2).length },
    { step: 'Paso 3', count: validations.filter(v => v.current_step >= 3).length },
    { step: 'Completaron', count: completed.length },
  ];

  // Distribución de tiers
  const tierCounts = { free: 0, basic: 0, pro: 0 };
  profiles.forEach(p => {
    const t = (p.tier ?? 'free') as keyof typeof tierCounts;
    if (t in tierCounts) tierCounts[t]++;
    else tierCounts.free++;
  });
  const tierDist = [
    { name: 'Free', value: tierCounts.free, color: '#9ca3af' },
    { name: 'Basic', value: tierCounts.basic, color: '#f59e0b' },
    { name: 'Pro', value: tierCounts.pro, color: '#8b5cf6' },
  ];

  // Prompt types más usados
  const promptMap: Record<string, { count: number; tokens: number }> = {};
  aiInteractions.forEach(a => {
    const k = a.prompt_type ?? 'unknown';
    if (!promptMap[k]) promptMap[k] = { count: 0, tokens: 0 };
    promptMap[k].count++;
    promptMap[k].tokens += a.tokens_used ?? 0;
  });
  const topPrompts = Object.entries(promptMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([type, { count, tokens }]) => ({ type, count, tokens }));

  // Distribución de modelos
  const modelMap: Record<string, number> = {};
  aiInteractions.forEach(a => {
    const k = modelLabel(a.model) || 'unknown';
    modelMap[k] = (modelMap[k] ?? 0) + 1;
  });
  const modelDist = Object.entries(modelMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

  // Top usuarios por tokens
  const userTokenMap: Record<string, { tokens: number; calls: number; name: string }> = {};
  aiInteractions.forEach(a => {
    if (!a.user_id) return;
    if (!userTokenMap[a.user_id]) {
      const prof = profiles.find(p => p.id === a.user_id);
      userTokenMap[a.user_id] = { tokens: 0, calls: 0, name: prof?.full_name ?? a.user_id.slice(0, 8) };
    }
    userTokenMap[a.user_id].tokens += a.tokens_used ?? 0;
    userTokenMap[a.user_id].calls++;
  });
  const topUsers = Object.values(userTokenMap)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5);

  // Paso de mayor abandono
  const abandonStep = (() => {
    let maxDrop = 0; let dropStep = '—';
    for (let i = 0; i < wizardFunnel.length - 1; i++) {
      const drop = wizardFunnel[i].count - wizardFunnel[i + 1].count;
      if (drop > maxDrop) { maxDrop = drop; dropStep = `${wizardFunnel[i].step} → ${wizardFunnel[i + 1].step}`; }
    }
    return dropStep;
  })();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0F]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex">
      {/* ── Sidebar — hidden en móvil ─────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 bg-gray-900 flex-shrink-0 flex-col min-h-screen sticky top-0 h-screen">
        <div className="px-5 py-6 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-none">ValidateAI</p>
              <p className="text-gray-500 dark:text-[#8B8AA0] text-xs mt-0.5">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === item.id
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white dark:bg-[#12121A]/10'
              }`}
            >
              {item.icon}
              {item.label}
              {item.id === 'users' && (
                <span className="ml-auto text-xs bg-white dark:bg-[#12121A]/10 px-1.5 py-0.5 rounded-full">{profiles.length}</span>
              )}
              {item.id === 'validations' && (
                <span className="ml-auto text-xs bg-white dark:bg-[#12121A]/10 px-1.5 py-0.5 rounded-full">{validations.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-200 dark:border-white/10 space-y-2">
          <p className="text-xs text-gray-600 dark:text-[#8B8AA0] px-1">
            {lastRefresh.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button
            onClick={() => void load()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white dark:bg-[#12121A]/10 transition-all font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
          <button
            onClick={() => navigate('/validate')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white dark:bg-[#12121A]/10 transition-all font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver a la app
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="bg-white dark:bg-[#12121A] border-b border-gray-100 dark:border-white/5 px-4 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-black text-gray-900 dark:text-[#F0EFF8]">
              {NAV_ITEMS.find(n => n.id === tab)?.label}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {tab === 'metrics' && `${validations.length} validaciones · ${profiles.length} usuarios`}
              {tab === 'users' && `${profiles.length} usuarios · ${usersThisWeek} esta semana`}
              {tab === 'validations' && `${completed.length} completadas · ${inProgress.length} en progreso`}
              {tab === 'ai' && `${aiInteractions.length} interacciones · ${totalTokens.toLocaleString()} tokens`}
              {tab === 'health' && `Funnel · Tiers · Prompts · Modelos`}
              {tab === 'content' && 'Genera imágenes + copy para LinkedIn'}
              {tab === 'figma' && 'Conecta tu cuenta y escanea el mapa de navegación de tus prototipos'}
            </p>
          </div>
        </div>

        <div className="px-4 md:px-8 py-4 md:py-6 space-y-4 md:space-y-6 pb-24 lg:pb-6">

          {/* ══ MÉTRICAS ═══════════════════════════════════════════════════ */}
          {tab === 'metrics' && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                <KPI
                  label="Usuarios"
                  value={profiles.length}
                  sub="registrados"
                  accent="#14b8a6"
                  trend={{ value: userTrend, label: 'vs sem. ant.' }}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                />
                <KPI
                  label="Validaciones"
                  value={validations.length}
                  sub={`${completed.length} completadas`}
                  accent="#8b5cf6"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <KPI
                  label="Score promedio"
                  value={completed.length ? `${avgScore} pts` : '—'}
                  sub={completed.length ? 'en completadas' : 'Sin completadas aún'}
                  accent="#f59e0b"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                />
                <KPI
                  label="Completitud"
                  value={`${completionRate}%`}
                  sub="del total iniciado"
                  accent="#ef4444"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                />
              </div>

              {/* Predicción */}
              <div className="bg-gray-900 rounded-2xl p-4 md:p-6">
                <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-widest mb-4">Predicción — próximos 30 días</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <p className="text-3xl md:text-4xl font-black text-teal-400">{projected30}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-1.5">validaciones proyectadas</p>
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-black text-violet-400">{Math.round(projected30 * completionRate / 100)}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-1.5">completadas proyectadas</p>
                  </div>
                  <div>
                    <p className="text-3xl md:text-4xl font-black text-amber-400">{avg7.toFixed(1)}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-1.5">validaciones/día (prom. 7d)</p>
                  </div>
                </div>
                <p className="text-xs text-gray-700 dark:text-[#C4C4D4] mt-5">Basado en promedio últimos 7 días × 30.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Card title="Validaciones por día — últimos 14 días">
                  <ResponsiveContainer width="100%" height={210}>
                    <LineChart data={valsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                      <Line type="monotone" dataKey="count" stroke="#14b8a6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card title="Distribución de scores">
                  {completed.length === 0 ? (
                    <div className="h-[210px] flex items-center justify-center text-sm text-gray-300">Sin validaciones completadas aún</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={scoreDist} barCategoryGap="35%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Industrias más validadas">
                  {industries.length === 0 ? (
                    <div className="h-[180px] flex items-center justify-center text-sm text-gray-300">Sin datos aún</div>
                  ) : (
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width="45%" height={180}>
                        <PieChart>
                          <Pie data={industries} dataKey="value" cx="50%" cy="50%" outerRadius={72} innerRadius={36} paddingAngle={3}>
                            {industries.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2.5">
                        {industries.map((ind, i) => (
                          <div key={ind.name} className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="text-xs text-gray-500 dark:text-[#8B8AA0] flex-1 truncate">{ind.name}</span>
                            <span className="text-xs font-bold text-gray-800 dark:text-[#F0EFF8]">{ind.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                <Card title="Validaciones por país">
                  {countries.length === 0 ? (
                    <div className="h-[180px] flex items-center justify-center text-sm text-gray-300">Sin datos aún</div>
                  ) : (
                    <div className="space-y-2.5">
                      {countries.map((c, i) => (
                        <div key={c.name} className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-gray-500 dark:text-[#8B8AA0] flex-1 truncate">{c.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(c.value / (countries[0]?.value ?? 1)) * 100}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                            <span className="text-xs font-bold text-gray-700 dark:text-[#C4C4D4] w-4 text-right">{c.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card title="Validaciones por etapa">
                  {stages.length === 0 ? (
                    <div className="h-[180px] flex items-center justify-center text-sm text-gray-300">Sin datos aún</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={stages} barCategoryGap="35%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Interacciones AI por step">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={byStep} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="step" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                      <Bar dataKey="count" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </>
          )}

          {/* ══ USUARIOS ═══════════════════════════════════════════════════ */}
          {tab === 'users' && (
            <>
              <div className="grid grid-cols-3 gap-3 md:gap-4">
                {tierDist.map(t => (
                  <KPI key={t.name} label={`Plan ${t.name}`} value={t.value}
                    sub={profiles.length ? `${Math.round((t.value / profiles.length) * 100)}% del total` : '—'}
                    accent={t.color}
                    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
                  />
                ))}
              </div>
              <Card title={`${profiles.length} usuarios`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/5">
                        {['Usuario', 'Tier', 'Validaciones', 'Esta semana', 'Registro'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-8 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {profiles.map(p => {
                        const userValsThisWeek = validations.filter(v =>
                          v.user_id === p.id && new Date(v.created_at) >= oneWeekAgo
                        ).length;
                        const tier = p.tier ?? 'free';
                        const tierColor = tier === 'pro' ? 'bg-violet-50 text-violet-700'
                          : tier === 'basic' ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-100 text-gray-500';
                        return (
                          <tr key={p.id} className="hover:bg-gray-50 dark:bg-[#0A0A0F]/50 transition">
                            <td className="py-3.5 pr-8">
                              <div className="flex items-center gap-3">
                                <Avatar name={p.full_name} url={p.avatar_url} size={8} />
                                <span className="font-medium text-gray-900 dark:text-[#F0EFF8]">
                                  {p.full_name ?? <span className="text-gray-300 font-normal italic">Sin nombre</span>}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 pr-8">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${tierColor}`}>{tier}</span>
                            </td>
                            <td className="py-3.5 pr-8">
                              <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${
                                (p.validations_count ?? 0) > 0 ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                              }`}>
                                {p.validations_count}
                              </span>
                            </td>
                            <td className="py-3.5 pr-8">
                              {userValsThisWeek > 0 ? (
                                <span className="text-xs font-semibold text-emerald-600">+{userValsThisWeek}</span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-3.5 text-xs text-gray-400">{fmt(p.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {profiles.length === 0 && (
                    <p className="text-sm text-gray-300 text-center py-12">Sin usuarios registrados aún</p>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* ══ VALIDACIONES ═══════════════════════════════════════════════ */}
          {tab === 'validations' && (
            <Card
              title={`${filteredValidations.length} validaciones`}
              action={
                <div className="flex gap-1">
                  {(['all', 'completed', 'in_progress', 'archived'] as StatusFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        statusFilter === f ? 'bg-gray-900 text-white' : 'text-gray-400 hover:bg-gray-100 dark:bg-white/5'
                      }`}
                    >
                      {f === 'all' ? 'Todas' : f === 'completed' ? 'Completas' : f === 'in_progress' ? 'En progreso' : 'Archivadas'}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/5">
                      {['Idea', 'Usuario', 'Industria', 'País', 'Etapa', 'Estado', 'Score', 'Progreso', 'Fecha', ''].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredValidations.map(v => {
                      const prof = v.profile as { full_name: string | null; avatar_url: string | null } | null;
                      const displayName = v.idea_name
                        ?? (v.idea_description ? v.idea_description.slice(0, 40) + '…' : null);
                      const isExpanded = expandedRow === v.id;
                      return (
                        <>
                          <tr
                            key={v.id}
                            className="hover:bg-gray-50 dark:bg-[#0A0A0F]/50 transition border-t border-gray-50 cursor-pointer"
                            onClick={() => setExpandedRow(isExpanded ? null : v.id)}
                          >
                            <td className="py-3.5 pr-4 font-medium text-gray-900 dark:text-[#F0EFF8] max-w-[160px] truncate">
                              {displayName ?? <span className="text-gray-300 font-normal italic">Sin nombre</span>}
                            </td>
                            <td className="py-3.5 pr-4">
                              <div className="flex items-center gap-2">
                                <Avatar name={prof?.full_name ?? null} url={prof?.avatar_url ?? null} size={6} />
                                <span className="text-gray-500 dark:text-[#8B8AA0] text-xs truncate max-w-[90px]">
                                  {prof?.full_name ?? <span className="text-gray-300">—</span>}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 pr-4 text-gray-400 text-xs max-w-[110px] truncate">
                              {v.idea_industry ?? '—'}
                            </td>
                            <td className="py-3.5 pr-4 text-gray-400 text-xs whitespace-nowrap">
                              {v.target_country ?? '—'}
                            </td>
                            <td className="py-3.5 pr-4">
                              {v.business_stage ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium whitespace-nowrap">
                                  {v.business_stage}
                                </span>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="py-3.5 pr-4">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                                v.status === 'completed' ? 'bg-emerald-50 text-emerald-700'
                                : v.status === 'archived' ? 'bg-gray-100 dark:bg-white/5 text-gray-400'
                                : 'bg-amber-50 text-amber-600'
                              }`}>
                                {v.status === 'completed' ? 'Completa' : v.status === 'archived' ? 'Archivada' : 'En progreso'}
                              </span>
                            </td>
                            <td className="py-3.5 pr-4">
                              {v.validation_score !== null ? (
                                <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${scoreBg(v.validation_score)}`}>
                                  {v.validation_score}
                                </span>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="py-3.5 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-teal-400 rounded-full" style={{ width: `${(v.current_step / 6) * 100}%` }} />
                                </div>
                                <span className="text-xs text-gray-400">{v.current_step}/6</span>
                              </div>
                            </td>
                            <td className="py-3.5 pr-4 text-xs text-gray-400 whitespace-nowrap">{fmt(v.created_at)}</td>
                            <td className="py-3.5">
                              <svg className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${v.id}-expanded`} className="bg-gray-50 dark:bg-[#0A0A0F]/70">
                              <td colSpan={10} className="px-4 py-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {v.ai_feedback && (
                                    <div>
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Feedback AI</p>
                                      <p className="text-xs text-gray-600 dark:text-[#8B8AA0] leading-relaxed line-clamp-6">{v.ai_feedback}</p>
                                    </div>
                                  )}
                                  {v.summary_json && (
                                    <div>
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Summary JSON</p>
                                      <pre className="text-xs text-gray-500 dark:text-[#8B8AA0] bg-white dark:bg-[#12121A] rounded-xl p-3 overflow-auto max-h-40 border border-gray-100 dark:border-white/5">
                                        {JSON.stringify(v.summary_json, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {v.competitive_analysis && (
                                    <div className="col-span-2">
                                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Análisis competitivo</p>
                                      <pre className="text-xs text-gray-500 dark:text-[#8B8AA0] bg-white dark:bg-[#12121A] rounded-xl p-3 overflow-auto max-h-48 border border-gray-100 dark:border-white/5">
                                        {JSON.stringify(v.competitive_analysis, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {!v.ai_feedback && !v.summary_json && !v.competitive_analysis && (
                                    <p className="text-xs text-gray-300 col-span-2">Sin datos adicionales</p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
                {filteredValidations.length === 0 && (
                  <p className="text-sm text-gray-300 text-center py-12">Sin validaciones en este filtro</p>
                )}
              </div>
              <PaginationBar
                page={valPage} total={valTotal} pageSize={PAGE_SIZE}
                onChange={(p) => setValPage(p)}
              />
            </Card>
          )}

          {/* ══ AI USAGE ═══════════════════════════════════════════════════ */}
          {tab === 'ai' && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                <KPI label="Interacciones" value={aiInteractions.length} accent="#14b8a6"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
                <KPI label="Tokens usados" value={totalTokens.toLocaleString()} accent="#8b5cf6"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>}
                />
                <KPI label="Costo estimado" value={`$${estimateCost(aiInteractions)}`} sub="por modelo real" accent="#f59e0b"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <KPI label="Prom. tokens" value={aiInteractions.length ? Math.round(totalTokens / aiInteractions.length).toLocaleString() : 0} sub="por interacción" accent="#ef4444"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                />
              </div>

              <Card title="Tokens por día — últimos 14 días">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={tokensByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                    <Line type="monotone" dataKey="tokens" stroke="#8b5cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Top prompt types — tokens acumulados">
                {topPrompts.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center text-sm text-gray-300">Sin datos aún</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, topPrompts.length * 32)}>
                    <BarChart data={topPrompts} layout="vertical" barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <YAxis type="category" dataKey="type" tick={{ fontSize: 10, fill: '#9ca3af' }} width={130} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
                        formatter={(val: unknown, name: unknown) => [(val as number)?.toLocaleString() ?? '0', name === 'tokens' ? 'Tokens' : 'Llamadas']}
                      />
                      <Bar dataKey="tokens" fill="#8b5cf6" radius={[0, 6, 6, 0]} name="tokens" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card title="Interacciones recientes">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/5">
                        {['Validación', 'Tipo de prompt', 'Modelo', 'Tokens', 'Fecha'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-6">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {aiInteractions.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50 dark:bg-[#0A0A0F]/50 transition">
                          <td className="py-3.5 pr-6 font-mono text-xs text-gray-300">{a.validation_id.slice(0, 8)}…</td>
                          <td className="py-3.5 pr-6">
                            <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-[#8B8AA0] font-mono">
                              {a.prompt_type ?? `step ${a.step}`}
                            </span>
                          </td>
                          <td className="py-3.5 pr-6">
                            <span className={`text-xs px-2 py-1 rounded-lg font-mono ${modelBadge(a.model)}`}>
                              {modelLabel(a.model)}
                            </span>
                          </td>
                          <td className="py-3.5 pr-6 font-semibold text-gray-800 dark:text-[#F0EFF8]">{a.tokens_used?.toLocaleString() ?? '—'}</td>
                          <td className="py-3.5 text-xs text-gray-400 whitespace-nowrap">{fmt(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {aiInteractions.length === 0 && (
                    <p className="text-sm text-gray-300 text-center py-12">Sin interacciones AI aún</p>
                  )}
                </div>
                <PaginationBar
                  page={aiPage} total={aiTotal} pageSize={PAGE_SIZE}
                  onChange={(p) => setAiPage(p)}
                />
              </Card>
            </>
          )}
          {/* ══ SISTEMA / HEALTH ══════════════════════════════════════════════ */}
          {tab === 'health' && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                <KPI
                  label="Tasa de completitud"
                  value={`${completionRate}%`}
                  sub="wizard completo"
                  accent="#14b8a6"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <KPI
                  label="Mayor abandono"
                  value={abandonStep}
                  sub="punto de drop más alto"
                  accent="#ef4444"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
                />
                <KPI
                  label="Modelo dominante"
                  value={modelDist[0]?.name ?? '—'}
                  sub={modelDist[0] ? `${modelDist[0].value} llamadas` : 'Sin datos'}
                  accent="#8b5cf6"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
                <KPI
                  label="Prompt más llamado"
                  value={topPrompts[0]?.type ?? '—'}
                  sub={topPrompts[0] ? `${topPrompts[0].count} veces` : 'Sin datos'}
                  accent="#f59e0b"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>}
                />
              </div>

              {/* Funnel + Tiers */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Card title="Funnel de wizard">
                  {validations.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-sm text-gray-300">Sin validaciones aún</div>
                  ) : (
                    <div className="space-y-3 py-2">
                      {wizardFunnel.map((f, i) => {
                        const pct = wizardFunnel[0].count > 0 ? Math.round((f.count / wizardFunnel[0].count) * 100) : 0;
                        const dropPct = i > 0 && wizardFunnel[i - 1].count > 0
                          ? Math.round(((wizardFunnel[i - 1].count - f.count) / wizardFunnel[i - 1].count) * 100)
                          : null;
                        return (
                          <div key={f.step}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-gray-600 dark:text-[#C4C4D4]">{f.step}</span>
                              <div className="flex items-center gap-3">
                                {dropPct !== null && dropPct > 0 && (
                                  <span className="text-xs text-red-400 font-medium">↓ {dropPct}% abandono</span>
                                )}
                                <span className="text-xs font-black text-gray-900 dark:text-[#F0EFF8] w-16 text-right">
                                  {f.count} <span className="font-normal text-gray-400">({pct}%)</span>
                                </span>
                              </div>
                            </div>
                            <div className="h-2.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pct}%`,
                                  background: i === wizardFunnel.length - 1 ? '#14b8a6' : COLORS[i % COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card title="Distribución de tiers">
                  {profiles.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-sm text-gray-300">Sin usuarios aún</div>
                  ) : (
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width="55%" height={200}>
                        <PieChart>
                          <Pie data={tierDist} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={44} paddingAngle={3}>
                            {tierDist.map((t, i) => <Cell key={i} fill={t.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-4">
                        {tierDist.map(t => (
                          <div key={t.name}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                                <span className="text-xs font-semibold text-gray-600 dark:text-[#C4C4D4]">{t.name}</span>
                              </div>
                              <span className="text-xs font-black text-gray-900 dark:text-[#F0EFF8]">{t.value}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${profiles.length ? (t.value / profiles.length) * 100 : 0}%`, background: t.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Prompts ranking + Modelos + Top usuarios */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Card title="Ranking de prompt types — llamadas">
                  {topPrompts.length === 0 ? (
                    <div className="h-[240px] flex items-center justify-center text-sm text-gray-300">Sin interacciones AI aún</div>
                  ) : (
                    <div className="space-y-2.5">
                      {topPrompts.map((p, i) => (
                        <div key={p.type} className="flex items-center gap-3">
                          <span className="w-5 text-xs font-black text-gray-300 text-right flex-shrink-0">{i + 1}</span>
                          <span className="text-xs font-mono text-gray-600 dark:text-[#8B8AA0] flex-1 truncate">{p.type}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-20 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-teal-400" style={{ width: `${(p.count / (topPrompts[0]?.count ?? 1)) * 100}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-700 dark:text-[#C4C4D4] w-6 text-right">{p.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card title="Distribución de modelos AI">
                  {modelDist.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-sm text-gray-300">Sin interacciones AI aún</div>
                  ) : (
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width="50%" height={180}>
                        <PieChart>
                          <Pie data={modelDist} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={32} paddingAngle={3}>
                            {modelDist.map((m, i) => <Cell key={i} fill={m.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-3">
                        {modelDist.map(m => (
                          <div key={m.name} className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                            <span className="text-xs font-mono text-gray-500 dark:text-[#8B8AA0] flex-1 truncate">{m.name}</span>
                            <span className="text-xs font-bold text-gray-800 dark:text-[#F0EFF8]">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                <Card title="Top usuarios por tokens consumidos" className="xl:col-span-2">
                  {topUsers.length === 0 ? (
                    <div className="h-[120px] flex items-center justify-center text-sm text-gray-300">Sin datos aún</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-white/5">
                            {['#', 'Usuario', 'Tokens', 'Llamadas AI', 'Tokens / llamada', 'Costo est.'].map(h => (
                              <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-8">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {topUsers.map((u, i) => {
                            const costEst = ((u.tokens / 1_000_000) * 3).toFixed(4);
                            const tokPerCall = u.calls > 0 ? Math.round(u.tokens / u.calls).toLocaleString() : '—';
                            return (
                              <tr key={u.name} className="hover:bg-gray-50 dark:bg-[#0A0A0F]/50 transition">
                                <td className="py-3.5 pr-8 text-xs font-black text-gray-300">{i + 1}</td>
                                <td className="py-3.5 pr-8 font-medium text-gray-900 dark:text-[#F0EFF8] text-xs">{u.name}</td>
                                <td className="py-3.5 pr-8 font-bold text-gray-800 dark:text-[#F0EFF8] text-sm">{u.tokens.toLocaleString()}</td>
                                <td className="py-3.5 pr-8 text-xs text-gray-400">{u.calls}</td>
                                <td className="py-3.5 pr-8 text-xs text-gray-400">{tokPerCall}</td>
                                <td className="py-3.5 text-xs font-semibold text-amber-600">${costEst}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}

          {tab === 'content' && (
            <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando motor de contenido...</div>}>
              <DataStoryEngine />
            </Suspense>
          )}
          {tab === 'figma' && (
            <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando Figma...</div>}>
              <FigmaAdminPanel />
            </Suspense>
          )}
        </div>
      </main>

      {/* ── Bottom Nav móvil ───────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-gray-900 border-t border-gray-200 dark:border-white/10 flex">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
              tab === item.id ? 'text-teal-400' : 'text-gray-500 dark:text-[#8B8AA0]'
            }`}
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
