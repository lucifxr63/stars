import { forwardRef, useImperativeHandle } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepMarketSchema, type StepMarket as StepMarketData, TARGET_COUNTRIES, BUSINESS_MODELS, PRICING_RANGES } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';
import { supabase } from '@/lib/supabase';

// Interfaz compartida para el auto-guardado. Exportada para que Validate.tsx
// pueda tipar el ref sin duplicar la definición.
export interface StepAutoSaveRef {
  getPartialData: () => Record<string, unknown>;
}

const BUSINESS_MODEL_LABELS: Record<string, string> = {
  b2b: 'B2B (Empresas)',
  b2c: 'B2C (Consumidores)',
  b2b2c: 'B2B2C',
  marketplace: 'Marketplace',
};

const CHILE_REGIONS = [
  'Región Metropolitana de Santiago',
  'Valparaíso',
  'Biobío',
  'La Araucanía',
  'Maule',
  'Los Lagos',
  'Antofagasta',
  'Coquimbo',
  'O\'Higgins',
  'Los Ríos',
  'Tarapacá',
  'Atacama',
  'Ñuble',
  'Arica y Parinacota',
  'Aysén',
  'Magallanes',
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

export const StepMarket = forwardRef<StepAutoSaveRef>(function StepMarket(_, ref) {
  const { stepMarket, updateStepMarket, nextStep, prevStep } = useValidationStore();

  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<StepMarketData>({
    resolver: zodResolver(StepMarketSchema),
    defaultValues: stepMarket as StepMarketData,
    mode: 'onBlur',
  });

  // Expone getPartialData() al padre (Validate.tsx) para el auto-guardado de 30s.
  useImperativeHandle(ref, () => ({
    getPartialData: () => getValues() as Record<string, unknown>,
  }));

  const selectedModel = watch('business_model');
  const selectedPricing = watch('pricing_range');
  const selectedCountry = watch('target_country');

  // Barra de progreso: campos clave que el usuario debe completar en este paso.
  const MARKET_FIELDS = ['customer_segment', 'target_country', 'business_model', 'pricing_range'] as const;
  const filledMarket = MARKET_FIELDS.filter((f) => !!watch(f)).length;

  // B2B + free: combinación que casi nunca es intencional y contamina el unit economics.
  // Se muestra como warning no bloqueante — el usuario puede continuar, pero no lo ignorará.
  const showB2bFreeWarning = selectedModel === 'b2b' && selectedPricing === 'free';

  const onSubmit = (data: StepMarketData) => {
    updateStepMarket(data);

    const { validationId } = useValidationStore.getState();
    if (validationId) {
      supabase.from('validations').update({
        customer_segment: data.customer_segment,
        target_country: data.target_country,
        target_region: data.target_region ?? null,
        business_model: data.business_model,
        pricing_range: data.pricing_range,
        acquisition_channel: data.acquisition_channel ?? null,
        current_step: 3,
      }).eq('id', validationId).then(() => { });
    }

    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-5">

        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-1.5">
            A quién le vendes — ICP (Ideal Customer Profile)
          </label>
          <p className="text-xs text-gray-400 dark:text-[#afaebb] mb-2">
            Incluye: industria, tamaño, cargo del decisor o perfil del usuario final.
          </p>
          <textarea
            {...register('customer_segment')}
            rows={3}
            placeholder="Ej: Gerentes de operaciones en clínicas medianas (20–80 camas) de Chile y Perú que usan sistemas HIS desactualizados y necesitan reducir tiempo de gestión de turnos."
            className={`w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-gray-50 dark:bg-[#0A0A0F]
                        focus:border-indigo-500 resize-none placeholder:text-gray-400 dark:placeholder:text-[#71718A]
                        ${errors.customer_segment ? 'border-red-300 bg-red-50' : 'border-gray-200 dark:border-white/15'}`}
          />
          <ErrorMsg message={errors.customer_segment?.message} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-2">
              País objetivo <span className="text-red-400">*</span>
            </label>
            <select
              {...register('target_country')}
              className={`w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-gray-50 dark:bg-[#0A0A0F]
                          focus:border-indigo-500
                          ${errors.target_country ? 'border-red-300 bg-red-50' : 'border-gray-200 dark:border-white/15'}`}
            >
              <option value="">Selecciona un país</option>
              {TARGET_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ErrorMsg message={errors.target_country?.message} />
          </div>

          <div>
            {selectedCountry === 'Chile' ? (
              <>
                <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-2">
                  Región <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <select
                  {...register('target_region')}
                  className="w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-gray-50 dark:bg-[#0A0A0F]
                             focus:border-indigo-500 border-gray-200 dark:border-white/15"
                >
                  <option value="">Selecciona una región</option>
                  {CHILE_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-2">
                  Región / Ciudad específica <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  {...register('target_region')}
                  placeholder="Ej: CDMX, Buenos Aires, Bogotá..."
                  className="w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-gray-50 dark:bg-[#0A0A0F]
                             focus:border-indigo-500 placeholder:text-gray-400 dark:placeholder:text-[#71718A] border-gray-200 dark:border-white/15"
                />
              </>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Modelo de negocio <span className="text-red-400">*</span>
          </label>
          <input type="hidden" {...register('business_model')} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BUSINESS_MODELS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setValue('business_model', m as StepMarketData['business_model'], { shouldValidate: true })}
                className={`px-3 py-2.5 text-center text-sm border-2 rounded-xl font-medium transition-all duration-150
                  ${selectedModel === m
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'text-gray-500 dark:text-[#8B8AA0] border-gray-200 dark:border-white/15 bg-gray-50 dark:bg-[#0A0A0F] hover:border-indigo-300 hover:text-indigo-600'
                  }`}
              >
                {BUSINESS_MODEL_LABELS[m]}
              </button>
            ))}
          </div>
          {errors.business_model && <ErrorMsg message="Selecciona un modelo de negocio" />}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-2">
            Rango de precio estimado <span className="text-red-400">*</span>
          </label>
          <select
            {...register('pricing_range')}
            className={`w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-gray-50 dark:bg-[#0A0A0F]
                        focus:border-indigo-500
                        ${errors.pricing_range ? 'border-red-300 bg-red-50' : 'border-gray-200 dark:border-white/15'}`}
          >
            <option value="">Selecciona un rango</option>
            {PRICING_RANGES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ErrorMsg message={errors.pricing_range?.message} />
          {showB2bFreeWarning && (
            <div className="mt-2 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/30">
              <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                <strong>B2B + Gratis:</strong> los modelos B2B rara vez son sostenibles sin precio. Si es un freemium o un piloto gratuito, selecciona el precio que pagarán en la versión de pago — mejora la calidad del unit economics generado.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-2">
            ¿Cómo vas a conseguir tus primeros 100 clientes?{' '}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">Ej: "Outbound en LinkedIn", "Ads en Meta", "Comunidades orgánicas en Discord"</p>
          <select
            {...register('acquisition_channel')}
            className="w-full px-4 py-3.5 border-2 rounded-2xl text-sm transition outline-none bg-gray-50 dark:bg-[#0A0A0F] focus:border-indigo-500 border-gray-200 dark:border-white/15"
          >
            <option value="">Selecciona un canal (opcional)</option>
            <option value="outbound_linkedin">Outbound en LinkedIn / cold email</option>
            <option value="ads_meta">Publicidad pagada (Meta / TikTok / Google)</option>
            <option value="comunidades_organico">Comunidades orgánicas (Discord, Reddit, grupos)</option>
            <option value="referidos">Referidos / boca a boca</option>
            <option value="alianzas">Alianzas con socios o canales existentes</option>
            <option value="contenido_seo">Contenido / SEO / redes sociales</option>
            <option value="eventos_presencial">Eventos presenciales / ferias</option>
            <option value="otro">Otro</option>
          </select>
        </div>

      </div>

      {/* Progreso de campos del paso */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-[#afaebb]">
          <span>Completitud del paso</span>
          <span className="font-bold tabular-nums">{filledMarket}/{MARKET_FIELDS.length}</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out bg-indigo-500"
            style={{ width: `${(filledMarket / MARKET_FIELDS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => { updateStepMarket(getValues()); prevStep(); }}
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
          Siguiente <span className="ml-2">→</span>
        </button>
      </div>
    </form>
  );
});

