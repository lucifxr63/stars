'use client';

import { useState } from 'react';
import { useCarouselStore } from '@/stores/carouselStore';
import { CarouselEditor } from '@/components/carousel/CarouselEditor';
import type { CarouselPlatform, CarouselTheme } from '@/types/carousel';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AdminData {
  usersTotal: number;
  validationsTotal: number;
  completedValidations: number;
  completionRate: number;
  avgScore: number;
  totalTokens: number;
  projected30: number;
  abandonStep: string;
  aiInteractionsTotal: number;
  topIndustries: { name: string; value: number }[];
  topCountries: { name: string; value: number }[];
  topStages: { stage: string; count: number }[];
  topModels: { name: string; value: number; color: string }[];
  topPrompts: { type: string; count: number; tokens: number }[];
  tierDist: { name: string; value: number; color: string }[];
  scoreDist: { label: string; count: number }[];
}

interface Props {
  adminData: AdminData;
}

// ── Centros de información ────────────────────────────────────────────────────

const DATA_CENTERS = [
  {
    id: 'metrics' as const,
    icon: '📊',
    label: 'Métricas de plataforma',
    desc: 'Usuarios, validaciones, scores y proyecciones de crecimiento',
    color: 'teal',
  },
  {
    id: 'market_trends' as const,
    icon: '🌎',
    label: 'Tendencias de mercado',
    desc: 'Industrias, países y modelos de negocio más validados',
    color: 'violet',
  },
  {
    id: 'validation_patterns' as const,
    icon: '🧠',
    label: 'Patrones de validación',
    desc: 'Qué diferencia las ideas exitosas de las que fallan',
    color: 'amber',
  },
  {
    id: 'ai_usage' as const,
    icon: '⚡',
    label: 'AI Usage',
    desc: 'Modelos, prompts y cómo la IA transforma el proceso',
    color: 'blue',
  },
  {
    id: 'custom' as const,
    icon: '✏️',
    label: 'Tema personalizado',
    desc: 'Define tu propio ángulo narrativo con datos como respaldo',
    color: 'gray',
  },
];

type CenterId = typeof DATA_CENTERS[number]['id'];

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  teal:   { border: 'border-teal-400',   bg: 'bg-teal-50 dark:bg-teal-500/10',    text: 'text-teal-700 dark:text-teal-400',   badge: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400' },
  violet: { border: 'border-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400', badge: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400' },
  amber:  { border: 'border-amber-400',  bg: 'bg-amber-50 dark:bg-amber-500/10',  text: 'text-amber-700 dark:text-amber-400',  badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' },
  blue:   { border: 'border-blue-400',   bg: 'bg-blue-50 dark:bg-blue-500/10',    text: 'text-blue-700 dark:text-blue-400',   badge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' },
  gray:   { border: 'border-gray-300',   bg: 'bg-gray-50 dark:bg-white/5',         text: 'text-gray-600 dark:text-gray-400',   badge: 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300' },
};

// ── DataPreview ───────────────────────────────────────────────────────────────

function DataPreview({ center, adminData }: { center: CenterId; adminData: AdminData }) {
  if (center === 'metrics') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Usuarios',          val: adminData.usersTotal },
          { label: 'Validaciones',      val: adminData.validationsTotal },
          { label: 'Completadas',       val: adminData.completedValidations },
          { label: 'Completación',      val: `${adminData.completionRate}%` },
          { label: 'Score promedio',    val: `${adminData.avgScore}/100` },
          { label: 'Proyección 30d',    val: `+${adminData.projected30}` },
        ].map(({ label, val }) => (
          <div key={label} className="bg-white dark:bg-white/5 rounded-xl p-3 text-center border border-gray-100 dark:border-white/5">
            <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-sm font-black text-gray-900 dark:text-[#F0EFF8]">{val}</p>
          </div>
        ))}
      </div>
    );
  }

  if (center === 'market_trends') {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Top industrias</p>
          <div className="flex flex-wrap gap-1.5">
            {adminData.topIndustries.slice(0, 5).map(({ name, value }) => (
              <span key={name} className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 text-xs font-semibold border border-violet-200 dark:border-violet-500/20">
                {name} · {value}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Top países</p>
          <div className="flex flex-wrap gap-1.5">
            {adminData.topCountries.slice(0, 5).map(({ name, value }) => (
              <span key={name} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                {name} · {value}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (center === 'validation_patterns') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white dark:bg-white/5 rounded-xl p-3 text-center border border-gray-100 dark:border-white/5">
            <p className="text-[9px] text-gray-400 uppercase mb-1">Score promedio</p>
            <p className="text-lg font-black text-amber-600">{adminData.avgScore}/100</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-xl p-3 text-center border border-gray-100 dark:border-white/5">
            <p className="text-[9px] text-gray-400 uppercase mb-1">Mayor abandono</p>
            <p className="text-xs font-bold text-red-500 leading-tight">{adminData.abandonStep}</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Distribución de scores</p>
          <div className="flex gap-1.5">
            {adminData.scoreDist.map(({ label, count }) => (
              <div key={label} className="flex-1 text-center">
                <div className="bg-amber-100 dark:bg-amber-500/20 rounded-lg py-1.5 mb-1">
                  <p className="text-sm font-black text-amber-700 dark:text-amber-400">{count}</p>
                </div>
                <p className="text-[9px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (center === 'ai_usage') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white dark:bg-white/5 rounded-xl p-3 text-center border border-gray-100 dark:border-white/5">
            <p className="text-[9px] text-gray-400 uppercase mb-1">Interacciones AI</p>
            <p className="text-lg font-black text-blue-600">{adminData.aiInteractionsTotal.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-white/5 rounded-xl p-3 text-center border border-gray-100 dark:border-white/5">
            <p className="text-[9px] text-gray-400 uppercase mb-1">Total tokens</p>
            <p className="text-lg font-black text-blue-600">{(adminData.totalTokens / 1000).toFixed(0)}K</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Top prompts</p>
          <div className="space-y-1">
            {adminData.topPrompts.slice(0, 3).map(({ type, count }) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[72%]">{type}</span>
                <span className="text-xs font-bold text-blue-600 shrink-0">{count}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <p className="text-xs text-gray-400 italic">
      Define tu tema. Los datos de plataforma se usarán como evidencia de respaldo.
    </p>
  );
}

// ── Selectores reutilizables ──────────────────────────────────────────────────

const PLATFORMS: { value: CarouselPlatform; label: string; icon: string; desc: string }[] = [
  { value: 'linkedin',  label: 'LinkedIn',  icon: '💼', desc: 'PDF · 1:1 · B2B' },
  { value: 'instagram', label: 'Instagram', icon: '📸', desc: 'ZIP · 4:5 · B2C' },
];

const THEMES: { value: CarouselTheme; label: string; icon: string }[] = [
  { value: 'clean',    label: 'Clean',    icon: '⬜' },
  { value: 'dark',     label: 'Dark',     icon: '⬛' },
  { value: 'gradient', label: 'Gradient', icon: '🌈' },
];

const FRAMES: { value: 'pas' | 'aida'; label: string; desc: string }[] = [
  { value: 'pas',  label: 'PAS',  desc: 'Problema → Agitación → Solución' },
  { value: 'aida', label: 'AIDA', desc: 'Atención → Interés → Deseo → Acción' },
];

// ── ContentStudio ─────────────────────────────────────────────────────────────

export function ContentStudio({ adminData }: Props) {
  const [selectedCenter, setSelectedCenter] = useState<CenterId>('metrics');
  const [frame, setFrame] = useState<'pas' | 'aida'>('pas');
  const [customTopic, setCustomTopic] = useState('');
  const [phase, setPhase] = useState<'configure' | 'editor'>('configure');

  const { platform, theme, status, setPlatform, setTheme, generateStory, reset } = useCarouselStore();

  const center = DATA_CENTERS.find((c) => c.id === selectedCenter)!;
  const colors = COLOR_MAP[center.color];

  const buildSnapshot = (): Record<string, unknown> => {
    if (selectedCenter === 'custom') return adminData as unknown as Record<string, unknown>;
    const keyMap: Record<CenterId, (keyof AdminData)[]> = {
      metrics:             ['usersTotal', 'validationsTotal', 'completedValidations', 'completionRate', 'avgScore', 'projected30', 'totalTokens'],
      market_trends:       ['topIndustries', 'topCountries', 'topStages', 'validationsTotal'],
      validation_patterns: ['avgScore', 'completionRate', 'scoreDist', 'abandonStep', 'completedValidations'],
      ai_usage:            ['aiInteractionsTotal', 'totalTokens', 'topModels', 'topPrompts'],
      custom:              [],
    };
    const snap: Record<string, unknown> = {};
    for (const k of keyMap[selectedCenter]) snap[k] = adminData[k];
    return snap;
  };

  const handleGenerate = async () => {
    setPhase('editor');
    await generateStory(selectedCenter, frame, customTopic, buildSnapshot());
  };

  const handleBack = () => {
    reset();
    setPhase('configure');
  };

  // ── Fase editor ───────────────────────────────────────────────────────────

  if (phase === 'editor') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleBack}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition flex items-center gap-1"
          >
            ← Cambiar centro
          </button>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${colors.badge}`}>
            {center.icon} {center.label}
          </span>
          <span className="text-[10px] text-gray-400">
            {frame.toUpperCase()} · {platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} · {theme}
          </span>
        </div>
        <CarouselEditor validationId="admin-story" context={{}} />
      </div>
    );
  }

  // ── Fase configuración ────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Centros de información */}
      <div>
        <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-3">
          Centro de información
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {DATA_CENTERS.map((c) => {
            const cl = COLOR_MAP[c.color];
            const active = selectedCenter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCenter(c.id)}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                  ${active
                    ? `${cl.border} ${cl.bg}`
                    : 'border-gray-100 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
              >
                <span className="text-2xl leading-none mt-0.5 shrink-0">{c.icon}</span>
                <div className="min-w-0">
                  <p className={`text-xs font-bold leading-tight mb-0.5 ${active ? cl.text : 'text-gray-800 dark:text-[#C4C4D4]'}`}>
                    {c.label}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-snug">{c.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview de datos del centro */}
      <div className={`rounded-2xl border-2 ${colors.border} ${colors.bg} p-4 space-y-3`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}>
          {center.icon} Vista previa de datos · {center.label}
        </p>
        <DataPreview center={selectedCenter} adminData={adminData} />
      </div>

      {/* Tema personalizado */}
      {selectedCenter === 'custom' && (
        <div>
          <label className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-2 block">
            Tema del carrusel
          </label>
          <textarea
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Ej: Por qué el 80% de las startups B2B muere antes del año 1..."
            rows={3}
            className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm bg-white dark:bg-white/5 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          />
        </div>
      )}

      {/* Configuración de formato */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-2">Plataforma</p>
          <div className="space-y-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all
                  ${platform === p.value
                    ? 'border-teal-400 bg-teal-50 dark:bg-teal-500/10'
                    : 'border-gray-100 dark:border-white/10 hover:border-gray-300'
                  }`}
              >
                <span className="text-xl">{p.icon}</span>
                <div>
                  <p className="text-xs font-bold text-gray-800 dark:text-[#F0EFF8]">{p.label}</p>
                  <p className="text-[10px] text-gray-400">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-2">Marco narrativo</p>
          <div className="space-y-2">
            {FRAMES.map((f) => (
              <button
                key={f.value}
                onClick={() => setFrame(f.value)}
                className={`w-full px-3 py-2.5 rounded-xl border-2 text-left transition-all
                  ${frame === f.value
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-500/10'
                    : 'border-gray-100 dark:border-white/10 hover:border-gray-300'
                  }`}
              >
                <p className="text-xs font-bold text-gray-800 dark:text-[#F0EFF8]">{f.label}</p>
                <p className="text-[10px] text-gray-400">{f.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-2">Tema visual</p>
          <div className="space-y-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all
                  ${theme === t.value
                    ? 'border-teal-400 bg-teal-50 dark:bg-teal-500/10'
                    : 'border-gray-100 dark:border-white/10 hover:border-gray-300'
                  }`}
              >
                <span className="text-base">{t.icon}</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-[#C4C4D4]">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Botón principal */}
      <button
        onClick={handleGenerate}
        disabled={status === 'generating' || (selectedCenter === 'custom' && !customTopic.trim())}
        className="w-full py-4 bg-teal-500 text-white font-bold rounded-xl hover:bg-teal-600
          active:scale-[0.99] transition-all shadow-lg shadow-teal-500/20
          disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {status === 'generating'
          ? '⏳ Generando narrativa con IA...'
          : `✨ Generar carrusel · ${center.label}`
        }
      </button>
    </div>
  );
}
