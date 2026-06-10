import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepIdeaSchema, type StepIdea } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';
import { FlowSelector, type FlowCopy } from './FlowSelector';
import { INDUSTRIES } from '@/utils/constants';
import { useIdeaQuality, type IdeaQuality } from '@/hooks/useIdeaQuality';

function IdeaQualityIndicator({ quality, visible }: { quality: IdeaQuality; visible: boolean }) {
  if (!visible) return null;
  const cfg = {
    poor: { dot: 'bg-red-400', text: 'text-red-500 dark:text-red-400', label: 'Descripción vaga — añade números o palabras clave de dolor' },
    acceptable: { dot: 'bg-amber-400', text: 'text-amber-500 dark:text-amber-400', label: 'Aceptable — puedes añadir más contexto específico' },
    good: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Específico — buen input para el análisis IA ✓' },
  }[quality];
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <p className={`text-[11px] ${cfg.text}`}>{cfg.label}</p>
    </div>
  );
}
import { supabase } from '@/lib/supabase';

function ErrorMsg({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[#F87171] text-xs mt-1.5 flex items-center gap-1">
      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

const inputCls = (hasError: boolean) =>
  `w-full px-4 py-3.5 rounded-xl text-sm text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#0A0A0F] border transition-all duration-150 outline-none
   placeholder:text-gray-400 dark:placeholder:text-[#71718A]
   focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20
   ${hasError ? 'border-red-500/50 bg-red-500/5' : 'border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/25'}`;

// Indicador de calidad para idea_description basado en longitud.
// Los umbrales alinean con el mínimo Zod (100) y los rangos donde Claude
// produce análisis notablemente mejores (200+ chars).
function DescriptionQuality({ length }: { length: number }) {
  if (length === 0) return null;
  const config =
    length < 100
      ? { label: `${length}/100 mín — añade problema, solución y público objetivo`, color: 'text-red-500 dark:text-red-400', bar: 'bg-red-400', pct: (length / 100) * 50 }
      : length < 200
        ? { label: `${length} — añade más contexto para análisis premium`, color: 'text-amber-500 dark:text-amber-400', bar: 'bg-amber-400', pct: 50 + ((length - 100) / 100) * 25 }
        : length < 400
          ? { label: `${length} — buen nivel de detalle ✓`, color: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', pct: 75 + ((length - 200) / 200) * 20 }
          : { label: `${length} — análisis de máxima calidad ✓`, color: 'text-[#0EB5C6]', bar: 'bg-[#0EB5C6]', pct: 95 };
  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${config.bar}`} style={{ width: `${config.pct}%` }} />
      </div>
      <p className={`text-[11px] ${config.color}`}>{config.label}</p>
    </div>
  );
}

export function StepIdea({ flowCopy, isPrefilled }: { flowCopy?: FlowCopy; isPrefilled?: boolean }) {
  const { stepIdea, updateStepIdea, nextStep, setStep, validationMode, setValidationMode } = useValidationStore();
  const [showPrefillBadge, setShowPrefillBadge] = useState(!!isPrefilled);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<StepIdea>({
    resolver: zodResolver(StepIdeaSchema),
    defaultValues: stepIdea as StepIdea,
    mode: 'onBlur',
  });

  const descriptionLen = (watch('idea_description') ?? '').length;
  const problemText = watch('idea_problem') ?? '';
  const problemQuality = useIdeaQuality(problemText);
  // Upsell contextual: si el usuario escribe > 200 chars en "¿Qué problema resuelves?"
  // y está en modo rápido, sugerimos cambiar al análisis completo.
  const showUpsellBanner = validationMode === 'quick' && problemText.length > 200;

  const onSubmit = (data: StepIdea) => {
    updateStepIdea(data);

    // Persistir a Supabase si ya existe el row (best-effort, no bloquea la UI)
    const { validationId } = useValidationStore.getState();
    if (validationId) {
      const nextStepNum = validationMode === 'premium' ? 3 : 2;
      supabase.from('validations').update({
        idea_name: data.idea_name,
        idea_problem: data.idea_problem,
        idea_description: data.idea_description,
        idea_industry: data.idea_industry,
        current_solution: data.current_solution,
        current_step: nextStepNum,
      }).eq('id', validationId).then(() => { });
    }

    if (validationMode === 'quick') {
      setStep(2);
    } else {
      // Premium y detailed avanzan secuencialmente:
      // detailed: Idea (1) → Market (2) → Founder (3) → Generating (4)
      // premium:  Upload (1) → IdeaPremium (2) → MarketPremium (3) → Generating (4)
      nextStep();
    }
  };

  return (
    <div className="space-y-6">
      {showPrefillBadge && (
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#0EB5C6]/8 rounded-xl border border-[#0EB5C6]/20">
          <span className="text-xs text-[#0EB5C6] dark:text-[#A99FF9]">
            ✨ Datos pre-llenados desde <strong>Mi Startup</strong> — edita libremente.
          </span>
          <button
            type="button"
            onClick={() => setShowPrefillBadge(false)}
            className="ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-base leading-none"
          >
            ×
          </button>
        </div>
      )}
      {validationMode !== 'premium' && (
        <FlowSelector
          value={validationMode as 'quick' | 'detailed'}
          onChange={(mode) => { setValidationMode(mode); setStep(1); }}
          flowCopy={flowCopy}
        />
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2">
              Nombre de tu idea
            </label>
            <input
              {...register('idea_name')}
              placeholder="Ej: FreshBox, MediConnect, EduTrack..."
              className={inputCls(!!errors.idea_name)}
            />
            <ErrorMsg message={errors.idea_name?.message} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2">
              ¿Qué problema resuelves? <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-gray-400 dark:text-[#afaebb] mb-2">
              Describe el dolor del cliente, no la solución. ¿Qué le cuesta tiempo, dinero o frustración?
            </p>
            <textarea
              {...register('idea_problem')}
              rows={2}
              placeholder={`Ej: "Los gerentes de clínicas medianas pierden 3h/día consolidando turnos manualmente en Excel, lo que genera errores y horas extra no pagadas."`}
              className={`${inputCls(!!errors.idea_problem)} resize-none leading-relaxed`}
            />
            <ErrorMsg message={errors.idea_problem?.message} />
            <IdeaQualityIndicator quality={problemQuality} visible={problemText.length > 0} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2">
              Describe tu solución <span className="text-red-400">*</span>
            </label>
            <textarea
              {...register('idea_description')}
              rows={4}
              placeholder={`Ej: "Automatizamos la programación de turnos con IA integrada al sistema HIS existente. Dirigido a clínicas de 20–80 camas en Chile y Perú."`}
              className={`${inputCls(!!errors.idea_description)} resize-none leading-relaxed`}
            />
            <DescriptionQuality length={descriptionLen} />
            {errors.idea_description && <ErrorMsg message={errors.idea_description.message} />}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-1.5">
              ¿Cómo lo resuelven tus clientes hoy? <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-gray-400 dark:text-[#afaebb] mb-2">
              Nombra 2 herramientas o métodos concretos que usa tu cliente actualmente.
            </p>
            <input
              {...register('current_solution')}
              placeholder="Ej: Excel + WhatsApp para coordinarse, o contratan un asistente administrativo"
              className={inputCls(!!errors.current_solution)}
            />
            <ErrorMsg message={errors.current_solution?.message} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-3">
              Industria
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
              {INDUSTRIES.map((ind) => (
                <label key={ind.value} className="cursor-pointer">
                  <input type="radio" {...register('idea_industry')} value={ind.value} className="peer hidden" />
                  <div className="px-3 py-2.5 text-center text-xs border rounded-xl font-medium
                                text-gray-500 dark:text-[#8B8AA0] border-gray-200 dark:border-white/8 bg-white dark:bg-transparent
                                peer-checked:bg-[#0EB5C6]/15 peer-checked:text-[#0EB5C6] dark:peer-checked:text-[#38D5E3] peer-checked:border-[#0EB5C6]/40
                                hover:border-gray-300 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-all duration-150">
                    {ind.label}
                  </div>
                </label>
              ))}
            </div>
            {errors.idea_industry && <ErrorMsg message="Selecciona una industria" />}
          </div>
        </div>

        {/* Upsell contextual: aparece al detectar contexto rico en modo Rápido */}
        {showUpsellBanner && (
          <button
            type="button"
            onClick={() => { setValidationMode('detailed'); setStep(1); }}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl
                     bg-[#0EB5C6]/10 border border-[#0EB5C6]/30 text-left
                     hover:bg-[#0EB5C6]/15 transition-all duration-200 animate-in fade-in slide-in-from-bottom-1"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <svg className="w-4 h-4 text-[#38D5E3] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-xs font-semibold text-[#38D5E3] leading-snug">
                Tienes buen contexto → el Análisis completo te dará un score más preciso
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-bold text-[#0EB5C6] bg-[#0EB5C6]/20 px-2 py-0.5 rounded-full">
              Cambiar →
            </span>
          </button>
        )}

        <button
          type="submit"
          className="w-full py-3.5 bg-[#0EB5C6] text-white font-semibold rounded-xl
                   hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150
                   shadow-lg shadow-[#0EB5C6]/25 text-sm font-heading"
        >
          Continuar →
        </button>
      </form>
    </div>
  );
}
