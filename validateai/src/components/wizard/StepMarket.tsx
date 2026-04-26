import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepMarketSchema, type StepMarket, TARGET_COUNTRIES, BUSINESS_MODELS, PRICING_RANGES } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';

const BUSINESS_MODEL_LABELS: Record<string, string> = {
  b2b: 'B2B (Empresas)',
  b2c: 'B2C (Consumidores)',
  b2b2c: 'B2B2C',
  marketplace: 'Marketplace',
};

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

export function StepMarket() {
  const { stepMarket, updateStepMarket, nextStep, prevStep } = useValidationStore();

  const { register, handleSubmit, formState: { errors } } = useForm<StepMarket>({
    resolver: zodResolver(StepMarketSchema),
    defaultValues: stepMarket as StepMarket,
  });

  const onSubmit = (data: StepMarket) => {
    updateStepMarket(data);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-5">
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            A quién le vendes (Público objetivo)
          </label>
          <textarea
            {...register('customer_segment')}
            rows={3}
            placeholder="Ej: Clínicas medianas interesadas en agilizar su atención..."
            className={`w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-white
                        focus:border-indigo-500 resize-none placeholder:text-gray-300
                        ${errors.customer_segment ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
          />
          <ErrorMsg message={errors.customer_segment?.message} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              País objetivo <span className="text-red-400">*</span>
            </label>
            <select
              {...register('target_country')}
              className={`w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-white
                          focus:border-indigo-500
                          ${errors.target_country ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
            >
              <option value="">Selecciona un país</option>
              {TARGET_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ErrorMsg message={errors.target_country?.message} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Región / ciudad <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              {...register('target_region')}
              placeholder="Ej: Santiago, CDMX..."
              className="w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-white
                         focus:border-indigo-500 placeholder:text-gray-300 border-gray-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Modelo de negocio <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BUSINESS_MODELS.map((m) => (
              <label key={m} className="cursor-pointer">
                <input type="radio" {...register('business_model')} value={m} className="peer hidden" />
                <div className="px-3 py-2.5 text-center text-sm border-2 rounded-xl font-medium
                                text-gray-500 border-gray-200 bg-white
                                peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600
                                hover:border-indigo-300 hover:text-indigo-600 transition-all duration-150">
                  {BUSINESS_MODEL_LABELS[m]}
                </div>
              </label>
            ))}
          </div>
          {errors.business_model && <ErrorMsg message="Selecciona un modelo de negocio" />}
        </div>

        <div>
           <label className="block text-sm font-semibold text-gray-700 mb-2">
            Rango de precio estimado <span className="text-red-400">*</span>
          </label>
          <select
            {...register('pricing_range')}
            className={`w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-white
                        focus:border-indigo-500
                        ${errors.pricing_range ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
          >
            <option value="">Selecciona un rango</option>
            {PRICING_RANGES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ErrorMsg message={errors.pricing_range?.message} />
        </div>

      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={prevStep}
          className="w-1/3 py-4 text-gray-600 font-bold rounded-2xl hover:bg-gray-100 transition-all text-sm"
        >
          Volver
        </button>
        <button
          type="submit"
          className="w-2/3 py-4 bg-indigo-600 text-white font-bold rounded-2xl
                     hover:bg-indigo-700 active:scale-[0.98] transition-all
                     shadow-lg shadow-indigo-600/25 text-sm"
        >
          Siguiente <span className="ml-2">→</span>
        </button>
      </div>
    </form>
  );
}
