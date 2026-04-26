import { useState } from 'react';
import { useAI } from '@/hooks/useAI';

interface Props {
  validationId: string;
  context: Record<string, unknown>;
}

const DELIVERABLES = [
  { id: 'validation_kit',      label: 'Kit 48h',       icon: '🧪', desc: 'Experimentos concretos para validar en 48 horas' },
  { id: 'landing_generator',   label: 'Landing',        icon: '🖥️', desc: 'Copy completo para tu página de preventa' },
  { id: 'interview_script',    label: 'Entrevistas',    icon: '🎤', desc: 'Guión para entrevistas de usuario' },
  { id: 'tech_viability',      label: 'Tech Stack',     icon: '⚙️', desc: 'Análisis técnico y stack recomendado' },
  { id: 'first_100_customers', label: 'Primeros 100',   icon: '📣', desc: 'Plan para conseguir tus primeros 100 clientes' },
  { id: 'revenue_models',      label: 'Monetización',   icon: '💰', desc: 'Comparativa de modelos de ingreso' },
  { id: 'risk_checklist',      label: 'Riesgos',        icon: '⚠️', desc: 'Checklist de riesgos y criterios go/no-go' },
  { id: 'pitch_letter',        label: 'Pitch',          icon: '📝', desc: 'Email y elevator pitch para inversores' },
] as const;

type DeliverableId = typeof DELIVERABLES[number]['id'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DeliverableData = Record<string, any>;

function ValidationKitView({ d }: { d: DeliverableData }) {
  return (
    <div className="space-y-4">
      <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
        <p className="text-xs font-bold text-teal-700 uppercase mb-1">Hipótesis principal</p>
        <p className="text-sm text-gray-800">{d.hypothesis}</p>
      </div>
      {d.experiments?.map((exp: DeliverableData, i: number) => (
        <div key={i} className="border border-gray-100 rounded-xl p-4">
          <p className="font-semibold text-gray-900 text-sm mb-2">{exp.name}</p>
          <p className="text-xs text-gray-500 mb-1"><strong>Cómo:</strong> {exp.how}</p>
          <p className="text-xs text-gray-500 mb-1"><strong>Métrica:</strong> {exp.metric}</p>
          <p className="text-xs text-gray-500"><strong>Éxito si:</strong> {exp.success_criteria}</p>
        </div>
      ))}
      {d.expected_learnings && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs font-bold text-blue-700 uppercase mb-1">Aprendizajes esperados</p>
          <p className="text-sm text-gray-700">{d.expected_learnings}</p>
        </div>
      )}
    </div>
  );
}

function LandingView({ d }: { d: DeliverableData }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-2xl p-5 text-white">
        <p className="text-xl font-black mb-2">{d.headline}</p>
        <p className="text-gray-300 text-sm mb-4">{d.subheadline}</p>
        <div className="space-y-1.5 mb-5">
          {d.value_props?.map((vp: string, i: number) => (
            <p key={i} className="text-sm text-gray-200">✓ {vp}</p>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-bold">{d.cta_primary}</div>
          {d.cta_secondary && <div className="border border-white/30 text-white px-4 py-2 rounded-xl text-sm">{d.cta_secondary}</div>}
        </div>
      </div>
      {d.ab_variants?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Variantes A/B</p>
          {d.ab_variants.map((v: DeliverableData, i: number) => (
            <div key={i} className="border border-gray-100 rounded-xl p-3 mb-2">
              <p className="text-xs font-semibold text-gray-700 mb-1">{v.name}</p>
              <p className="text-sm text-gray-900 font-bold mb-1">"{v.headline}"</p>
              <p className="text-xs text-gray-500">{v.rationale}</p>
            </div>
          ))}
        </div>
      )}
      {d.faq?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">FAQ sugerido</p>
          {d.faq.map((item: DeliverableData, i: number) => (
            <div key={i} className="mb-3">
              <p className="text-sm font-semibold text-gray-900">Q: {item.q}</p>
              <p className="text-sm text-gray-600 mt-0.5">A: {item.a}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InterviewView({ d }: { d: DeliverableData }) {
  return (
    <div className="space-y-4">
      <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
        <p className="text-xs font-bold text-violet-700 uppercase mb-1">Perfil del entrevistado</p>
        <p className="text-sm text-gray-800">{d.target_profile}</p>
      </div>
      {d.phases?.map((phase: DeliverableData, i: number) => (
        <div key={i} className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-900 text-sm">{phase.name}</p>
            <span className="text-xs text-gray-400">{phase.duration_minutes} min</span>
          </div>
          {phase.questions?.map((q: string, j: number) => (
            <p key={j} className="text-sm text-gray-700 mb-1.5 pl-2 border-l-2 border-teal-200">{q}</p>
          ))}
          {phase.tips && <p className="text-xs text-teal-600 mt-2 italic">{phase.tips}</p>}
        </div>
      ))}
      {d.green_signals?.length > 0 && (
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <p className="text-xs font-bold text-green-700 uppercase mb-2">Señales positivas</p>
          {d.green_signals.map((s: string, i: number) => <p key={i} className="text-xs text-gray-700">✓ {s}</p>)}
        </div>
      )}
    </div>
  );
}

function TechView({ d }: { d: DeliverableData }) {
  const complexityColor = d.complexity === 'low' ? 'text-green-600' : d.complexity === 'medium' ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className={`text-2xl font-black ${complexityColor} capitalize`}>{d.complexity}</p>
          <p className="text-xs text-gray-400">complejidad</p>
        </div>
        <p className="text-sm text-gray-600 flex-1">{d.complexity_rationale}</p>
      </div>
      {d.recommended_stack && (
        <div className="border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Stack recomendado</p>
          {(['frontend', 'backend', 'database', 'hosting'] as const).map((key) =>
            d.recommended_stack[key] ? (
              <div key={key} className="flex justify-between text-sm py-1 border-b border-gray-50">
                <span className="text-gray-500 capitalize">{key}</span>
                <span className="font-semibold text-gray-900">{d.recommended_stack[key]}</span>
              </div>
            ) : null
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-gray-900">{d.build_time_weeks?.mvp ?? '—'}</p>
          <p className="text-xs text-gray-400">semanas MVP</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-gray-900">${d.monthly_infra_cost_usd?.min ?? '—'}</p>
          <p className="text-xs text-gray-400">USD/mes infra</p>
        </div>
      </div>
      {d.key_risks?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Riesgos técnicos</p>
          {d.key_risks.map((r: string, i: number) => <p key={i} className="text-sm text-gray-600">⚠ {r}</p>)}
        </div>
      )}
    </div>
  );
}

function First100View({ d }: { d: DeliverableData }) {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
        <p className="text-sm text-gray-800">{d.strategy_overview}</p>
      </div>
      {d.phases?.map((phase: DeliverableData, i: number) => (
        <div key={i} className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-900 text-sm">{phase.name}</p>
            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{phase.target} clientes</span>
          </div>
          <p className="text-xs text-gray-500 mb-1"><strong>Canal:</strong> {phase.channel}</p>
          <p className="text-xs text-gray-500 mb-1"><strong>Táctica:</strong> {phase.tactic}</p>
          <div className="flex gap-4 mt-2">
            <span className="text-xs text-gray-400">${(phase.budget_clp / 1000).toFixed(0)}K CLP</span>
            <span className="text-xs text-gray-400">{phase.time_weeks} semanas</span>
          </div>
        </div>
      ))}
      {d.early_evangelists && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs font-bold text-blue-700 uppercase mb-1">Early evangelists</p>
          <p className="text-sm text-gray-700">{d.early_evangelists}</p>
        </div>
      )}
    </div>
  );
}

function RevenueView({ d }: { d: DeliverableData }) {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
        <p className="text-xs font-bold text-green-700 uppercase mb-1">Modelo recomendado: {d.recommended_model}</p>
        <p className="text-sm text-gray-700">{d.recommended_rationale}</p>
      </div>
      {d.models?.map((m: DeliverableData, i: number) => (
        <div key={i} className="border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-900 text-sm">{m.name}</p>
            <span className={`text-xs font-bold ${m.fit_score >= 70 ? 'text-green-600' : m.fit_score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{m.fit_score}%</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">{m.description}</p>
          <p className="text-xs font-semibold text-gray-600 mb-1">Precio ejemplo: {m.example_pricing}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              {m.pros?.map((p: string, j: number) => <p key={j} className="text-xs text-green-700">+ {p}</p>)}
            </div>
            <div>
              {m.cons?.map((c: string, j: number) => <p key={j} className="text-xs text-red-700">− {c}</p>)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskChecklistView({ d }: { d: DeliverableData }) {
  return (
    <div className="space-y-4">
      {d.critical_risks?.map((r: DeliverableData, i: number) => (
        <div key={i} className={`border rounded-xl p-4 ${r.probability === 'high' && r.impact === 'high' ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-semibold text-gray-900 text-sm flex-1">{r.risk}</p>
            <div className="flex gap-1 shrink-0">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${r.probability === 'high' ? 'bg-red-100 text-red-700' : r.probability === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{r.probability}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-1"><strong>Categoría:</strong> {r.category}</p>
          <p className="text-xs text-teal-700">→ {r.mitigation}</p>
        </div>
      ))}
      {d.go_nogo_criteria?.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-300 uppercase mb-2">Criterios Go / No-Go</p>
          {d.go_nogo_criteria.map((c: string, i: number) => <p key={i} className="text-sm text-gray-200 mb-1">✓ {c}</p>)}
        </div>
      )}
    </div>
  );
}

function PitchView({ d }: { d: DeliverableData }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(d.email_body ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-4">
      {d.one_liner && (
        <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
          <p className="text-xs font-bold text-teal-700 uppercase mb-1">One-liner</p>
          <p className="text-sm font-semibold text-gray-900">{d.one_liner}</p>
        </div>
      )}
      {d.email_body && (
        <div className="border border-gray-200 rounded-xl p-4 relative">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase">Email para inversor</p>
            <button onClick={handleCopy} className="text-xs font-semibold text-teal-600 hover:text-teal-800">
              {copied ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-2">Asunto: {d.subject_line}</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.email_body}</p>
        </div>
      )}
      {d.elevator_pitch && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Elevator pitch (60s)</p>
          <p className="text-sm text-gray-700">{d.elevator_pitch}</p>
        </div>
      )}
      {d.deck_outline?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Estructura del deck</p>
          {d.deck_outline.map((slide: DeliverableData) => (
            <div key={slide.slide} className="flex gap-3 mb-2">
              <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0">{slide.slide}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{slide.title}</p>
                <p className="text-xs text-gray-500">{slide.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const VIEWS: Record<DeliverableId, React.ComponentType<{ d: DeliverableData }>> = {
  validation_kit:      ValidationKitView,
  landing_generator:   LandingView,
  interview_script:    InterviewView,
  tech_viability:      TechView,
  first_100_customers: First100View,
  revenue_models:      RevenueView,
  risk_checklist:      RiskChecklistView,
  pitch_letter:        PitchView,
};

export function DeliverableTabs({ validationId, context }: Props) {
  const [activeTab, setActiveTab] = useState<DeliverableId>('validation_kit');
  const [results, setResults] = useState<Partial<Record<DeliverableId, DeliverableData>>>({});
  const [loadingTab, setLoadingTab] = useState<DeliverableId | null>(null);
  const { callAI } = useAI();

  const handleGenerate = async (id: DeliverableId) => {
    if (results[id] || loadingTab) return;
    setLoadingTab(id);
    try {
      const data = await callAI<DeliverableData>(validationId, 99, id as never, context);
      if (data) setResults((prev) => ({ ...prev, [id]: data }));
    } finally {
      setLoadingTab(null);
    }
  };

  const currentDeliverable = DELIVERABLES.find((d) => d.id === activeTab)!;
  const ViewComponent = VIEWS[activeTab];
  const result = results[activeTab];
  const isLoading = loadingTab === activeTab;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-0">
        <h3 className="font-black text-gray-900 text-base mb-1">Entregables post-validación</h3>
        <p className="text-xs text-gray-400 mb-4">Herramientas generadas por IA para ejecutar tu startup</p>
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0 border-b border-gray-100">
          {DELIVERABLES.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveTab(d.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-colors
                ${activeTab === d.id
                  ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/50'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span>{d.icon}</span>
              {d.label}
              {results[d.id] && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <p className="text-xs text-gray-400 mb-4">{currentDeliverable.desc}</p>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Generando con IA...</p>
          </div>
        ) : result ? (
          <div>
            <ViewComponent d={result} />
            <button
              onClick={() => setResults((prev) => { const n = {...prev}; delete n[activeTab]; return n; })}
              className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Regenerar
            </button>
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">{currentDeliverable.icon}</div>
            <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">{currentDeliverable.desc}</p>
            <button
              onClick={() => handleGenerate(activeTab)}
              disabled={!!loadingTab}
              className="px-6 py-3 bg-teal-500 text-white font-semibold rounded-xl
                         hover:bg-teal-600 active:scale-[0.98] transition-all text-sm
                         disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-teal-500/20"
            >
              Generar {currentDeliverable.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
