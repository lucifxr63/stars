import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepIdeaSchema, type StepIdea } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';
import { INDUSTRIES } from '@/utils/constants';

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

export function StepIdea() {
  const { stepIdea, updateStepIdea, nextStep } = useValidationStore();

  const { register, handleSubmit, formState: { errors } } = useForm<StepIdea>({
    resolver: zodResolver(StepIdeaSchema),
    defaultValues: stepIdea as StepIdea,
  });

  const onSubmit = (data: StepIdea) => {
    updateStepIdea(data);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nombre de tu idea
          </label>
          <input
            {...register('idea_name')}
            placeholder="Ej: FreshBox, MediConnect, EduTrack..."
            className={`w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-white
                        focus:border-indigo-500 placeholder:text-gray-300
                        ${errors.idea_name ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
          />
          <ErrorMsg message={errors.idea_name?.message} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Describe tu problema y solución
          </label>
          <textarea
            {...register('idea_description')}
            rows={4}
            placeholder={`¿Qué problema resuelves? ¿Cómo funciona tu solución? ¿Para quién es?\n\nMientras más detalle des, mejor será el análisis de IA.`}
            className={`w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-white
                        focus:border-indigo-500 resize-none placeholder:text-gray-300 leading-relaxed
                        ${errors.idea_description ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
          />
          <ErrorMsg message={errors.idea_description?.message} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Industria
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
            {INDUSTRIES.map((ind) => (
              <label key={ind.value} className="cursor-pointer">
                <input type="radio" {...register('idea_industry')} value={ind.value} className="peer hidden" />
                <div className="px-3 py-2.5 text-center text-sm border-2 rounded-xl font-medium
                                text-gray-500 border-gray-200 bg-white
                                peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600
                                hover:border-indigo-300 hover:text-indigo-600 transition-all duration-150">
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
        className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl
                   hover:bg-indigo-700 active:scale-[0.98] transition-all
                   shadow-lg shadow-indigo-600/25 text-sm"
      >
        Continuar <span className="ml-2">→</span>
      </button>
    </form>
  );
}
