import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepFounderSchema, type StepFounder as StepFounderData } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';
import { supabase } from '@/lib/supabase';
import type { StepAutoSaveRef } from './StepMarket';

const INDUSTRY_LABELS: Record<string, string> = {
  fintech: 'Fintech', edtech: 'Educación', healthtech: 'Salud',
  ecommerce: 'E-Commerce', saas: 'SaaS', marketplace: 'Marketplace',
  social: 'Social', logistics: 'Logística', foodtech: 'FoodTech',
  proptech: 'PropTech', other: 'otra industria',
};

const BUSINESS_MODEL_LABELS_SHORT: Record<string, string> = {
  b2b: 'B2B', b2c: 'B2C', b2b2c: 'B2B2C', marketplace: 'Marketplace',
};

function buildGamificationMessage(industry?: string, model?: string, country?: string): string {
  const ind = industry ? INDUSTRY_LABELS[industry] ?? industry : null;
  const mod = model ? BUSINESS_MODEL_LABELS_SHORT[model] ?? model.toUpperCase() : null;
  const cnt = country ?? null;

  if (!ind && !mod && !cnt) return 'Último paso: cuéntanos sobre el equipo para calcular tu Score de Ejecución.';

  const parts = [ind, mod].filter(Boolean).join(' ');
  const loc = cnt ? ` en ${cnt}` : '';
  return `Interesante combinación${parts ? ` de ${parts}` : ''}${loc}. Ahora cuéntanos sobre el equipo para calcular tu Score de Ejecución.`;
}

function GamificationBanner() {
  const { stepIdea, stepMarket } = useValidationStore();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const msg = buildGamificationMessage(
    stepIdea.idea_industry,
    stepMarket.business_model,
    stepMarket.target_country,
  );

  return (
    <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#7C6FF7]/8 border border-[#7C6FF7]/20 mb-6">
        <span className="text-lg shrink-0" aria-hidden>✦</span>
        <p className="text-sm text-[#7C6FF7] dark:text-[#A78BFA] font-medium leading-relaxed">
          {msg}
        </p>
        <button
          onClick={() => setVisible(false)}
          aria-label="Cerrar"
          className="ml-auto shrink-0 text-[#7C6FF7]/40 hover:text-[#7C6FF7] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const TECH_LEVELS = [
  { value: 'non_technical', label: 'Nada técnico', desc: 'Usaríamos No-Code o contrataríamos' },
  { value: 'some_code', label: 'Algo de código', desc: 'Podemos armar un MVP básico' },
  { value: 'developers', label: 'Somos devs', desc: 'Equipo técnico completo' },
] as const;

const TEAM_COMPOSITION_OPTIONS = [
  { value: 'solo_founder', label: 'Solo Founder', desc: 'Arranco solo, sin cofundadores' },
  { value: 'founding_team', label: 'Equipo Fundador', desc: '2–3 cofundadores, sin empleados aún' },
  { value: 'team_with_employees', label: 'Equipo + Empleados', desc: 'Cofundadores y al menos 1 contratado' },
] as const;

const TRACTION_STATUS_OPTIONS = [
  { value: 'idea_on_paper', label: 'Idea en papel', desc: 'Aún no he construido nada' },
  { value: 'mvp_in_development', label: 'MVP en desarrollo', desc: 'Construyendo el primer prototipo' },
  { value: 'mvp_launched_no_sales', label: 'MVP lanzado', desc: 'Live, pero sin ventas aún' },
  { value: 'first_paying_customers', label: 'Primeros clientes pagos', desc: 'Ya tengo ingresos reales' },
] as const;

const COMMITMENT_OPTIONS = [
  { value: 'full_time', label: 'Full-time',            desc: 'Me dedico 100% a esto',           icon: '🔥' },
  { value: 'part_time', label: 'Part-time',            desc: 'Tengo otro trabajo en paralelo',   icon: '⚡' },
  { value: 'weekends',  label: 'Noches y fines de semana', desc: 'Lo arranco en mis ratos libres', icon: '🌙' },
] as const;

const INTERVIEWS_OPTIONS = [
  { value: '0',       label: 'Ninguna todavía', desc: 'Aún no hablé con clientes'     },
  { value: '1_5',     label: '1–5 entrevistas', desc: 'Primeras conversaciones'        },
  { value: '6_20',    label: '6–20 entrevistas', desc: 'Validación activa del problema' },
  { value: '20_plus', label: '20+ entrevistas',  desc: 'Investigación profunda'         },
] as const;

function ErrorMsg({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

export const StepFounder = forwardRef<StepAutoSaveRef>(function StepFounder(_, ref) {
  const { stepFounder, updateStepFounder, nextStep, prevStep } = useValidationStore();

  const { register, handleSubmit, formState: { errors }, watch, setValue, getValues } = useForm<StepFounderData>({
    resolver: zodResolver(StepFounderSchema),
    defaultValues: {
      personallyFacedProblem: false,
      yearsInIndustry: 0,
      ...stepFounder,
    },
  });

  useImperativeHandle(ref, () => ({
    getPartialData: () => getValues() as Record<string, unknown>,
  }));

  const onSubmit = (data: StepFounderData) => {
    updateStepFounder(data);

    const { validationId } = useValidationStore.getState();
    if (validationId) {
      supabase.from('validations').update({
        founder_context: {
          yearsInIndustry:        data.yearsInIndustry,
          personallyFacedProblem: data.personallyFacedProblem,
          commitment_level:       data.commitment_level   ?? null,
          customer_interviews:    data.customer_interviews ?? null,
          unfair_advantage:       data.unfair_advantage   ?? null,
        },
        tech_level:       data.tech_level,
        team_composition: data.team_composition,
        traction_status:  data.traction_status,
        current_step:     4,
      }).eq('id', validationId).then(() => {});
    }

    nextStep();
  };

  const facedProblem      = watch('personallyFacedProblem');
  const techLevel         = watch('tech_level');
  const teamComp          = watch('team_composition');
  const tractionStatus    = watch('traction_status');
  const commitmentLevel   = watch('commitment_level');
  const customerInterviews = watch('customer_interviews');
  const unfairAdvantage   = watch('unfair_advantage') ?? '';

  // Progreso: 3 campos requeridos + 3 opcionales de enriquecimiento
  const founderFilled   = [teamComp, tractionStatus, techLevel].filter(Boolean).length;
  const enrichFilled    = [commitmentLevel, customerInterviews, unfairAdvantage.length > 0 ? 'x' : ''].filter(Boolean).length;
  const FOUNDER_TOTAL   = 3;
  const ENRICH_TOTAL    = 3;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      <GamificationBanner />

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-700 leading-relaxed mb-6">
        <strong className="font-semibold block mb-1">Fundador y Tracción</strong>
        Entender tu experiencia y estado actual nos permite calcular tu Score de Ejecución y darte un análisis de Founder Fit real.
      </div>

      <div className="space-y-5">

        {/* Años de experiencia */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-2">
            Años de experiencia en esta industria
          </label>
          <input
            type="number"
            min={0}
            max={50}
            {...register('yearsInIndustry', { valueAsNumber: true })}
            placeholder="0"
            className={`w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-gray-50 dark:bg-[#0A0A0F]
                        focus:border-indigo-500
                        ${errors.yearsInIndustry ? 'border-red-300 bg-red-50' : 'border-gray-200 dark:border-white/8'}`}
          />
          <ErrorMsg message={errors.yearsInIndustry?.message} />
        </div>

        {/* Composición del equipo */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Composición del equipo <span className="text-red-400">*</span>
          </label>
          <input type="hidden" {...register('team_composition')} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TEAM_COMPOSITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue('team_composition', opt.value, { shouldValidate: true })}
                className={`p-3 border-2 rounded-2xl text-left transition-all
                  ${teamComp === opt.value
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-white/8 hover:border-indigo-300'}`}
              >
                <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8]">{opt.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
          <ErrorMsg message={errors.team_composition?.message} />
        </div>

        {/* Estado de tracción */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Estado de tracción <span className="text-red-400">*</span>
          </label>
          <input type="hidden" {...register('traction_status')} />
          <div className="grid grid-cols-2 gap-2">
            {TRACTION_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue('traction_status', opt.value, { shouldValidate: true })}
                className={`p-3 border-2 rounded-2xl text-left transition-all
                  ${tractionStatus === opt.value
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-white/8 hover:border-indigo-300'}`}
              >
                <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8]">{opt.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
          <ErrorMsg message={errors.traction_status?.message} />
        </div>

        {/* Nivel técnico del equipo */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Nivel técnico del equipo fundador
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TECH_LEVELS.map((level) => (
              <label key={level.value} className="cursor-pointer">
                <input type="radio" {...register('tech_level')} value={level.value} className="peer hidden" />
                <div className={`p-3 border-2 rounded-2xl text-center transition-all
                  ${techLevel === level.value
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-white/8 hover:border-indigo-300'}`}>
                  <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8]">{level.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{level.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Vivió el problema personalmente */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Contexto del Problema
          </label>
          <label className={`flex items-center gap-3 p-4 border-2 rounded-2xl cursor-pointer transition
                            ${facedProblem ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 dark:border-white/8 hover:bg-white dark:bg-[#12121A]/3'}`}>
            <input
              type="checkbox"
              {...register('personallyFacedProblem')}
              className="w-5 h-5 text-indigo-600 rounded-md border-gray-300 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8]">He sufrido o vivido este problema personalmente</span>
          </label>
        </div>

      </div>

      {/* ── Enriquecimiento opcional ─────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-white/[0.06] pt-5 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-widest">
            Análisis más preciso <span className="font-normal normal-case ml-1 text-gray-400">(opcional)</span>
          </p>
          {enrichFilled > 0 && (
            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">
              +{enrichFilled} campo{enrichFilled > 1 ? 's' : ''} completado{enrichFilled > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Compromiso de tiempo */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-1.5">
            ¿Cuánto tiempo le dedicás a esta startup?
          </label>
          <p className="text-xs text-gray-400 dark:text-[#4A495E] mb-3">
            Los inversores ponderan fuertemente el compromiso full-time.
          </p>
          <input type="hidden" {...register('commitment_level')} />
          <div className="grid grid-cols-3 gap-2">
            {COMMITMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue('commitment_level', opt.value, { shouldValidate: true })}
                className={`p-3 border-2 rounded-2xl text-left transition-all
                  ${commitmentLevel === opt.value
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-white/8 hover:border-indigo-300'}`}
              >
                <p className="text-base mb-0.5">{opt.icon}</p>
                <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8]">{opt.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Entrevistas con clientes */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-1.5">
            ¿Cuántas entrevistas con clientes reales hiciste?
          </label>
          <p className="text-xs text-gray-400 dark:text-[#4A495E] mb-3">
            Las entrevistas son la evidencia más valorada de validación del problema.
          </p>
          <input type="hidden" {...register('customer_interviews')} />
          <div className="grid grid-cols-2 gap-2">
            {INTERVIEWS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue('customer_interviews', opt.value, { shouldValidate: true })}
                className={`p-3 border-2 rounded-2xl text-left transition-all
                  ${customerInterviews === opt.value
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-white/8 hover:border-indigo-300'}`}
              >
                <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8]">{opt.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Ventaja diferencial */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-1.5">
            ¿Por qué vos sos la persona indicada para resolver esto?
          </label>
          <p className="text-xs text-gray-400 dark:text-[#4A495E] mb-2">
            Tu experiencia única, acceso privilegiado al mercado o insight que otros no tienen.
          </p>
          <textarea
            {...register('unfair_advantage')}
            rows={3}
            maxLength={500}
            placeholder="Ej: Fui gerente de operaciones en una naviera durante 8 años. Conozco el dolor desde adentro y tengo relación directa con los tomadores de decisión."
            className="w-full px-4 py-3 border-2 rounded-2xl text-sm resize-none transition outline-none
                       bg-gray-50 dark:bg-[#0A0A0F] text-gray-900 dark:text-[#F0EFF8]
                       placeholder:text-gray-400 dark:placeholder:text-[#4A495E]
                       border-gray-200 dark:border-white/8 focus:border-indigo-500"
          />
          <div className="flex justify-end mt-1">
            <span className={`text-[10px] ${unfairAdvantage.length >= 80 ? 'text-indigo-500' : 'text-gray-400'}`}>
              {unfairAdvantage.length}/500
            </span>
          </div>
        </div>

        {/* Indicador de impacto */}
        {enrichFilled >= 2 && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-indigo-50/60 dark:bg-indigo-500/8 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
            <span className="text-indigo-500 text-base">✦</span>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
              {enrichFilled === ENRICH_TOTAL
                ? 'Perfil completo — el análisis de Founder Fit será significativamente más preciso.'
                : 'Estos datos mejorarán el score de Founder Fit y el análisis de Inversión.'}
            </p>
          </div>
        )}
      </div>

      {/* Progreso de campos del paso */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-[#4A495E]">
          <span>Completitud del paso</span>
          <span className="font-bold tabular-nums">{founderFilled}/{FOUNDER_TOTAL}</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out bg-indigo-500"
            style={{ width: `${(founderFilled / FOUNDER_TOTAL) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={prevStep}
          className="w-1/3 py-4 text-gray-600 dark:text-[#8B8AA0] font-bold rounded-2xl hover:bg-gray-100 dark:bg-white/5 transition-all text-sm"
        >
          Volver
        </button>
        <button
          type="submit"
          className="w-2/3 py-4 bg-indigo-600 text-white font-bold rounded-2xl
                     hover:bg-indigo-700 active:scale-[0.98] transition-all
                     shadow-lg shadow-indigo-600/25 text-sm"
        >
          Generar Reporte <span className="ml-2">🚀</span>
        </button>
      </div>
    </form>
  );
});
