import { useState } from 'react';
import { AlertTriangle, Target, ClipboardList, TrendingUp, Shield, Gauge, Brain, Rocket, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';

interface PlaybookAnalysis {
  harsh_truth: string;
  jtbd_analysis: string;
  validation_playbook: string[];
  unit_economics_check: string;
  tech_and_legal_stack: string;
  gtm_and_growth_plan?: string;
  funding_verdict?: string;
  product_ai_strategy?: string;
  founder_bias_warning?: string;
  viability_score: number;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-400' : score >= 45 ? 'text-amber-400' : 'text-red-400';
  const label = score >= 70 ? 'Viable' : score >= 45 ? 'Con riesgos' : 'Alto riesgo';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-5xl font-bold tabular-nums ${color}`}>{score}</div>
      <div className="text-xs text-gray-400 uppercase tracking-widest">{label}</div>
    </div>
  );
}

function AccordionSection({
  icon,
  iconColor,
  title,
  borderColor,
  bgColor,
  titleColor,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  borderColor: string;
  bgColor: string;
  titleColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-5 text-left"
      >
        <span className={iconColor}>{icon}</span>
        <span className={`text-sm font-semibold flex-1 ${titleColor}`}>{title}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

export function PlaybookAnalysisCard({ data }: { data: PlaybookAnalysis }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      {/* Header score */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex items-center gap-6">
        <Gauge className="h-6 w-6 text-violet-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white mb-0.5">Viabilidad</p>
          <p className="text-xs text-gray-400">Score VC basado en riesgo de mercado (1–100)</p>
        </div>
        <ScoreRing score={data.viability_score} />
      </div>

      {/* Harsh truth — always open, no accordion */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold text-red-300">Verdad incómoda</span>
        </div>
        <p className="text-sm text-gray-200 leading-relaxed">{data.harsh_truth}</p>
      </div>

      {/* 2-column grid for secondary sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* JTBD */}
        <AccordionSection
          icon={<Target className="h-4 w-4" />}
          iconColor="text-violet-400"
          title="Job-to-be-Done real"
          borderColor="border-white/10"
          bgColor="bg-white/5"
          titleColor="text-white"
          defaultOpen
        >
          <p className="text-sm text-gray-300 leading-relaxed">{data.jtbd_analysis}</p>
        </AccordionSection>

        {/* Unit economics */}
        <AccordionSection
          icon={<TrendingUp className="h-4 w-4" />}
          iconColor="text-amber-400"
          title="Unit Economics"
          borderColor="border-white/10"
          bgColor="bg-white/5"
          titleColor="text-white"
          defaultOpen
        >
          <p className="text-sm text-gray-300 leading-relaxed">{data.unit_economics_check}</p>
        </AccordionSection>
      </div>

      {/* Validation playbook — full width */}
      <AccordionSection
        icon={<ClipboardList className="h-4 w-4" />}
        iconColor="text-teal-400"
        title="Playbook Mom Test — 3 pasos"
        borderColor="border-white/10"
        bgColor="bg-white/5"
        titleColor="text-white"
        defaultOpen
      >
        <ol className="space-y-2">
          {(data.validation_playbook ?? []).map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-300">
              <span className="shrink-0 w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 text-xs flex items-center justify-center font-bold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </AccordionSection>

      {/* Tech & legal */}
      <AccordionSection
        icon={<Shield className="h-4 w-4" />}
        iconColor="text-blue-400"
        title="Stack No-Code &amp; Legal Chile"
        borderColor="border-white/10"
        bgColor="bg-white/5"
        titleColor="text-white"
      >
        <p className="text-sm text-gray-300 leading-relaxed">{data.tech_and_legal_stack}</p>
      </AccordionSection>

      {/* ── New sections ── */}

      {/* GTM & Growth */}
      {data.gtm_and_growth_plan && (
        <AccordionSection
          icon={<Rocket className="h-4 w-4" />}
          iconColor="text-emerald-400"
          title="Go-to-Market &amp; Ventas"
          borderColor="border-emerald-500/30"
          bgColor="bg-emerald-500/5"
          titleColor="text-emerald-200"
        >
          <p className="text-sm text-gray-300 leading-relaxed">{data.gtm_and_growth_plan}</p>
        </AccordionSection>
      )}

      {/* Funding verdict */}
      {data.funding_verdict && (
        <AccordionSection
          icon={<DollarSign className="h-4 w-4" />}
          iconColor="text-yellow-400"
          title="Veredicto de Inversión"
          borderColor="border-yellow-500/30"
          bgColor="bg-yellow-500/5"
          titleColor="text-yellow-200"
        >
          <p className="text-sm text-gray-300 leading-relaxed">{data.funding_verdict}</p>
        </AccordionSection>
      )}

      {/* Product AI strategy */}
      {data.product_ai_strategy && (
        <AccordionSection
          icon={<Target className="h-4 w-4" />}
          iconColor="text-sky-400"
          title="Estrategia de Producto &amp; IA (Blue Ocean)"
          borderColor="border-sky-500/30"
          bgColor="bg-sky-500/5"
          titleColor="text-sky-200"
        >
          <p className="text-sm text-gray-300 leading-relaxed">{data.product_ai_strategy}</p>
        </AccordionSection>
      )}

      {/* Founder bias warning */}
      {data.founder_bias_warning && (
        <AccordionSection
          icon={<Brain className="h-4 w-4" />}
          iconColor="text-orange-400"
          title="Diagnóstico de Sesgos Cognitivos"
          borderColor="border-orange-500/30"
          bgColor="bg-orange-500/10"
          titleColor="text-orange-200"
        >
          <p className="text-sm text-gray-300 leading-relaxed">{data.founder_bias_warning}</p>
        </AccordionSection>
      )}
    </div>
  );
}
