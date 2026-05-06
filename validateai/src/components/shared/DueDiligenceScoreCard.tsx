import type { DueDiligenceScore, ExtractedProjectData } from '@/types/validation';

// ── Gap micro-recommendations ─────────────────────────────────────────────────
// Actionable prescriptions paired to each known gap label (Mandato 2)
const GAP_RECOMMENDATIONS: Record<string, string> = {
  'MRR no definido':                    'Define un precio de lanzamiento y busca 3 usuarios dispuestos a pagar hoy, aunque sea simbólico.',
  'CAC no cuantificado':                'Implementa un modelo de cohortes: rastrea el gasto de adquisición por canal (paid, organic, referral) dividido por clientes obtenidos.',
  'LTV no calculado':                   'Calcula LTV = ARPU × meses promedio de retención. Si no tienes datos, usa benchmarks de tu industria como proxy.',
  'Payback period desconocido':         'Payback = CAC ÷ margen mensual por cliente. Si supera 18 meses, revisar precio o reducir CAC.',
  'Modelo de ingresos no definido':     'Elige un modelo primario (suscripción, transaccional, licencia) antes de hablar con inversores. Los híbridos confunden.',
  'Sin evidencia de clientes de pago (Mom Test)': 'Aplica el Mom Test: consigue 3 pre-orders o LOIs firmados. Los usuarios gratuitos no validan el modelo.',
  'Número de clientes no reportado':    'Documenta todos los clientes activos (de pago o en piloto) con nombre, empresa y fecha de inicio.',
  'Sin MRR real — posible pre-revenue': 'Si eres pre-revenue, indica el pipeline con nombres y montos. Los inversores seed toleran cero MRR con pipeline sólido.',
  'Cumplimiento Ley 21.719 (Datos) no evaluado': 'Evalúa si procesas datos personales de usuarios chilenos. Si sí, implementa Privacy by Design antes del lanzamiento (multas hasta 20.000 UTM).',
  'Cumplimiento Ley 21.521 (Fintech) no evaluado': 'Si tu modelo toca pagos, crédito o inversión, consulta si requieres inscripción en el Registro CMF. Ignorarlo puede bloquear el fundraising.',
  'Problema de mercado no articulado':  'Escribe el problema en una oración: "X% de [segmento] sufre [problema] porque [causa raíz], costándoles [impacto medible]".',
  'Solución no descrita claramente':    'Define tu solución con el formato Jobs-to-be-Done: "Cuando [situación], quiero [motivación], para [resultado esperado]".',
  'TAM no dimensionado':                'Usa metodología bottom-up: [# clientes potenciales] × [precio anual] = SOM. Escala desde ahí a SAM y TAM.',
  'Segmento objetivo no definido':      'Define tu ICP (Ideal Customer Profile): industria, tamaño de empresa, cargo del decision-maker, presupuesto disponible.',
  'Tamaño del equipo no especificado':  'Incluye el headcount actual y las 2 primeras contrataciones planificadas con el fundraising.',
  'Trayectoria del fundador no documentada': 'Documenta los "unfair advantages": ¿cuántos años en la industria? ¿startups previas? ¿red de contactos en el segmento?',
};

function getRecommendation(gap: string): string {
  return GAP_RECOMMENDATIONS[gap] ?? 'Recopila evidencia empírica (entrevistas, datos de uso, contratos) para cerrar este gap antes de la ronda.';
}

// ── Color coding ──────────────────────────────────────────────────────────────
function readinessConfig(readiness: DueDiligenceScore['investorReadiness']) {
  switch (readiness) {
    case 'ready':       return { label: 'Listo para Ronda',   bg: 'bg-emerald-50 dark:bg-emerald-900/15', border: 'border-emerald-200 dark:border-emerald-700/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' };
    case 'developing':  return { label: 'En Desarrollo',      bg: 'bg-amber-50 dark:bg-amber-900/15',   border: 'border-amber-200 dark:border-amber-700/30',   text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-500'   };
    case 'early':       return { label: 'Etapa Temprana',     bg: 'bg-orange-50 dark:bg-orange-900/15', border: 'border-orange-200 dark:border-orange-700/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500'  };
    case 'not_ready':   return { label: 'No Listo',           bg: 'bg-red-50 dark:bg-red-900/15',       border: 'border-red-200 dark:border-red-700/30',       text: 'text-red-700 dark:text-red-400',       dot: 'bg-red-500'     };
  }
}

function scoreToColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreToTextColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 45) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// ── Dimension progress bar ────────────────────────────────────────────────────
function DimensionBar({ label, score, icon }: { label: string; score: number; icon: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-semibold text-gray-700 dark:text-[#C4C4D4]">{label}</span>
        </div>
        <span className={`text-xs font-black tabular-nums ${scoreToTextColor(score)}`}>{score}/100</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${scoreToColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ── Gap card ──────────────────────────────────────────────────────────────────
function GapCard({ gap, index }: { gap: string; index: number }) {
  const rec = getRecommendation(gap);
  return (
    <div className="flex gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/8">
      <div className="shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800/30 flex items-center justify-center mt-0.5">
        <span className="text-[10px] font-black text-red-600 dark:text-red-400">{index + 1}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFF8] mb-1">{gap}</p>
        <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{rec}</p>
      </div>
    </div>
  );
}

// ── Extracted data summary ────────────────────────────────────────────────────
function ExtractedSummary({ data }: { data: ExtractedProjectData }) {
  const fields: { label: string; value: string | undefined | null }[] = [
    { label: 'Modelo de ingresos', value: data.revenueModel },
    { label: 'MRR',                value: data.mrr != null ? `$${data.mrr.toLocaleString()} USD` : undefined },
    { label: 'ARR',                value: data.arr != null ? `$${data.arr.toLocaleString()} USD` : undefined },
    { label: 'CAC',                value: data.cac != null ? `$${data.cac.toLocaleString()} USD` : undefined },
    { label: 'LTV',                value: data.ltv != null ? `$${data.ltv.toLocaleString()} USD` : undefined },
    { label: 'Payback',            value: data.paybackPeriod != null ? `${data.paybackPeriod} meses` : undefined },
    { label: 'Clientes',           value: data.customerCount != null ? String(data.customerCount) : undefined },
    { label: 'Equipo',             value: data.teamSize != null ? `${data.teamSize} personas` : undefined },
    { label: 'TAM',                value: data.tam },
  ].filter((f) => f.value);

  if (!fields.length) return null;

  return (
    <div className="bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5 rounded-2xl p-5">
      <p className="text-xs font-bold text-gray-400 dark:text-[#4A495E] uppercase tracking-widest mb-3">
        Datos extraídos del documento
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {fields.map(({ label, value }) => (
          <div key={label} className="space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-[#4A495E] uppercase tracking-wide">{label}</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFF8] truncate">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  score: DueDiligenceScore;
  extractedData?: ExtractedProjectData | null;
}

const DIMENSION_META: { key: keyof DueDiligenceScore['dimensions']; icon: string }[] = [
  { key: 'financiero', icon: '💰' },
  { key: 'legal',      icon: '⚖️' },
  { key: 'mercado',    icon: '🌍' },
  { key: 'equipo',     icon: '👥' },
  { key: 'traccion',   icon: '📈' },
];

export function DueDiligenceScoreCard({ score, extractedData }: Props) {
  const rc = readinessConfig(score.investorReadiness);
  const totalColor = score.total >= 70 ? 'text-emerald-600 dark:text-emerald-400' : score.total >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const totalBg    = score.total >= 70 ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-700/30' : score.total >= 45 ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-700/30' : 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-700/30';

  return (
    <div className="space-y-5">

      {/* ── Hero Score ─────────────────────────────────────────────────────── */}
      <div className={`rounded-3xl border-2 p-6 ${totalBg}`}>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Big score circle */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-200 dark:text-white/10" />
                <circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  stroke={score.total >= 70 ? '#10b981' : score.total >= 45 ? '#f59e0b' : '#ef4444'}
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - score.total / 100)}`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black leading-none ${totalColor}`}>{score.total}</span>
                <span className="text-[10px] font-bold text-gray-400 dark:text-[#4A495E]">/100</span>
              </div>
            </div>
            <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${rc.bg} ${rc.border} ${rc.text}`}>
              <span className={`w-2 h-2 rounded-full ${rc.dot}`} />
              {rc.label}
            </div>
          </div>

          {/* Description */}
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-bold text-gray-400 dark:text-[#4A495E] uppercase tracking-widest mb-1">
              Due Diligence Score — Preparación para Ronda de Inversión
            </p>
            <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed">
              Este score evalúa qué tan preparado está tu proyecto para pasar el filtro de un fondo de Venture Capital.
              Un score de 80+ indica que el reporte tiene suficiente rigor para una primera reunión con inversores.
            </p>
            {score.topGaps.length > 0 && (
              <p className="text-xs text-gray-400 dark:text-[#4A495E] mt-2">
                <strong>{score.topGaps.length}</strong> gap{score.topGaps.length > 1 ? 's' : ''} crítico{score.topGaps.length > 1 ? 's' : ''} detectado{score.topGaps.length > 1 ? 's' : ''} · Ver recomendaciones abajo
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 5 Dimensions ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-bold text-gray-400 dark:text-[#4A495E] uppercase tracking-widest mb-4">
          Desglose por dimensión
        </p>
        <div className="space-y-4">
          {DIMENSION_META.map(({ key, icon }) => {
            const dim = score.dimensions[key];
            return (
              <DimensionBar
                key={key}
                label={dim.label}
                score={dim.score}
                icon={icon}
              />
            );
          })}
        </div>
      </div>

      {/* ── Extracted Data Summary ─────────────────────────────────────────── */}
      {extractedData && <ExtractedSummary data={extractedData} />}

      {/* ── Top Gaps + Recommendations ─────────────────────────────────────── */}
      {score.topGaps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-800 dark:text-[#F0EFF8]">Gaps críticos — qué exigirá un inversor</p>
          </div>
          {score.topGaps.map((gap, i) => (
            <GapCard key={i} gap={gap} index={i} />
          ))}
        </div>
      )}

      {/* ── All-clear ──────────────────────────────────────────────────────── */}
      {score.topGaps.length === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-700/30">
          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Sin gaps críticos detectados. Tu documento cubre los puntos clave que un inversor revisar.
          </p>
        </div>
      )}
    </div>
  );
}
