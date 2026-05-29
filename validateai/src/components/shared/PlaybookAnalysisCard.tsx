import { useState } from 'react';
import { AlertTriangle, Target, TrendingUp, Brain, Rocket, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { EmptyStateAI } from '@/components/shared/EmptyStateAI';

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
  _fallo_elegante?: boolean;
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
  if (data._fallo_elegante) {
    return (
      <EmptyStateAI
        title="Validación Pionera"
        description="Tu idea opera en un espacio tan emergente que nuestras fuentes verificadas aún no lo cubren. Procede con entrevistas cualitativas directas (Mom Test) para construir tu propio corpus de validación."
      />
    );
  }
  return (
    <div className="space-y-4">
      {/* Harsh truth — always open */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold text-red-300">Verdad incómoda</span>
        </div>
        <p className="text-sm text-gray-200 leading-relaxed">{data.harsh_truth}</p>
      </div>

      {/* Unit Economics — solo análisis cuantitativo queda en Veredicto */}
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
