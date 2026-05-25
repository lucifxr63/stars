import { useState, useCallback, useRef } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import type { FounderProfileData, WorkEntry } from '@/types/validation';

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-white/8 rounded-xl ${className}`} />
  );
}

function FounderSkeleton() {
  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-4">
        <SkeletonBlock className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-5 w-48" />
          <SkeletonBlock className="h-3 w-72" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-20" />)}
      </div>
      <SkeletonBlock className="h-64 w-full" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <SkeletonBlock key={i} className="h-16" />)}
      </div>
      <div className="text-center text-xs text-gray-400 mt-2 animate-pulse">
        {LOADING_MESSAGES[useLoadingMessage()]}
      </div>
    </div>
  );
}

const LOADING_MESSAGES = [
  'Analizando historial profesional...',
  'Mapeando complementariedad de habilidades...',
  'Estructurando historial de emprendimiento...',
  'Evaluando experiencia en la industria...',
  'Calculando competencias del fundador...',
];

function useLoadingMessage() {
  const [idx, setIdx] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  if (!ref.current) {
    ref.current = setInterval(() => setIdx((i) => (i + 1) % LOADING_MESSAGES.length), 2000);
  }
  return idx;
}

// ── Radar Chart ───────────────────────────────────────────────────────────────
function CompetencyRadar({ scores }: { scores: FounderProfileData['competency_scores'] }) {
  if (!scores) return null;
  const data = [
    { subject: 'Visión Comercial',     value: scores.visionComercial },
    { subject: 'Cap. Técnica',         value: scores.capacidadTecnica },
    { subject: 'Liderazgo',            value: scores.liderazgo },
    { subject: 'Exp. Industria',       value: scores.experienciaIndustria },
    { subject: 'Resiliencia',          value: scores.resilienciaOperativa },
  ];
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/8 p-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-3">
        Radar de Competencias
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7280' }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Competencias"
            dataKey="value"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(v: number) => [`${v}/100`]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Skills Badges ─────────────────────────────────────────────────────────────
function SkillsBadges({
  skills,
  editing,
  onChange,
}: {
  skills: string[];
  editing: boolean;
  onChange: (skills: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const suggestions = ['Fintech', 'B2B SaaS', 'Growth', 'Product', 'Data', 'ML/AI', 'Legal', 'Ventas', 'Marketing', 'Ops'];

  const add = (tag: string) => {
    const clean = tag.trim();
    if (clean && !skills.includes(clean)) onChange([...skills, clean]);
    setInput('');
  };

  const remove = (tag: string) => onChange(skills.filter((s) => s !== tag));

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/8 p-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-3">
        Aptitudes
      </p>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-full border border-indigo-200 dark:border-indigo-500/20"
          >
            {skill}
            {editing && (
              <button
                onClick={() => remove(skill)}
                className="ml-1 text-indigo-400 hover:text-red-500 transition-colors"
                aria-label={`Eliminar ${skill}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {editing && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add(input))}
              placeholder="Agregar aptitud..."
              className="flex-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-white/8 rounded-xl bg-gray-50 dark:bg-[#0A0A0F] outline-none focus:border-indigo-400"
            />
            <button
              onClick={() => add(input)}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-xl hover:bg-indigo-700 transition-colors"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {suggestions.filter((s) => !skills.includes(s)).map((s) => (
              <button
                key={s}
                onClick={() => add(s)}
                className="px-2 py-0.5 text-[10px] border border-dashed border-gray-300 dark:border-white/10 rounded-full text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Timeline de trayectoria ───────────────────────────────────────────────────
function ExperienceTimeline({
  experience,
  editing,
  onChange,
}: {
  experience: WorkEntry[];
  editing: boolean;
  onChange: (exp: WorkEntry[]) => void;
}) {
  const updateEntry = (idx: number, patch: Partial<WorkEntry>) => {
    const next = [...experience];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/8 p-4 space-y-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide">
        Trayectoria Crítica
      </p>
      {experience.length === 0 && (
        <p className="text-sm text-gray-400 italic">Sin experiencia registrada</p>
      )}
      {experience.map((entry, idx) => (
        <div
          key={idx}
          className={`relative pl-5 border-l-2 ${
            entry.is_leadership
              ? 'border-indigo-400'
              : 'border-gray-200 dark:border-white/8'
          }`}
        >
          <div className={`absolute -left-1.5 top-1 w-3 h-3 rounded-full ${
            entry.is_leadership ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-white/20'
          }`} />
          {entry.is_leadership && (
            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
              Liderazgo
            </span>
          )}
          {editing ? (
            <div className="space-y-1.5 mt-1">
              <input
                value={entry.title}
                onChange={(e) => updateEntry(idx, { title: e.target.value })}
                className="w-full text-sm font-semibold bg-transparent border-b border-gray-200 dark:border-white/10 outline-none focus:border-indigo-400 pb-0.5"
              />
              <input
                value={entry.company}
                onChange={(e) => updateEntry(idx, { company: e.target.value })}
                className="w-full text-xs text-gray-500 bg-transparent border-b border-gray-200 dark:border-white/10 outline-none focus:border-indigo-400 pb-0.5"
              />
              <div className="flex gap-2">
                <input
                  value={entry.industry}
                  onChange={(e) => updateEntry(idx, { industry: e.target.value })}
                  placeholder="Industria"
                  className="flex-1 text-xs text-gray-400 bg-transparent border-b border-gray-200 dark:border-white/10 outline-none focus:border-indigo-400 pb-0.5"
                />
                <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entry.is_leadership}
                    onChange={(e) => updateEntry(idx, { is_leadership: e.target.checked })}
                    className="w-3 h-3 text-indigo-600 rounded"
                  />
                  Liderazgo
                </label>
              </div>
              <textarea
                value={entry.description}
                onChange={(e) => updateEntry(idx, { description: e.target.value })}
                rows={2}
                className="w-full text-xs text-gray-600 dark:text-[#8B8AA0] bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-2 outline-none focus:border-indigo-400 resize-none"
              />
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">
                {entry.title} · <span className="font-normal">{entry.company}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {entry.start_date} — {entry.end_date ?? 'Actual'} · {entry.industry}
              </p>
              {entry.description && (
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-1 leading-relaxed">
                  {entry.description}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed.includes('linkedin.com/in/')) {
      setError('Ingresa una URL válida de LinkedIn (ej: linkedin.com/in/tu-perfil)');
      return;
    }
    setError('');
    onSubmit(trimmed);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">
        Enriquece tu Perfil de Fundador
      </h3>
      <p className="text-sm text-gray-500 dark:text-[#8B8AA0] max-w-xs leading-relaxed mb-6">
        Conecta tu LinkedIn para que la IA evalúe tu Founder-Market Fit con mayor precisión.
        Los inversores y CORFO ponderan críticamente este factor.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://linkedin.com/in/tu-perfil"
          className={`w-full px-4 py-3 text-sm border-2 rounded-2xl outline-none transition bg-gray-50 dark:bg-[#0A0A0F] focus:border-indigo-500
            ${error ? 'border-red-300' : 'border-gray-200 dark:border-white/8'}`}
        />
        {error && <p className="text-xs text-red-500 text-left">{error}</p>}

        <button
          type="submit"
          className="w-full py-3 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/25"
        >
          Analizar Perfil con IA
        </button>
      </form>

      <p className="text-[10px] text-gray-400 mt-4 max-w-xs">
        Tu información se trata de acuerdo a la Ley 21.719 de protección de datos personales de Chile.
        Solo tú puedes ver y editar estos datos.
      </p>
    </div>
  );
}

// ── Dashboard Poblado ─────────────────────────────────────────────────────────
function FounderDashboard({
  profile,
  onSave,
}: {
  profile: FounderProfileData;
  onSave: (updated: FounderProfileData) => Promise<void>;
}) {
  const { updateFounderField } = useValidationStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FounderProfileData>(profile);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(profile);
    setEditing(false);
  };

  const updateDraft = useCallback(<K extends keyof FounderProfileData>(
    field: K,
    value: FounderProfileData[K],
  ) => {
    setDraft((d) => ({ ...d, [field]: value }));
    updateFounderField(field, value);
  }, [updateFounderField]);

  return (
    <div className="space-y-4">
      {/* Header del perfil */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {(draft.full_name ?? '?')[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            {editing ? (
              <input
                value={draft.full_name ?? ''}
                onChange={(e) => updateDraft('full_name', e.target.value)}
                className="font-bold text-base bg-transparent border-b border-indigo-400 outline-none w-full"
              />
            ) : (
              <p className="font-bold text-base text-gray-900 dark:text-[#F0EFF8] truncate">
                {draft.full_name ?? '—'}
              </p>
            )}
            {editing ? (
              <input
                value={draft.headline ?? ''}
                onChange={(e) => updateDraft('headline', e.target.value)}
                className="text-xs text-gray-500 bg-transparent border-b border-gray-200 dark:border-white/10 outline-none w-full mt-0.5"
              />
            ) : (
              <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-0.5 line-clamp-2">
                {draft.headline ?? '—'}
              </p>
            )}
          </div>
        </div>

        {/* Edit toggle */}
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-white/8 rounded-xl hover:border-indigo-400 hover:text-indigo-600 transition-all"
          >
            Editar Perfil
          </button>
        ) : (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-white/8 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-all"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-200 dark:border-white/8 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Años en industria</p>
          {editing ? (
            <input
              type="number"
              min={0}
              max={50}
              value={draft.industry_expertise_years}
              onChange={(e) => updateDraft('industry_expertise_years', Number(e.target.value))}
              className="text-2xl font-black text-indigo-600 bg-transparent w-20 outline-none border-b border-indigo-400 mt-1"
            />
          ) : (
            <p className="text-2xl font-black text-indigo-600 mt-1">{draft.industry_expertise_years}</p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-white/8 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Aptitudes</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{draft.skills.length}</p>
        </div>

        <div className="col-span-2 rounded-2xl border border-gray-200 dark:border-white/8 p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Resumen Bio</p>
          {editing ? (
            <textarea
              value={draft.summary_bio ?? ''}
              onChange={(e) => updateDraft('summary_bio', e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-700 dark:text-[#F0EFF8] bg-transparent border border-gray-200 dark:border-white/10 rounded-xl p-2 outline-none focus:border-indigo-400 resize-none"
            />
          ) : (
            <p className="text-sm text-gray-600 dark:text-[#8B8AA0] leading-relaxed line-clamp-3">
              {draft.summary_bio ?? '—'}
            </p>
          )}
        </div>
      </div>

      {/* Radar */}
      <CompetencyRadar scores={draft.competency_scores} />

      {/* Timeline */}
      <ExperienceTimeline
        experience={draft.work_experience}
        editing={editing}
        onChange={(exp) => updateDraft('work_experience', exp)}
      />

      {/* Skills */}
      <SkillsBadges
        skills={draft.skills}
        editing={editing}
        onChange={(skills) => updateDraft('skills', skills)}
      />
    </div>
  );
}

// ── Componente raíz ───────────────────────────────────────────────────────────
export function FounderProfileTab() {
  const { founderProfile, setFounderProfile } = useValidationStore();
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const handleExtract = async (linkedinUrl: string) => {
    setExtracting(true);
    setExtractError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-founder-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ linkedin_url: linkedinUrl }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      const data = await res.json() as FounderProfileData;
      setFounderProfile({ ...data, id: session.user.id });
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Error al extraer perfil');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async (updated: FounderProfileData) => {
    const { error } = await supabase
      .from('founder_profiles')
      .upsert({
        id:                      updated.id,
        full_name:               updated.full_name,
        headline:                updated.headline,
        summary_bio:             updated.summary_bio,
        industry_expertise_years: updated.industry_expertise_years,
        skills:                  updated.skills,
        work_experience:         updated.work_experience,
        education:               updated.education,
        competency_scores:       updated.competency_scores,
        extraction_status:       'done',
      }, { onConflict: 'id' });

    if (error) throw new Error(error.message);
    setFounderProfile(updated);
  };

  if (extracting) return <FounderSkeleton />;

  if (!founderProfile) {
    return (
      <div>
        <EmptyState onSubmit={handleExtract} />
        {extractError && (
          <p className="text-center text-xs text-red-500 mt-2 px-4">{extractError}</p>
        )}
      </div>
    );
  }

  return (
    <FounderDashboard
      profile={founderProfile}
      onSave={handleSave}
    />
  );
}
