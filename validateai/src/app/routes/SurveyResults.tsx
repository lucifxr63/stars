import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { SurveyForm, SurveySubmission, Severity, SurveyAggregates } from '@/types/survey';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Presupuesto de privacidad fijo — transparente al usuario de negocio.
// ε=1.0 equilibra utilidad analítica con protección individual robusta.
const EPSILON = 1.0;

// ── Utilidades de sanitización (Patrón 2) ────────────────
// El mecanismo de Laplace puede devolver flotantes o valores negativos.
// Estas funciones garantizan coherencia semántica de los datos antes de renderizar.

function sanitizeCount(v: number): number {
  return Math.max(0, Math.round(v));
}

function sanitizeRate(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
}

function sanitizeScore(v: number, min = 1, max = 10): number {
  return Math.max(min, Math.min(max, Math.round(v * 10) / 10));
}

// ── Cálculo del Margen de Error (Patrón 3) ───────────────
// Para la distribución de Laplace con escala b = sensitivity/ε:
//   - 95% CI: P(|X| ≤ t) = 1 - e^(-t/b) → t = -b·ln(0.05) ≈ 3b
// Mostramos ±ceil(3b) para conteos y ±round(3b*100)% para tasas.

function countMargin(epsilon: number): number {
  const b = 1 / epsilon; // sensitivity=1 para conteos
  return Math.ceil(3 * b);
}

function rateMarginPct(epsilon: number, n: number): number {
  const sensitivity = 1 / Math.max(n, 1);
  const b = sensitivity / epsilon;
  return Math.round(3 * b * 100 * 10) / 10; // en puntos porcentuales
}

function scoreMargin(epsilon: number, n: number): number {
  const sensitivity = 6.5 / Math.max(n, 1);
  const b = sensitivity / epsilon;
  return Math.round(3 * b * 10) / 10;
}

// ── Tipos del data lake ───────────────────────────────────
interface DatalakeResult {
  severity?: {
    distribution: Record<string, number>;
    total_noisy: number;
  };
  wtp?: { wtp_rate: number; n: number };
  friction?: { avg_friction: number; n: number };
  industry?: { breakdown: Record<string, number>; n: number };
  solutions?: { top_solutions: Record<string, number>; n: number };
  momTest?: {
    talks_about_past_pct: number;
    mentions_money_spent_pct: number;
    reveals_workarounds_pct: number;
    n: number;
  };
}

type DatalakeStatus = 'idle' | 'loading' | 'insufficient_data' | 'error' | 'ready';

// ── Tipos del módulo ──────────────────────────────────────
const SEVERITY_LABELS: Record<Severity, { label: string; color: string; bg: string; bar: string }> = {
  tolerable:   { label: 'Tolerable',   color: 'text-green-400',  bg: 'bg-green-500/20',  bar: 'bg-green-500/50'  },
  critico:     { label: 'Crítico',     color: 'text-amber-400',  bg: 'bg-amber-500/20',  bar: 'bg-amber-500/50'  },
  paralizante: { label: 'Paralizante', color: 'text-red-400',    bg: 'bg-red-500/20',    bar: 'bg-red-500/50'    },
};

function buildAggregates(submissions: SurveySubmission[]): SurveyAggregates {
  const analyzed = submissions.filter(s => s.analysis_result);
  const total = submissions.length;

  const severityDist: Record<Severity, number> = { tolerable: 0, critico: 0, paralizante: 0 };
  let frictionSum = 0;
  let wtpCount = 0;
  const solutionCounts = new Map<string, number>();
  const momSignals = { talks_about_past: 0, mentions_money_spent: 0, reveals_workarounds: 0 };

  for (const sub of analyzed) {
    const r = sub.analysis_result!;
    severityDist[r.severity] = (severityDist[r.severity] ?? 0) + 1;
    frictionSum += r.friction_score;
    if (r.willingness_to_pay) wtpCount++;
    for (const sol of r.current_solutions) {
      solutionCounts.set(sol, (solutionCounts.get(sol) ?? 0) + 1);
    }
    if (r.mom_test_signals?.talks_about_past) momSignals.talks_about_past++;
    if (r.mom_test_signals?.mentions_money_spent) momSignals.mentions_money_spent++;
    if (r.mom_test_signals?.reveals_workarounds) momSignals.reveals_workarounds++;
  }

  const n = analyzed.length || 1;
  const topSolutions = [...solutionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([solution, count]) => ({ solution, count }));

  return {
    total_submissions: total,
    analyzed_count: analyzed.length,
    severity_distribution: severityDist,
    avg_friction_score: parseFloat((frictionSum / n).toFixed(1)),
    willingness_to_pay_pct: parseFloat(((wtpCount / n) * 100).toFixed(0)),
    top_current_solutions: topSolutions,
    mom_test_scores: {
      talks_about_past_pct: Math.round((momSignals.talks_about_past / n) * 100),
      mentions_money_spent_pct: Math.round((momSignals.mentions_money_spent / n) * 100),
      reveals_workarounds_pct: Math.round((momSignals.reveals_workarounds / n) * 100),
    },
  };
}

// ════════════════════════════════════════════════════════════
// Componentes UI — Pestaña "Análisis IA"
// ════════════════════════════════════════════════════════════

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#12121A] border border-white/5 rounded-2xl p-4">
      <p className="text-xs text-[#C4C4D4] mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ?? 'text-[#F0EFF8]'}`}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

function SeverityBar({ distribution, total }: { distribution: Record<Severity, number>; total: number }) {
  if (total === 0) return null;
  const severities: Severity[] = ['paralizante', 'critico', 'tolerable'];
  return (
    <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5">
      <p className="text-xs font-bold text-[#C4C4D4] mb-4">Distribución de severidad</p>
      <div className="space-y-3">
        {severities.map(s => {
          const pct = total > 0 ? Math.round((distribution[s] / total) * 100) : 0;
          const meta = SEVERITY_LABELS[s];
          return (
            <div key={s}>
              <div className="flex justify-between text-xs mb-1">
                <span className={meta.color}>{meta.label}</span>
                <span className="text-white/40">{distribution[s]} ({pct}%)</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${meta.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmissionCard({ sub }: { sub: SurveySubmission }) {
  const [expanded, setExpanded] = useState(false);
  const r = sub.analysis_result;
  if (!r) return null;
  const meta = SEVERITY_LABELS[r.severity];

  return (
    <div className="bg-[#12121A] border border-white/5 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-lg ${meta.bg} ${meta.color}`}>
          {meta.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#F0EFF8] mb-1">{r.central_problem}</p>
          <div className="flex flex-wrap gap-3 text-xs text-white/40">
            <span>Fricción: <strong className="text-[#7C6FF7]">{r.friction_score}/10</strong></span>
            <span>WTP: <strong className={r.willingness_to_pay ? 'text-green-400' : 'text-red-400'}>{r.willingness_to_pay ? 'Sí' : 'No'}</strong></span>
            <span>{new Date(sub.created_at).toLocaleDateString('es-CL')}</span>
          </div>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="shrink-0 text-xs text-[#7C6FF7] hover:underline">
          {expanded ? 'Menos' : 'Más'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
          {r.key_quotes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#C4C4D4] mb-1">Citas clave:</p>
              {r.key_quotes.map((q, i) => (
                <p key={i} className="text-xs text-white/60 italic border-l-2 border-[#7C6FF7]/40 pl-2 mb-1">"{q}"</p>
              ))}
            </div>
          )}
          {r.current_solutions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#C4C4D4] mb-1">Soluciones actuales:</p>
              <div className="flex flex-wrap gap-1">
                {r.current_solutions.map((s, i) => (
                  <span key={i} className="text-xs bg-white/5 border border-white/10 text-[#C4C4D4] px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          {r.mom_test_signals && (
            <div className="flex gap-3 text-xs flex-wrap">
              <span className={r.mom_test_signals.talks_about_past ? 'text-green-400' : 'text-white/30'}>
                {r.mom_test_signals.talks_about_past ? '✓' : '✗'} Hechos pasados
              </span>
              <span className={r.mom_test_signals.mentions_money_spent ? 'text-green-400' : 'text-white/30'}>
                {r.mom_test_signals.mentions_money_spent ? '✓' : '✗'} Dinero gastado
              </span>
              <span className={r.mom_test_signals.reveals_workarounds ? 'text-green-400' : 'text-white/30'}>
                {r.mom_test_signals.reveals_workarounds ? '✓' : '✗'} Parches actuales
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Componentes UI — Pestaña "Data Lake con DP"
// ════════════════════════════════════════════════════════════

// Patrón 4: Empty state elegante cuando no hay quórum en el data lake
function DatalakeInsufficientState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 flex items-center justify-center mb-4">
        <span className="text-2xl">🔒</span>
      </div>
      <h3 className="font-bold text-[#F0EFF8] mb-2">Datos insuficientes para garantías de privacidad</h3>
      <p className="text-sm text-[#C4C4D4] max-w-sm mb-3">
        Se requieren más respuestas procesadas en este segmento para generar métricas
        estadísticamente significativas y preservar la privacidad de cada encuestado.
      </p>
      <p className="text-xs text-white/30 max-w-xs">
        El sistema aplica k-anonimato (k≥5) antes de servir cualquier dato del data lake.
        Acumula más respuestas y vuelve a intentarlo.
      </p>
    </div>
  );
}

// Patrón 3: Métrica con intervalo de confianza (±margen)
function DpMetricCard({
  label,
  value,
  margin,
  unit = '',
  accent,
  tooltip,
}: {
  label: string;
  value: number;
  margin: number;
  unit?: string;
  accent?: string;
  tooltip?: string;
}) {
  const lo = Math.max(0, value - margin);
  const hi = value + margin;
  return (
    <div className="bg-[#12121A] border border-white/5 rounded-2xl p-4" title={tooltip}>
      <p className="text-xs text-[#C4C4D4] mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent ?? 'text-[#F0EFF8]'}`}>
        {value}{unit}
      </p>
      <p className="text-xs text-[#7C6FF7]/70 mt-0.5">
        rango aprox. {lo}{unit} – {hi}{unit}
      </p>
    </div>
  );
}

// Patrón 3: Barra de severidad con banda de error visual
function DpSeverityBar({
  distribution,
  totalNoisy,
  epsilon,
}: {
  distribution: Record<string, number>;
  totalNoisy: number;
  epsilon: number;
}) {
  const m = countMargin(epsilon);
  const severities: Severity[] = ['paralizante', 'critico', 'tolerable'];

  return (
    <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-[#C4C4D4]">Distribución de severidad</p>
        <span className="text-xs text-[#7C6FF7]/60 bg-[#7C6FF7]/10 px-2 py-0.5 rounded-full">±{m} por barra</span>
      </div>
      <div className="space-y-4">
        {severities.map(s => {
          const raw = sanitizeCount(distribution[s] ?? 0);
          const pct = totalNoisy > 0 ? Math.round((raw / totalNoisy) * 100) : 0;
          const lo = Math.max(0, raw - m);
          const hi = raw + m;
          const meta = SEVERITY_LABELS[s];
          return (
            <div key={s}>
              <div className="flex justify-between text-xs mb-1">
                <span className={meta.color}>{meta.label}</span>
                <span className="text-white/40">
                  aprox. {lo}–{hi} ({pct}%)
                </span>
              </div>
              {/* Barra principal */}
              <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${meta.bar} rounded-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
                {/* Banda de incertidumbre derecha */}
                <div
                  className={`absolute top-0 h-full ${meta.bar} opacity-30 rounded-full`}
                  style={{
                    left: `${Math.min(100, pct)}%`,
                    width: `${Math.min(100 - pct, (m / (totalNoisy || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-white/20 mt-3">
        Total aprox. {sanitizeCount(totalNoisy)} respuestas anonimizadas · Privacidad diferencial ε={epsilon}
      </p>
    </div>
  );
}

// Distribución de industrias con rangos
function DpIndustryChart({
  breakdown,
  n,
  epsilon,
}: {
  breakdown: Record<string, number>;
  n: number;
  epsilon: number;
}) {
  const m = countMargin(epsilon);
  const sorted = Object.entries(breakdown)
    .map(([k, v]) => ({ k, v: sanitizeCount(v) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 8);
  const maxVal = Math.max(...sorted.map(x => x.v), 1);

  return (
    <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-[#C4C4D4]">Distribución por industria</p>
        <span className="text-xs text-[#7C6FF7]/60 bg-[#7C6FF7]/10 px-2 py-0.5 rounded-full">±{m}</span>
      </div>
      <div className="space-y-3">
        {sorted.map(({ k, v }) => (
          <div key={k}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#C4C4D4] truncate max-w-[55%]">{k}</span>
              <span className="text-white/40">{Math.max(0, v - m)}–{v + m}</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#7C6FF7]/50 rounded-full"
                style={{ width: `${(v / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-white/20 mt-3">n anonimizado ≈ {n}</p>
    </div>
  );
}

// Señales Mom Test con bandas de incertidumbre
function DpMomTestSignals({
  data,
  epsilon,
}: {
  data: NonNullable<DatalakeResult['momTest']>;
  epsilon: number;
}) {
  const n = data.n;
  const m = rateMarginPct(epsilon, n);
  const signals = [
    { label: 'Hablan de hechos pasados', pct: sanitizeRate(data.talks_about_past_pct * 100) },
    { label: 'Mencionan dinero gastado', pct: sanitizeRate(data.mentions_money_spent_pct * 100) },
    { label: 'Revelan parches actuales', pct: sanitizeRate(data.reveals_workarounds_pct * 100) },
  ];

  return (
    <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5 md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-[#C4C4D4]">Señales Mom Test (data lake)</p>
        <span className="text-xs text-[#7C6FF7]/60 bg-[#7C6FF7]/10 px-2 py-0.5 rounded-full">±{m}%</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {signals.map(({ label, pct }) => {
          const lo = Math.max(0, pct - m);
          const hi = Math.min(100, pct + m);
          const color = pct >= 60 ? 'text-green-400' : pct >= 30 ? 'text-amber-400' : 'text-red-400';
          return (
            <div key={label} className="text-center">
              <p className={`text-2xl font-black mb-0.5 ${color}`}>{pct}%</p>
              <p className="text-xs text-[#7C6FF7]/60 mb-1">aprox. {lo}%–{hi}%</p>
              <p className="text-xs text-[#C4C4D4]">{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Soluciones actuales más frecuentes
function DpSolutionsChart({
  solutions,
  epsilon,
}: {
  solutions: Record<string, number>;
  epsilon: number;
}) {
  const m = Math.ceil(3 * (3 / epsilon)); // sensitivity=3 (máx soluciones/individuo)
  const sorted = Object.entries(solutions)
    .map(([k, v]) => ({ k, v: sanitizeCount(v) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 6);
  const maxVal = Math.max(...sorted.map(x => x.v), 1);

  return (
    <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-[#C4C4D4]">Soluciones actuales (top 6)</p>
        <span className="text-xs text-[#7C6FF7]/60 bg-[#7C6FF7]/10 px-2 py-0.5 rounded-full">±{m}</span>
      </div>
      <div className="space-y-3">
        {sorted.map(({ k, v }) => (
          <div key={k} className="flex items-center gap-3">
            <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-[#7C6FF7]/40 rounded-full"
                style={{ width: `${(v / maxVal) * 100}%` }}
              />
            </div>
            <span className="text-xs text-[#C4C4D4] w-32 truncate">{k}</span>
            <span className="text-xs text-white/30 w-16 text-right">{Math.max(0, v - m)}–{v + m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Badge de garantía de privacidad diferencial (tooltip educativo)
function DpBadge({ epsilon }: { epsilon: number }) {
  const amplification = Math.exp(epsilon).toFixed(2);
  return (
    <div
      className="flex items-center gap-2 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 rounded-xl px-3 py-2 cursor-help"
      title={`Garantía ε-diferencial: la presencia o ausencia de cualquier individuo no altera el resultado de una consulta en más de e^${epsilon}≈${amplification}x con alta probabilidad.`}
    >
      <span className="text-sm">🔐</span>
      <div>
        <p className="text-xs font-bold text-[#7C6FF7]">Privacidad Diferencial activa</p>
        <p className="text-xs text-[#C4C4D4]/60">ε={epsilon} · Mecanismo Laplace · Hover para detalles</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SurveyResults — componente principal
// ════════════════════════════════════════════════════════════

export function SurveyResults() {
  const { id } = useParams<{ id: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState<SurveyForm | null>(null);
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Pestaña activa: análisis IA o data lake con DP
  const [activeTab, setActiveTab] = useState<'ai' | 'datalake'>('ai');

  // Estado del data lake (Patrón 4: estado de datos insuficientes)
  const [dlStatus, setDlStatus] = useState<DatalakeStatus>('idle');
  const [dlData, setDlData] = useState<DatalakeResult>({});

  const load = useCallback(async (t: string) => {
    try {
      const [formRes, subsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/functions/v1/survey-crud?id=${id}`, {
          headers: { Authorization: `Bearer ${t}` },
        }),
        supabase
          .from('survey_submissions')
          .select('*')
          .eq('form_id', id!)
          .order('created_at', { ascending: false }),
      ]);
      if (!formRes.ok) throw new Error('Form not found');
      const { form: f } = await formRes.json();
      setForm(f);
      setSubmissions((subsRes.data ?? []) as SurveySubmission[]);
    } catch {
      toast.error('Error al cargar los resultados.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Carga del data lake con privacidad diferencial
  // Patrón 1: ε fijo (EPSILON=1.0), invisible al usuario de negocio
  const loadDatalake = useCallback(async (t: string) => {
    setDlStatus('loading');
    setDlData({});

    const base = `${SUPABASE_URL}/functions/v1/survey-datalake?form_id=${id}&epsilon=${EPSILON}`;
    const headers = { Authorization: `Bearer ${t}` };

    const queryTypes = ['severity_distribution', 'wtp_rate', 'friction_avg', 'industry_breakdown', 'solutions_frequency', 'mom_test_signals'] as const;

    try {
      const responses = await Promise.all(
        queryTypes.map(q => fetch(`${base}&query=${q}`, { headers }).then(r => r.json())),
      );

      // Patrón 4: detectar estado de datos insuficientes
      const firstResp = responses[0];
      if (firstResp.ok === false && firstResp.message?.includes('Insufficient')) {
        setDlStatus('insufficient_data');
        return;
      }

      const result: DatalakeResult = {};

      for (let i = 0; i < queryTypes.length; i++) {
        const resp = responses[i];
        if (!resp.ok) continue;
        const d = resp.data;
        switch (queryTypes[i]) {
          case 'severity_distribution':
            result.severity = d; break;
          case 'wtp_rate':
            result.wtp = d; break;
          case 'friction_avg':
            result.friction = d; break;
          case 'industry_breakdown':
            result.industry = d; break;
          case 'solutions_frequency':
            result.solutions = d; break;
          case 'mom_test_signals':
            result.momTest = d; break;
        }
      }

      setDlData(result);
      setDlStatus('ready');
    } catch {
      setDlStatus('error');
      toast.error('Error al cargar el data lake.');
    }
  }, [id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? null;
      setToken(t);
      if (t) load(t);
      else setLoading(false);
    });
  }, [load]);

  // Cargar data lake cuando el usuario cambia a esa pestaña (lazy load)
  useEffect(() => {
    if (activeTab === 'datalake' && token && dlStatus === 'idle') {
      loadDatalake(token);
    }
  }, [activeTab, token, dlStatus, loadDatalake]);

  const handleAnalyze = async () => {
    if (!token || !id) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/survey-analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Análisis completado: ${data.processed} respuestas procesadas.`);
      load(token);
    } catch {
      toast.error('Error al analizar las respuestas.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnonymize = async () => {
    if (!token || !id) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/survey-anonymize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: id, k: 5, l: 2 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Pipeline de privacidad completado: ${data.ingested} registros al data lake.`);
      // Reset data lake para forzar recarga con datos frescos
      setDlStatus('idle');
      if (activeTab === 'datalake') loadDatalake(token);
    } catch {
      toast.error('Error en el pipeline de anonimización.');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!form) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-[#C4C4D4]">
      <p>Encuesta no encontrada.</p>
    </div>
  );

  const agg = buildAggregates(submissions);
  const pendingAnalysis = submissions.filter(s => !s.analysis_result && s.anonymization_status === 'raw').length;
  const pendingAnonymization = submissions.filter(s => s.anonymization_status === 'pseudonymized').length;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0EFF8]">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Header */}
        <Link to="/surveys" className="text-xs text-[#7C6FF7] hover:underline mb-4 block">← Mis encuestas</Link>
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{form.title}</h1>
            {form.description && <p className="text-sm text-[#C4C4D4] mt-1">{form.description}</p>}
            <p className="text-xs text-white/30 mt-1">{form.schema_json?.fields?.length ?? 0} preguntas</p>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            {form.unique_slug && (
              <button
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/s/${form.unique_slug}`); toast.success('Enlace copiado'); }}
                className="text-xs border border-white/10 text-[#C4C4D4] hover:text-white px-3 py-2 rounded-xl transition-colors"
              >
                Copiar link
              </button>
            )}
            {pendingAnalysis > 0 && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="text-xs bg-[#7C6FF7] hover:bg-[#6B5FE6] text-white font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {analyzing ? 'Analizando...' : `Analizar ${pendingAnalysis} nuevas`}
              </button>
            )}
            {pendingAnonymization > 0 && (
              <button
                onClick={handleAnonymize}
                className="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                Anonimizar {pendingAnonymization} → Data Lake
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#12121A] border border-white/5 rounded-xl p-1 mb-6 w-fit">
          <button
            onClick={() => setActiveTab('ai')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'ai' ? 'bg-[#7C6FF7] text-white' : 'text-[#C4C4D4] hover:text-white'
            }`}
          >
            Análisis IA
          </button>
          <button
            onClick={() => setActiveTab('datalake')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'datalake' ? 'bg-[#7C6FF7] text-white' : 'text-[#C4C4D4] hover:text-white'
            }`}
          >
            Data Lake 🔐
          </button>
        </div>

        {/* ── PESTAÑA: Análisis IA ── */}
        {activeTab === 'ai' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MetricCard label="Respuestas totales" value={agg.total_submissions} />
              <MetricCard label="Analizadas por IA" value={agg.analyzed_count} sub="Structured Output" />
              <MetricCard label="Fricción promedio" value={`${agg.avg_friction_score}/10`}
                accent={agg.avg_friction_score >= 7 ? 'text-red-400' : agg.avg_friction_score >= 5 ? 'text-amber-400' : 'text-green-400'} />
              <MetricCard label="Disposición a pagar" value={`${agg.willingness_to_pay_pct}%`} sub="basado en hechos pasados"
                accent={agg.willingness_to_pay_pct >= 40 ? 'text-green-400' : 'text-amber-400'} />
            </div>

            {agg.analyzed_count > 0 && (
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <SeverityBar distribution={agg.severity_distribution} total={agg.analyzed_count} />
                <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5">
                  <p className="text-xs font-bold text-[#C4C4D4] mb-4">Soluciones/parches más mencionados</p>
                  {agg.top_current_solutions.length === 0 ? (
                    <p className="text-xs text-white/30">Sin datos suficientes.</p>
                  ) : (
                    <div className="space-y-2">
                      {agg.top_current_solutions.map(({ solution, count }, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex-1 bg-[#0A0A0F] rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-[#7C6FF7]/60 rounded-full" style={{ width: `${Math.min(100, (count / agg.analyzed_count) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-[#C4C4D4] w-40 truncate">{solution}</span>
                          <span className="text-xs text-white/30 w-6 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5 md:col-span-2">
                  <p className="text-xs font-bold text-[#C4C4D4] mb-4">Señales Mom Test en las respuestas</p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Hablan de hechos pasados', pct: agg.mom_test_scores.talks_about_past_pct },
                      { label: 'Mencionan dinero gastado', pct: agg.mom_test_scores.mentions_money_spent_pct },
                      { label: 'Revelan parches actuales', pct: agg.mom_test_scores.reveals_workarounds_pct },
                    ].map(({ label, pct }) => (
                      <div key={label} className="text-center">
                        <p className={`text-3xl font-black mb-1 ${pct >= 60 ? 'text-green-400' : pct >= 30 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</p>
                        <p className="text-xs text-[#C4C4D4]">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-bold text-[#C4C4D4] mb-4">
                Respuestas individuales ({submissions.length})
                {pendingAnalysis > 0 && <span className="ml-2 text-xs text-amber-400 font-normal">{pendingAnalysis} pendientes de análisis</span>}
              </h2>
              {submissions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                  <p className="text-3xl mb-3">📭</p>
                  <p className="text-sm text-[#C4C4D4] mb-2">Aún no hay respuestas.</p>
                  {form.is_published && form.unique_slug && (
                    <p className="text-xs text-white/30">Comparte: {window.location.origin}/s/{form.unique_slug}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map(sub =>
                    sub.analysis_result
                      ? <SubmissionCard key={sub.id} sub={sub} />
                      : (
                        <div key={sub.id} className="bg-[#12121A] border border-white/5 rounded-2xl p-4 text-xs text-white/30 flex items-center gap-2">
                          <span>⏳</span>
                          <span>Respuesta del {new Date(sub.created_at).toLocaleDateString('es-CL')} — pendiente de análisis IA</span>
                        </div>
                      )
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── PESTAÑA: Data Lake con Privacidad Diferencial ── */}
        {activeTab === 'datalake' && (
          <div>
            {/* Patrón 1: Badge de garantía (educativo, no técnico) */}
            <div className="mb-6">
              <DpBadge epsilon={EPSILON} />
            </div>

            {/* Patrón 4: Loading state */}
            {dlStatus === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 border-2 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#C4C4D4]">Consultando data lake con privacidad diferencial...</p>
              </div>
            )}

            {/* Patrón 4: Empty state por quórum insuficiente */}
            {dlStatus === 'insufficient_data' && <DatalakeInsufficientState />}

            {/* Patrón 4: Error state */}
            {dlStatus === 'error' && (
              <div className="text-center py-12">
                <p className="text-3xl mb-3">⚠️</p>
                <p className="text-sm text-[#C4C4D4] mb-4">Error al conectar con el data lake.</p>
                <button onClick={() => { setDlStatus('idle'); token && loadDatalake(token); }}
                  className="text-xs text-[#7C6FF7] hover:underline">Reintentar</button>
              </div>
            )}

            {/* Patrón 2 + 3: Métricas con márgenes de error */}
            {dlStatus === 'ready' && (
              <>
                {/* KPIs con intervalos de confianza */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {dlData.wtp && (
                    <DpMetricCard
                      label="Disposición a pagar"
                      value={sanitizeRate(dlData.wtp.wtp_rate)}
                      margin={rateMarginPct(EPSILON, dlData.wtp.n)}
                      unit="%"
                      accent={dlData.wtp.wtp_rate >= 40 ? 'text-green-400' : 'text-amber-400'}
                      tooltip="Tasa de encuestados que demostraron WTP mediante comportamientos pasados."
                    />
                  )}
                  {dlData.friction && (
                    <DpMetricCard
                      label="Fricción promedio"
                      value={sanitizeScore(dlData.friction.avg_friction)}
                      margin={scoreMargin(EPSILON, dlData.friction.n)}
                      unit="/10"
                      accent={dlData.friction.avg_friction >= 7 ? 'text-red-400' : dlData.friction.avg_friction >= 5 ? 'text-amber-400' : 'text-green-400'}
                      tooltip="Promedio del friction_score en el data lake anonimizado."
                    />
                  )}
                  {dlData.severity && (
                    <DpMetricCard
                      label="Registros en data lake"
                      value={sanitizeCount(dlData.severity.total_noisy)}
                      margin={countMargin(EPSILON)}
                      tooltip="Total de respuestas que superaron k-anonimato y l-diversidad."
                    />
                  )}
                </div>

                {/* Gráficos con bandas de incertidumbre */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {dlData.severity && (
                    <DpSeverityBar
                      distribution={dlData.severity.distribution}
                      totalNoisy={dlData.severity.total_noisy}
                      epsilon={EPSILON}
                    />
                  )}
                  {dlData.industry && (
                    <DpIndustryChart
                      breakdown={dlData.industry.breakdown}
                      n={dlData.industry.n}
                      epsilon={EPSILON}
                    />
                  )}
                  {dlData.solutions && (
                    <DpSolutionsChart
                      solutions={dlData.solutions.top_solutions}
                      epsilon={EPSILON}
                    />
                  )}
                  {dlData.momTest && (
                    <DpMomTestSignals data={dlData.momTest} epsilon={EPSILON} />
                  )}
                </div>

                {/* Footer educativo sobre la incertidumbre */}
                <div className="bg-[#12121A] border border-[#7C6FF7]/10 rounded-xl p-4 text-xs text-[#C4C4D4]/60">
                  <strong className="text-[#C4C4D4]/80">¿Por qué los números muestran rangos?</strong>{' '}
                  Esta analítica aplica el Mecanismo de Laplace (ε={EPSILON}) para garantizar que ningún encuestado
                  individual pueda ser identificado por sus respuestas, incluso si alguien accede al data lake.
                  Las variaciones menores entre recargas son normales y esperadas — la tendencia estadística es confiable.
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer privacidad */}
        <div className="mt-10 p-4 bg-[#12121A] border border-white/5 rounded-xl text-xs text-white/30">
          <strong className="text-white/50">Privacidad (Ley N° 21.719):</strong>{' '}
          Las respuestas individuales se almacenan bajo consentimiento explícito y RLS.
          El data lake aplica k-anonimato (k≥5) + l-diversidad (l≥2) antes de la ingestión,
          y privacidad diferencial (ε={EPSILON}) en todas las consultas analíticas.
        </div>
      </div>
    </div>
  );
}
