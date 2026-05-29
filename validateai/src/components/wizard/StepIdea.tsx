import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepIdeaSchema, type StepIdea } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';
import { FlowSelector } from './FlowSelector';
import { INDUSTRIES } from '@/utils/constants';

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
   focus:border-[#7C6FF7] focus:ring-2 focus:ring-[#7C6FF7]/20
   ${hasError ? 'border-red-500/50 bg-red-500/5' : 'border-gray-200 dark:border-white/8 hover:border-gray-300 dark:hover:border-white/15'}`;

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
      : { label: `${length} — análisis de máxima calidad ✓`, color: 'text-[#7C6FF7]', bar: 'bg-[#7C6FF7]', pct: 95 };
  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${config.bar}`} style={{ width: `${config.pct}%` }} />
      </div>
      <p className={`text-[11px] ${config.color}`}>{config.label}</p>
    </div>
  );
}

export function StepIdea() {
  const { stepIdea, updateStepIdea, nextStep, setStep, validationMode, setValidationMode } = useValidationStore();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<StepIdea>({
    resolver: zodResolver(StepIdeaSchema),
    defaultValues: stepIdea as StepIdea,
  });

  const descriptionLen = (watch('idea_description') ?? '').length;
  const currentSolutionFilled = (watch('current_solution') ?? '').trim().length > 0;

  const onSubmit = (data: StepIdea) => {
    updateStepIdea(data);
    if (validationMode === 'premium') {
      setStep(3);
    } else if (validationMode === 'quick') {
      setStep(2);
    } else {
      nextStep();
    }
  };

  return (
    <div className="space-y-6">
      {validationMode !== 'premium' && (
        <FlowSelector value={validationMode as 'quick' | 'detailed'} onChange={(mode) => {
          setValidationMode(mode);
          setStep(1); // Always stay on step 1 when switching between manual modes
        }} />
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
            Describe el problema y tu solución
          </label>
          <textarea
            {...register('idea_description')}
            rows={5}
            placeholder={`Ejemplo: "Los gerentes de clínicas medianas pierden 3h/día consolidando turnos en Excel. Nuestra solución automatiza la programación con IA y se integra al sistema HIS existente. Dirigido a clínicas de 20–80 camas en Chile y Perú."`}
            className={`${inputCls(!!errors.idea_description)} resize-none leading-relaxed`}
          />
          <DescriptionQuality length={descriptionLen} />
          {errors.idea_description && <ErrorMsg message={errors.idea_description.message} />}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-1.5 flex items-center gap-2">
            ¿Cómo resuelven tus clientes este problema hoy?{' '}
            <span className="text-gray-400 font-normal">(opcional)</span>
            {!currentSolutionFilled && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 shrink-0">
                Mejora análisis de competencia
              </span>
            )}
          </label>
          <p className="text-xs text-gray-400 mb-2">Ej: "Usan Excel y WhatsApp", "Contratan a alguien", "No hacen nada y lo toleran"</p>
          <input
            {...register('current_solution')}
            placeholder="Ej: Usan Excel y se mandan capturas por WhatsApp"
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
                                peer-checked:bg-[#7C6FF7]/15 peer-checked:text-[#7C6FF7] dark:peer-checked:text-[#A78BFA] peer-checked:border-[#7C6FF7]/40
                                hover:border-gray-300 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-all duration-150">
                  {ind.label}
                </div>
              </label>
            ))}
          </div>
          {errors.idea_industry && <ErrorMsg message="Selecciona una industria" />}
        </div>
      </div>

      <button
        type="submit"
        className="w-full py-3.5 bg-[#7C6FF7] text-white font-semibold rounded-xl
                   hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150
                   shadow-lg shadow-[#7C6FF7]/25 text-sm font-heading"
      >
        Continuar →
      </button>
      </form>
    </div>
  );
}
