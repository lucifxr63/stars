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

export function StepIdea() {
  const { stepIdea, updateStepIdea, nextStep, setStep, validationMode, setValidationMode } = useValidationStore();

  const { register, handleSubmit, formState: { errors } } = useForm<StepIdea>({
    resolver: zodResolver(StepIdeaSchema),
    defaultValues: stepIdea as StepIdea,
  });

  const onSubmit = (data: StepIdea) => {
    updateStepIdea(data);
    if (validationMode === 'quick') {
      setStep(4);
    } else {
      nextStep();
    }
  };

  return (
    <div className="space-y-6">
      <FlowSelector value={validationMode} onChange={setValidationMode} />
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
            rows={4}
            placeholder={`¿Qué problema resuelves? ¿Cómo funciona tu solución? ¿Para quién es?\n\nMientras más detalle des, mejor será el análisis.`}
            className={`${inputCls(!!errors.idea_description)} resize-none leading-relaxed`}
          />
          <ErrorMsg message={errors.idea_description?.message} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-1.5">
            ¿Cómo resuelven tus clientes este problema hoy?{' '}
            <span className="text-gray-400 font-normal">(opcional)</span>
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
