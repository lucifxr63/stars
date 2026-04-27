import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepFounderSchema, type StepFounder } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';

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

export function StepFounder() {
  const { stepFounder, updateStepFounder, nextStep, prevStep } = useValidationStore();

  const { register, handleSubmit, formState: { errors }, watch } = useForm<StepFounder>({
    resolver: zodResolver(StepFounderSchema),
    defaultValues: {
      hasTechnicalCofounder: false,
      personallyFacedProblem: false,
      yearsInIndustry: 0,
      ...stepFounder,
    },
  });

  const onSubmit = (data: StepFounder) => {
    updateStepFounder(data);
    nextStep(); // Goes to Generation step
  };

  const hasTech = watch('hasTechnicalCofounder');
  const facedProblem = watch('personallyFacedProblem');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-700 leading-relaxed mb-6">
        <strong className="font-semibold block mb-1">Último paso!</strong>
        Entender tu experiencia nos permite dar un puntaje de "Founder Fit" y evaluar tu capacidad de ejecución.
      </div>

      <div className="space-y-5">
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

        <div>
           <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Equipo Técnico
          </label>
          <label className={`flex items-center gap-3 p-4 border-2 rounded-2xl cursor-pointer transition
                            ${hasTech ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 dark:border-white/8 hover:bg-white dark:bg-[#12121A]/3'}`}>
            <input
              type="checkbox"
              {...register('hasTechnicalCofounder')}
              className="w-5 h-5 text-indigo-600 rounded-md border-gray-300 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-[#F0EFF8]">Tengo un Co-founder técnico o un equipo de desarrollo interno</span>
          </label>
        </div>

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
}

