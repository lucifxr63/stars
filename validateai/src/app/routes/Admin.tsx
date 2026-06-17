import { useEffect, useState, useCallback, lazy, Suspense, useRef } from 'react';
const ContentStudio = lazy(() => import('@/components/admin/ContentStudio').then(m => ({ default: m.ContentStudio })));
const FigmaAdminPanel = lazy(() => import('@/components/figma/FigmaAdminPanel').then(m => ({ default: m.FigmaAdminPanel })));
const SitemapPanel = lazy(() => import('@/components/admin/SitemapPanel').then(m => ({ default: m.SitemapPanel })));
import { useNavigate, Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { setPreviewTier, getPreviewTier, type UserTier } from '@/hooks/useUserTier';

const ADMIN_EMAIL = 'lucianoalonso2000@gmail.com';
const COLORS = ['#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

type Tab = 'metrics' | 'users' | 'validations' | 'ai' | 'feedback' | 'health' | 'finanzas' | 'content' | 'figma' | 'sitemap';
type StatusFilter = 'all' | 'completed' | 'in_progress' | 'archived';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  tier: string | null;
  created_at: string;
  validations_count?: number;
  validations?: { count: number }[];
}

interface Expense {
  id: string;
  name: string;
  amount: number;
  category: 'infra' | 'tools' | 'marketing' | 'other';
  currency: 'USD' | 'CLP';
}

const TIER_PRICES_USD: Record<string, number> = { free: 0, basic: 11, pro: 25, premium: 50 };

const DEFAULT_EXPENSES: Expense[] = [
  { id: 'supabase', name: 'Supabase Pro', amount: 25, category: 'infra', currency: 'USD' },
  { id: 'vercel', name: 'Vercel Pro', amount: 20, category: 'infra', currency: 'USD' },
  { id: 'serpapi', name: 'SerpAPI', amount: 50, category: 'tools', currency: 'USD' },
  { id: 'domain', name: 'Dominio (.lat)', amount: 1.25, category: 'infra', currency: 'USD' },
];

function loadExpenses(): Expense[] {
  try { return JSON.parse(localStorage.getItem('admin_expenses') ?? 'null') ?? DEFAULT_EXPENSES; }
  catch { return DEFAULT_EXPENSES; }
}
function saveExpenses(e: Expense[]) { localStorage.setItem('admin_expenses', JSON.stringify(e)); }

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

interface ReportFeedbackRow {
  id: string;
  validation_id: string;
  rating: number | null;
  section: string;
  dimensions_wrong: string[] | null;
  free_text: string | null;
  created_at: string;
  validation: { idea_name: string | null } | null;
}

// Digest server-side (RPC get_feedback_digest) — agrega TODO el histórico.
interface FeedbackDigest {
  total: number;
  avg_rating: number | null;
  low_count: number;
  corrections: number;
  by_dimension: { dimension: string; count: number }[];
  by_section: { section: string; count: number; avg_rating: number | null; low_count: number }[];
  recent_low: {
    validation_id: string;
    idea_name: string | null;
    rating: number | null;
    dimensions_wrong: string[] | null;
    free_text: string | null;
    section: string;
    created_at: string;
  }[];
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
    id: 'feedback', label: 'Feedback',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  },
  {
    id: 'health', label: 'Sistema',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>,
  },
  {
    id: 'finanzas', label: 'Finanzas',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    id: 'content', label: 'Contenido',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    id: 'figma', label: 'Figma',
    icon: <svg className="w-4 h-4" viewBox="0 0 38 57" fill="currentColor"><path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" opacity=".9"/><path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" opacity=".5"/><path d="M19 0v19h9.5a9.5 9.5 0 0 0 0-19H19z" opacity=".7"/><path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" opacity=".6"/><path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" opacity=".8"/></svg>,
  },
  {
    id: 'sitemap', label: 'Sitemap',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>,
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
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5 transition"
        >← Prev</button>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5 transition"
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
  const [feedback, setFeedback] = useState<ReportFeedbackRow[]>([]);
  const [feedbackDigest, setFeedbackDigest] = useState<FeedbackDigest | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [valPage, setValPage] = useState(0);
  const [valTotal, setValTotal] = useState(0);
  const [valSearch, setValSearch] = useState('');
  const [aiPage, setAiPage] = useState(0);
  const [aiTotal, setAiTotal] = useState(0);
  const [profPage, setProfPage] = useState(0);
  const [profTotal, setProfTotal] = useState(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingTier, setSavingTier] = useState<Record<string, boolean>>({});
  const [activePreview, setActivePreview] = useState<UserTier | null>(() => getPreviewTier());
  const [expenses, setExpenses] = useState<Expense[]>(loadExpenses);
  const [newExpense, setNewExpense] = useState<Omit<Expense, 'id'>>({ name: '', amount: 0, category: 'infra', currency: 'USD' });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email !== ADMIN_EMAIL) navigate('/validate', { replace: true });
    });
  }, [navigate]);

  const load = useCallback(async (vPage = 0, aPage = 0, pPage = 0, search = '') => {
    setLoading(true);
    const vFrom = vPage * PAGE_SIZE;
    const aFrom = aPage * PAGE_SIZE;
    const pFrom = pPage * PAGE_SIZE;

    let valQuery = supabase
      .from('validations')
      .select('*, profile:profiles(full_name, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (search.trim()) valQuery = valQuery.ilike('idea_name', `%${search.trim()}%`);
    valQuery = valQuery.range(vFrom, vFrom + PAGE_SIZE - 1);

    const [{ data: profs, count: pCount }, { data: vals, count: vCount }, { data: ais, count: aCount }, { data: fb }] = await Promise.all([
      supabase.from('profiles')
        .select('id, full_name, avatar_url, tier, created_at, validations(count)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pFrom, pFrom + PAGE_SIZE - 1),
      valQuery,
      supabase.from('ai_interactions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(aFrom, aFrom + PAGE_SIZE - 1),
      supabase.from('report_feedback')
        .select('id, validation_id, rating, section, dimensions_wrong, free_text, created_at, validation:validations(idea_name)')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    setProfiles((profs ?? []).map(p => ({
      ...p,
      validations_count: (p as Profile).validations?.[0]?.count ?? 0,
    })) as Profile[]);
    setProfTotal(pCount ?? 0);
    setValidations(vals ?? []);
    setValTotal(vCount ?? 0);
    setAiInteractions(ais ?? []);
    setAiTotal(aCount ?? 0);
    setFeedback((fb ?? []) as unknown as ReportFeedbackRow[]);
    // Digest agregado server-side (todo el histórico). Best-effort: si falla, la UI
    // cae a la agregación client-side sobre las filas cargadas.
    supabase.rpc('get_feedback_digest').then(({ data: dg, error: dgErr }) => {
      if (!dgErr && dg) setFeedbackDigest(dg as unknown as FeedbackDigest);
    });
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(valPage, aiPage, profPage, valSearch); }, [load, valPage, aiPage, profPage, valSearch]);

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
  const tierCounts = { free: 0, basic: 0, pro: 0, premium: 0 };
  profiles.forEach(p => {
    const t = (p.tier ?? 'free') as keyof typeof tierCounts;
    if (t in tierCounts) tierCounts[t]++;
    else tierCounts.free++;
  });
  const tierDist = [
    { name: 'Free', value: tierCounts.free, color: '#9ca3af' },
    { name: 'Basic', value: tierCounts.basic, color: '#f59e0b' },
    { name: 'Pro', value: tierCounts.pro, color: '#8b5cf6' },
    { name: 'Premium', value: tierCounts.premium, color: '#14b8a6' },
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

  // ── Finanzas ──────────────────────────────────────────────────────────────
  const mrr = profiles.reduce((s, p) => s + (TIER_PRICES_USD[p.tier ?? 'free'] ?? 0), 0);
  const arr = mrr * 12;
  const aiCostTotal = parseFloat(estimateCost(aiInteractions));
  // All-time cost, estimate monthly by dividing by months of data
  const firstInteraction = aiInteractions.length ? new Date(aiInteractions[aiInteractions.length - 1].created_at) : new Date();
  const monthsOfData = Math.max(1, (Date.now() - firstInteraction.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const aiCostMonthly = aiCostTotal / monthsOfData;
  const infraCostMonthly = expenses.filter(e => e.currency === 'USD').reduce((s, e) => s + e.amount, 0)
    + expenses.filter(e => e.currency === 'CLP').reduce((s, e) => s + e.amount / 1000, 0);
  const totalCostMonthly = aiCostMonthly + infraCostMonthly;
  const grossMargin = mrr > 0 ? Math.round(((mrr - totalCostMonthly) / mrr) * 100) : 0;
  const netResult = mrr - totalCostMonthly;

  const paidUsers = tierCounts.basic + tierCounts.pro + tierCounts.premium;
  const revenueByTier = [
    { tier: 'Free', users: tierCounts.free, price: 0, mrr: 0, color: '#9ca3af' },
    { tier: 'Basic', users: tierCounts.basic, price: TIER_PRICES_USD.basic, mrr: tierCounts.basic * TIER_PRICES_USD.basic, color: '#f59e0b' },
    { tier: 'Pro', users: tierCounts.pro, price: TIER_PRICES_USD.pro, mrr: tierCounts.pro * TIER_PRICES_USD.pro, color: '#8b5cf6' },
    { tier: 'Premium', users: tierCounts.premium, price: TIER_PRICES_USD.premium, mrr: tierCounts.premium * TIER_PRICES_USD.premium, color: '#14b8a6' },
  ];

  const costPerValidation = completed.length > 0 ? (aiCostTotal / completed.length) : 0;

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
              <p className="text-white text-sm font-bold leading-none">Validus</p>
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
              {tab === 'feedback' && `${feedback.length} respuestas · refinamiento de RAG`}
              {tab === 'health' && `Funnel · Tiers · Prompts · Modelos`}
              {tab === 'finanzas' && `MRR $${mrr.toFixed(0)} · Gastos $${totalCostMonthly.toFixed(0)}/mes · Margen ${grossMargin}%`}
              {tab === 'content' && 'Genera imágenes + copy para LinkedIn'}
              {tab === 'figma' && 'Conecta tu cuenta y escanea el mapa de navegación de tus prototipos'}
              {tab === 'sitemap' && `Árbol de navegación de validus.scouttech.lat · ${16} rutas`}
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

              {/* ── Preview de tier ─────────────────────────────────────────── */}
              <Card title="Preview de Tier — vista como usuario">
                <div className="flex flex-wrap gap-2 items-center">
                  {(['free', 'pro', 'premium'] as UserTier[]).map(t => {
                    const isActive = activePreview === t;
                    const clsMap: Record<string, string> = {
                      free:    isActive ? 'bg-gray-700 text-gray-100 border-gray-500'    : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10',
                      pro:     isActive ? 'bg-indigo-600 text-white border-indigo-400'   : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/40',
                      premium: isActive ? 'bg-violet-600 text-white border-violet-400'  : 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700/40',
                    };
                    const cls = clsMap[t];
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          const next = isActive ? null : t;
                          setPreviewTier(next);
                          setActivePreview(next);
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${cls}`}
                      >
                        {isActive ? '✓ ' : ''}{t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    );
                  })}
                  {activePreview && (
                    <button
                      onClick={() => { setPreviewTier(null); setActivePreview(null); }}
                      className="ml-2 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/40 transition-all"
                    >
                      Salir del preview
                    </button>
                  )}
                  <p className="w-full text-xs text-gray-400 mt-1">
                    Activa un preview para navegar la app como si fueras ese tier. El banner aparece en el header.
                  </p>
                </div>
              </Card>

              {/* ── Tabla de usuarios ───────────────────────────────────────── */}
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
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                      {profiles.map(p => {
                        const userValsThisWeek = validations.filter(v =>
                          v.user_id === p.id && new Date(v.created_at) >= oneWeekAgo
                        ).length;
                        const currentTier = (p.tier ?? 'free') as UserTier;
                        return (
                          <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                            <td className="py-3.5 pr-8">
                              <div className="flex items-center gap-3">
                                <Avatar name={p.full_name} url={p.avatar_url} size={8} />
                                <span className="font-medium text-gray-900 dark:text-[#F0EFF8]">
                                  {p.full_name ?? <span className="text-gray-300 font-normal italic">Sin nombre</span>}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 pr-8">
                              <select
                                value={currentTier}
                                disabled={savingTier[p.id]}
                                onChange={async (e) => {
                                  const newTier = e.target.value as UserTier;
                                  setSavingTier(s => ({ ...s, [p.id]: true }));
                                  await supabase.from('profiles').update({ tier: newTier }).eq('id', p.id);
                                  setProfiles(prev => prev.map(u => u.id === p.id ? { ...u, tier: newTier } : u));
                                  setSavingTier(s => ({ ...s, [p.id]: false }));
                                }}
                                className={`text-xs font-bold px-2 py-1 rounded-lg border cursor-pointer transition-opacity ${savingTier[p.id] ? 'opacity-50' : ''}
                                  ${currentTier === 'premium' ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700/40'
                                  : currentTier === 'pro' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/40'
                                  : currentTier === 'basic' ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700/40'
                                  : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10'}`}
                              >
                                <option value="free">Free</option>
                                <option value="basic">Basic</option>
                                <option value="pro">Pro</option>
                                <option value="premium">Premium</option>
                              </select>
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
                <PaginationBar
                  page={profPage} total={profTotal} pageSize={PAGE_SIZE}
                  onChange={(p) => setProfPage(p)}
                />
              </Card>
            </>
          )}

          {/* ══ VALIDACIONES ═══════════════════════════════════════════════ */}
          {tab === 'validations' && (
            <Card
              title={`${valTotal} validaciones`}
              action={
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={valSearch}
                    onChange={e => {
                      const v = e.target.value;
                      if (searchTimeout.current) clearTimeout(searchTimeout.current);
                      searchTimeout.current = setTimeout(() => {
                        setValSearch(v);
                        setValPage(0);
                      }, 350);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-300 placeholder:text-gray-500 focus:outline-none focus:border-[#0EB5C6]/50 w-40"
                  />
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

          {/* ══ FEEDBACK ═══════════════════════════════════════════════════ */}
          {tab === 'feedback' && (() => {
            const rated = feedback.filter(f => f.rating != null);
            const avgRating = rated.length
              ? (rated.reduce((s, f) => s + (f.rating ?? 0), 0) / rated.length).toFixed(1)
              : '—';
            const lowRatings = rated.filter(f => (f.rating ?? 5) <= 2).length;
            const dimCounts = feedback
              .flatMap(f => f.dimensions_wrong ?? [])
              .reduce<Record<string, number>>((acc, d) => { acc[d] = (acc[d] ?? 0) + 1; return acc; }, {});
            const ratingEmoji = (r: number | null) =>
              r == null ? '—' : ['😖', '🙁', '😐', '🙂', '🤩'][r - 1] ?? String(r);

            // Preferimos el digest server-side (todo el histórico); si no cargó,
            // caemos a la agregación client-side sobre las filas visibles.
            const d = feedbackDigest;
            const kpiTotal   = d?.total ?? feedback.length;
            const kpiAvg     = d?.avg_rating ?? (avgRating === '—' ? null : avgRating);
            const kpiLow     = d?.low_count ?? lowRatings;
            const kpiCorr    = d?.corrections ?? Object.values(dimCounts).reduce((a, b) => a + b, 0);
            const topDims: [string, number][] = d
              ? d.by_dimension.map(x => [x.dimension, x.count] as [string, number])
              : Object.entries(dimCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
            const worklist = d?.recent_low ?? [];
            return (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                  <KPI label="Respuestas" value={kpiTotal} accent="#0EB5C6"
                    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                  />
                  <KPI label="Rating promedio" value={kpiAvg ?? '—'} sub="todo el histórico" accent="#10b981"
                    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                  />
                  <KPI label="Ratings bajos (≤2)" value={kpiLow} sub="prioridad de revisión" accent="#ef4444"
                    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                  />
                  <KPI label="Correcciones" value={kpiCorr} sub="señales para el RAG" accent="#f59e0b"
                    icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  />
                </div>

                {topDims.length > 0 && (
                  <Card title="Qué se corrige más (señal para refinar el RAG)">
                    <div className="flex flex-wrap gap-2">
                      {topDims.map(([dim, n]) => (
                        <span key={dim} className="text-xs px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
                          {dim} · {n}
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

                {worklist.length > 0 && (
                  <Card title="Worklist — reportes a revisar (rating bajo o con comentario)">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-white/5">
                            {['Validación', 'Rating', 'Sección', 'Correcciones', 'Comentario', 'Fecha'].map(h => (
                              <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-6">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {worklist.map((w, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:bg-[#0A0A0F]/50 transition align-top">
                              <td className="py-3.5 pr-6">
                                <Link to={`/results/${w.validation_id}`} className="text-xs font-medium text-[#0EB5C6] hover:underline">
                                  {w.idea_name ?? `${w.validation_id.slice(0, 8)}…`}
                                </Link>
                              </td>
                              <td className="py-3.5 pr-6 text-lg">{ratingEmoji(w.rating)}</td>
                              <td className="py-3.5 pr-6"><span className="text-xs px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-[#8B8AA0] font-mono">{w.section}</span></td>
                              <td className="py-3.5 pr-6 max-w-[14rem]">
                                <div className="flex flex-wrap gap-1">
                                  {(w.dimensions_wrong ?? []).map((dm, j) => (
                                    <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">{dm}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3.5 pr-6 max-w-[18rem] text-xs text-gray-600 dark:text-[#C4C4D4]">{w.free_text ?? '—'}</td>
                              <td className="py-3.5 text-xs text-gray-400 whitespace-nowrap">{fmt(w.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                <Card title="Feedback reciente">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-white/5">
                          {['Validación', 'Rating', 'Sección', 'Correcciones', 'Comentario', 'Fecha'].map(h => (
                            <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-6">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {feedback.map(f => (
                          <tr key={f.id} className="hover:bg-gray-50 dark:bg-[#0A0A0F]/50 transition align-top">
                            <td className="py-3.5 pr-6">
                              <Link to={`/results/${f.validation_id}`} className="text-xs font-medium text-[#0EB5C6] hover:underline">
                                {f.validation?.idea_name ?? `${f.validation_id.slice(0, 8)}…`}
                              </Link>
                            </td>
                            <td className="py-3.5 pr-6 text-lg">{ratingEmoji(f.rating)}</td>
                            <td className="py-3.5 pr-6">
                              <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-[#8B8AA0] font-mono">{f.section}</span>
                            </td>
                            <td className="py-3.5 pr-6 max-w-[14rem]">
                              <div className="flex flex-wrap gap-1">
                                {(f.dimensions_wrong ?? []).map((d, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">{d}</span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3.5 pr-6 max-w-[18rem] text-xs text-gray-600 dark:text-[#C4C4D4]">{f.free_text ?? '—'}</td>
                            <td className="py-3.5 text-xs text-gray-400 whitespace-nowrap">{fmt(f.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {feedback.length === 0 && (
                      <p className="text-sm text-gray-300 text-center py-12">Sin feedback aún</p>
                    )}
                  </div>
                </Card>
              </>
            );
          })()}

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

          {/* ══ FINANZAS ════════════════════════════════════════════════════ */}
          {tab === 'finanzas' && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                <KPI
                  label="MRR"
                  value={`$${mrr.toFixed(0)}`}
                  sub={`${paidUsers} usuarios pagos`}
                  accent="#14b8a6"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                />
                <KPI
                  label="Gastos / mes"
                  value={`$${totalCostMonthly.toFixed(0)}`}
                  sub={`AI $${aiCostMonthly.toFixed(2)} + Infra $${infraCostMonthly.toFixed(0)}`}
                  accent="#ef4444"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>}
                />
                <KPI
                  label="Resultado neto"
                  value={`${netResult >= 0 ? '+' : ''}$${netResult.toFixed(0)}`}
                  sub="ingresos − gastos / mes"
                  accent={netResult >= 0 ? '#10b981' : '#ef4444'}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                />
                <KPI
                  label="ARR proyectado"
                  value={`$${arr.toFixed(0)}`}
                  sub="MRR × 12"
                  accent="#8b5cf6"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                />
              </div>

              {/* P&L Summary */}
              <div className="bg-gray-900 rounded-2xl p-5 md:p-6">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Estado de resultados mensual (estimado)</p>
                <div className="space-y-3">
                  {[
                    { label: 'Ingresos (MRR)', value: mrr, color: 'text-emerald-400', sign: '+' },
                    { label: 'Costo AI (variable)', value: -aiCostMonthly, color: 'text-red-400', sign: '−' },
                    { label: 'Infraestructura (fija)', value: -infraCostMonthly, color: 'text-red-400', sign: '−' },
                    { label: 'Resultado neto', value: netResult, color: netResult >= 0 ? 'text-teal-300' : 'text-red-300', sign: netResult >= 0 ? '+' : '' },
                  ].map((row, i) => (
                    <div key={row.label} className={`flex items-center justify-between py-2.5 ${i === 3 ? 'border-t border-gray-700 pt-3.5 mt-1' : ''}`}>
                      <span className="text-sm text-gray-400">{row.label}</span>
                      <span className={`text-lg font-black ${row.color}`}>
                        {row.sign !== '−' ? row.sign : '−'}${Math.abs(row.value).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                {mrr === 0 && (
                  <p className="text-xs text-gray-600 mt-4 pt-3 border-t border-gray-800">
                    Sin usuarios pagos aún — activa LemonSqueezy para empezar a facturar.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Revenue por tier */}
                <Card title="Ingresos por tier">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-white/5">
                          {['Plan', 'Usuarios', 'Precio/mes', 'MRR', '% del total'].map(h => (
                            <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                        {revenueByTier.map(row => (
                          <tr key={row.tier} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                                <span className="text-xs font-bold" style={{ color: row.color }}>{row.tier}</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-sm font-semibold text-gray-700 dark:text-[#C4C4D4]">{row.users}</td>
                            <td className="py-3 pr-4 text-xs text-gray-500">{row.price === 0 ? '—' : `$${row.price}`}</td>
                            <td className="py-3 pr-4 text-sm font-black text-gray-900 dark:text-[#F0EFF8]">
                              {row.mrr === 0 ? <span className="text-gray-300 font-normal">$0</span> : `$${row.mrr}`}
                            </td>
                            <td className="py-3">
                              {mrr > 0 && row.mrr > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${(row.mrr / mrr) * 100}%`, background: row.color }} />
                                  </div>
                                  <span className="text-xs text-gray-500">{Math.round((row.mrr / mrr) * 100)}%</span>
                                </div>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 dark:border-white/10">
                          <td className="py-3 pr-4 text-xs font-bold text-gray-500 uppercase tracking-wide">Total</td>
                          <td className="py-3 pr-4 text-sm font-bold text-gray-800 dark:text-[#F0EFF8]">{profiles.length}</td>
                          <td />
                          <td className="py-3 pr-4 text-sm font-black text-teal-600">${mrr}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>

                {/* Unit economics */}
                <Card title="Unit economics">
                  <div className="space-y-4">
                    {[
                      {
                        label: 'CAC objetivo',
                        value: '< $3 USD',
                        sub: 'Meta vía Meta/LinkedIn Ads',
                        accent: '#14b8a6',
                      },
                      {
                        label: 'LTV estimado (Basic)',
                        value: paidUsers > 0 ? `$${(TIER_PRICES_USD.basic * 12).toFixed(0)}` : '—',
                        sub: 'Asumiendo 12 meses retención',
                        accent: '#f59e0b',
                      },
                      {
                        label: 'LTV / CAC ratio',
                        value: paidUsers > 0 ? `${(TIER_PRICES_USD.basic * 12 / 3).toFixed(1)}x` : '—',
                        sub: 'Target > 3x para ser venture-backable',
                        accent: '#8b5cf6',
                      },
                      {
                        label: 'Costo por validación',
                        value: completed.length ? `$${costPerValidation.toFixed(4)}` : '—',
                        sub: 'AI cost / validaciones completadas',
                        accent: '#ef4444',
                      },
                      {
                        label: 'Margen bruto',
                        value: mrr > 0 ? `${grossMargin}%` : 'N/A',
                        sub: mrr > 0 ? `(ingresos − costos) / ingresos` : 'Sin ingresos aún',
                        accent: grossMargin > 70 ? '#10b981' : '#f59e0b',
                      },
                    ].map(m => (
                      <div key={m.label} className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-[#8B8AA0]">{m.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>
                        </div>
                        <span className="text-base font-black flex-shrink-0" style={{ color: m.accent }}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Gastos editables */}
              <Card
                title="Gastos fijos / mes"
                action={
                  <span className="text-xs font-bold text-gray-400">
                    Total: <span className="text-red-500">${infraCostMonthly.toFixed(2)}/mes</span>
                  </span>
                }
              >
                <div className="space-y-2 mb-5">
                  {expenses.map(exp => (
                    <div key={exp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.03] group">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        exp.category === 'infra' ? 'bg-blue-400' : exp.category === 'tools' ? 'bg-amber-400' : exp.category === 'marketing' ? 'bg-pink-400' : 'bg-gray-400'
                      }`} />
                      <span className="text-xs font-medium text-gray-700 dark:text-[#C4C4D4] flex-1">{exp.name}</span>
                      <span className="text-xs text-gray-400 capitalize">{exp.category}</span>
                      {editingExpenseId === exp.id ? (
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={exp.amount}
                          className="w-20 text-xs text-right px-2 py-1 rounded-lg border border-teal-300 bg-white dark:bg-[#12121A] text-gray-800 dark:text-[#F0EFF8] focus:outline-none"
                          onBlur={e => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              const updated = expenses.map(x => x.id === exp.id ? { ...x, amount: val } : x);
                              setExpenses(updated);
                              saveExpenses(updated);
                            }
                            setEditingExpenseId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => setEditingExpenseId(exp.id)}
                          className="text-xs font-bold text-amber-600 hover:text-amber-700 w-20 text-right"
                        >
                          ${exp.amount.toFixed(2)} {exp.currency}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const updated = expenses.filter(x => x.id !== exp.id);
                          setExpenses(updated);
                          saveExpenses(updated);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add expense */}
                <div className="border-t border-gray-100 dark:border-white/5 pt-4">
                  <p className="text-xs font-semibold text-gray-400 mb-3">Agregar gasto</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={newExpense.name}
                      onChange={e => setNewExpense(n => ({ ...n, name: e.target.value }))}
                      className="text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121A] text-gray-800 dark:text-[#F0EFF8] placeholder:text-gray-400 focus:outline-none focus:border-teal-400 w-36"
                    />
                    <input
                      type="number"
                      placeholder="Monto"
                      step="0.01"
                      value={newExpense.amount || ''}
                      onChange={e => setNewExpense(n => ({ ...n, amount: parseFloat(e.target.value) || 0 }))}
                      className="text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121A] text-gray-800 dark:text-[#F0EFF8] placeholder:text-gray-400 focus:outline-none focus:border-teal-400 w-24"
                    />
                    <select
                      value={newExpense.currency}
                      onChange={e => setNewExpense(n => ({ ...n, currency: e.target.value as 'USD' | 'CLP' }))}
                      className="text-xs px-2 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121A] text-gray-600 dark:text-gray-300 focus:outline-none"
                    >
                      <option>USD</option>
                      <option>CLP</option>
                    </select>
                    <select
                      value={newExpense.category}
                      onChange={e => setNewExpense(n => ({ ...n, category: e.target.value as Expense['category'] }))}
                      className="text-xs px-2 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121A] text-gray-600 dark:text-gray-300 focus:outline-none"
                    >
                      <option value="infra">Infra</option>
                      <option value="tools">Tools</option>
                      <option value="marketing">Marketing</option>
                      <option value="other">Otro</option>
                    </select>
                    <button
                      disabled={!newExpense.name || newExpense.amount <= 0}
                      onClick={() => {
                        const exp: Expense = { ...newExpense, id: Date.now().toString() };
                        const updated = [...expenses, exp];
                        setExpenses(updated);
                        saveExpenses(updated);
                        setNewExpense({ name: '', amount: 0, category: 'infra', currency: 'USD' });
                      }}
                      className="text-xs px-4 py-2 rounded-lg bg-teal-500 text-white font-bold hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      + Agregar
                    </button>
                    <button
                      onClick={() => { setExpenses(DEFAULT_EXPENSES); saveExpenses(DEFAULT_EXPENSES); }}
                      className="text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-400 hover:text-gray-600 transition"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </Card>

              {/* Nota sobre pagos */}
              {paidUsers === 0 && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 p-5">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1">Sin ingresos reales aún</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Todos los usuarios están en plan Free. Activa LemonSqueezy completando los 6 secrets en Supabase
                    (ver <code className="bg-amber-100 dark:bg-amber-800/30 px-1 rounded">SETUP_LEMONSQUEEZY.md</code>).
                    Los MRR y márgenes de arriba son proyecciones basadas en los tiers actuales.
                  </p>
                </div>
              )}
            </>
          )}

          {tab === 'content' && (
            <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando motor de contenido...</div>}>
              <ContentStudio
                adminData={{
                  usersTotal: profiles.length,
                  validationsTotal: validations.length,
                  completedValidations: completed.length,
                  completionRate,
                  avgScore,
                  totalTokens,
                  projected30,
                  abandonStep,
                  aiInteractionsTotal: aiInteractions.length,
                  topIndustries: industries,
                  topCountries: countries,
                  topStages: stages,
                  topModels: modelDist,
                  topPrompts,
                  tierDist,
                  scoreDist,
                }}
              />
            </Suspense>
          )}
          {tab === 'figma' && (
            <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando Figma...</div>}>
              <FigmaAdminPanel />
            </Suspense>
          )}
          {tab === 'sitemap' && (
            <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando sitemap...</div>}>
              <SitemapPanel />
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
