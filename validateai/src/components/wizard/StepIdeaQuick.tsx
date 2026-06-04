import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepIdeaQuickSchema, type StepIdeaQuick, BUSINESS_MODELS } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';
import { FlowSelector, type FlowCopy } from './FlowSelector';
import { useIdeaQuality, type IdeaQuality } from '@/hooks/useIdeaQuality';

function IdeaQualityIndicator({ quality, visible }: { quality: IdeaQuality; visible: boolean }) {
  if (!visible) return null;
  const cfg = {
    poor:       { dot: 'bg-red-400',    text: 'text-red-500 dark:text-red-400',    label: 'Descripción vaga — añade números o palabras clave de dolor' },
    acceptable: { dot: 'bg-amber-400',  text: 'text-amber-500 dark:text-amber-400', label: 'Aceptable — puedes añadir más contexto específico' },
    good:       { dot: 'bg-emerald-500',text: 'text-emerald-600 dark:text-emerald-400', label: 'Específico — buen input para el análisis IA ✓' },
  }[quality];
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <p className={`text-[11px] ${cfg.text}`}>{cfg.label}</p>
    </div>
  );
}
import { INDUSTRIES } from '@/utils/constants';
import { supabase } from '@/lib/supabase';

const BUSINESS_MODEL_LABELS: Record<string, string> = {
  b2b: 'B2B', b2c: 'B2C', b2b2c: 'B2B2C', marketplace: 'Marketplace',
};

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
   placeholder:text-gray-400 dark:placeholder:text-[#4A495E]
   focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20
   ${hasError ? 'border-red-500/50 bg-red-500/5' : 'border-gray-200 dark:border-white/8 hover:border-gray-300 dark:hover:border-white/15'}`;

function DescriptionQuality({ length }: { length: number }) {
  if (length === 0) return null;
  const config =
    length < 100
      ? { label: `${length}/100 mín — describe la solución con más detalle`, color: 'text-red-500 dark:text-red-400', bar: 'bg-red-400', pct: (length / 100) * 50 }
      : length < 200
      ? { label: `${length} — añade más contexto para un análisis más preciso`, color: 'text-amber-500 dark:text-amber-400', bar: 'bg-amber-400', pct: 50 + ((length - 100) / 100) * 25 }
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

export function StepIdeaQuick({ flowCopy }: { flowCopy?: FlowCopy }) {
  const { stepIdeaQuick, updateStepIdeaQuick, updateStepMarket, updateStepIdea, nextStep,
          setStep, validationMode, setValidationMode } = useValidationStore();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<StepIdeaQuick>({
    resolver: zodResolver(StepIdeaQuickSchema),
    defaultValues: stepIdeaQuick as StepIdeaQuick,
  });

  const descriptionText = watch('idea_description') ?? '';
  const descriptionLen  = descriptionText.length;
  const selectedModel   = watch('business_model');
  const descQuality     = useIdeaQuality(descriptionText);
  // Upsell contextual: si el contexto es rico (> 200 chars) y el modo es Rápido,
  // sugerir el análisis completo conservando todo el texto ya ingresado.
  const showUpsellBanner = validationMode === 'quick' && descriptionText.length > 200;

  const handleUpsell = () => {
    // Copia los datos ya ingresados a stepIdea para pre-llenar StepIdea.
    const currentValues = { idea_name: watch('idea_name'), idea_description: watch('idea_description'), idea_industry: watch('idea_industry') };
    updateStepIdea(currentValues);
    setValidationMode('detailed');
    setStep(1);
  };

  const onSubmit = (data: StepIdeaQuick) => {
    updateStepIdeaQuick(data);
    // Espeja business_model en stepMarket para que el context builder de StepGenerating
    // lo encuentre si accede al store directamente.
    updateStepMarket({ business_model: data.business_model });

    const { validationId } = useValidationStore.getState();
    if (validationId) {
      supabase.from('validations').update({
        idea_name:        data.idea_name,
        idea_description: data.idea_description,
        idea_industry:    data.idea_industry,
        quick_icp:        data.quick_icp,
        business_model:   data.business_model,
        current_step:     2,
      }).eq('id', validationId).then(() => {});
    }

    nextStep();
  };

  return (
    <div className="space-y-6">
      <FlowSelector
        value={validationMode as 'quick' | 'detailed'}
        onChange={(mode) => { setValidationMode(mode); setStep(1); }}
        flowCopy={flowCopy}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Nombre */}
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

        {/* Descripción + quality indicator */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2">
            Describe tu idea y solución <span className="text-red-400">*</span>
          </label>
          <textarea
            {...register('idea_description')}
            rows={4}
            placeholder={`Ej: "Una app que conecta a pacientes con médicos disponibles en menos de 1 hora, eliminando las largas listas de espera en clínicas medianas de Chile."`}
            className={`${inputCls(!!errors.idea_description)} resize-none leading-relaxed`}
          />
          <DescriptionQuality length={descriptionLen} />
          <IdeaQualityIndicator quality={descQuality} visible={descriptionLen > 0} />
          {errors.idea_description && <ErrorMsg message={errors.idea_description.message} />}
        </div>

        {/* ICP rápido */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-1.5">
            ¿A quién le vas a vender? <span className="text-red-400">*</span>
          </label>
          <p className="text-xs text-gray-400 dark:text-[#4A495E] mb-2">
            Sé específico: tipo de empresa, cargo o perfil del usuario final.
          </p>
          <input
            {...register('quick_icp')}
            placeholder="Ej: Clínicas dentales medianas, Gerentes de operaciones en retail, Estudiantes universitarios"
            className={inputCls(!!errors.quick_icp)}
          />
          <ErrorMsg message={errors.quick_icp?.message} />
        </div>

        {/* Modelo de negocio */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2.5">
            Modelo de negocio <span className="text-red-400">*</span>
          </label>
          <input type="hidden" {...register('business_model')} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BUSINESS_MODELS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setValue('business_model', m, { shouldValidate: true })}
                className={`px-3 py-2.5 text-center text-xs border rounded-xl font-medium transition-all duration-150
                  ${selectedModel === m
                    ? 'bg-[#0EB5C6]/15 text-[#0EB5C6] dark:text-[#38D5E3] border-[#0EB5C6]/40'
                    : 'text-gray-500 dark:text-[#8B8AA0] border-gray-200 dark:border-white/8 bg-white dark:bg-transparent hover:border-gray-300 dark:hover:border-white/20'
                  }`}
              >
                {BUSINESS_MODEL_LABELS[m]}
              </button>
            ))}
          </div>
          {errors.business_model && <ErrorMsg message="Selecciona un modelo de negocio" />}
        </div>

        {/* Industria */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2.5">
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

        {/* Upsell contextual: contexto rico detectado en modo Rápido */}
        {showUpsellBanner && (
          <button
            type="button"
            onClick={handleUpsell}
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
          Analizar Idea →
        </button>
      </form>
    </div>
  );
}
