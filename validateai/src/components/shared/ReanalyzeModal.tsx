import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TARGET_COUNTRIES, BUSINESS_MODELS, BUSINESS_STAGES, PRICING_RANGES } from '@/types/validation';
import type { FounderContext } from '@/types/validation';

const BUSINESS_MODEL_LABELS: Record<string, string> = {
  b2b: 'B2B', b2c: 'B2C', b2b2c: 'B2B2C', marketplace: 'Marketplace',
};
const BUSINESS_STAGE_LABELS: Record<string, string> = {
  idea: 'Idea', 'pre-product': 'Pre-producto', early: 'Early stage', growth: 'Crecimiento',
};

const schema = z.object({
  target_country: z.string().min(1, 'Selecciona un país'),
  target_region: z.string().optional(),
  business_model: z.enum(BUSINESS_MODELS),
  business_stage: z.enum(BUSINESS_STAGES),
  pricing_range: z.string().min(1, 'Selecciona un rango'),
  known_competitors: z.array(z.string()).max(5).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  existing: Partial<FormData>;
  onSubmit: (data: FormData & { founderContext?: FounderContext }) => void;
  onCancel: () => void;
}

function ErrorMsg({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-500 text-xs mt-1.5">{message}</p>;
}

export function ReanalyzeModal({ existing, onSubmit, onCancel }: Props) {
  const [competitorInput, setCompetitorInput] = useState('');
  const [competitors, setCompetitors] = useState<string[]>(existing.known_competitors ?? []);
  const [showFounder, setShowFounder] = useState(false);
  const [founderCtx, setFounderCtx] = useState<FounderContext>({
    yearsInIndustry: 0,
    hasBuiltBefore: false,
    hasTechnicalCofounder: false,
    personallyFacedProblem: false,
    networkInTargetMarket: 'none',
  });

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      target_country: existing.target_country ?? '',
      target_region: existing.target_region ?? '',
      business_model: existing.business_model,
      business_stage: existing.business_stage,
      pricing_range: existing.pricing_range ?? '',
      known_competitors: existing.known_competitors ?? [],
    },
  });

  const addCompetitor = () => {
    const val = competitorInput.trim();
    if (!val || competitors.length >= 5) return;
    const updated = [...competitors, val];
    setCompetitors(updated);
    setValue('known_competitors', updated);
    setCompetitorInput('');
  };

  const removeCompetitor = (i: number) => {
    const updated = competitors.filter((_, idx) => idx !== i);
    setCompetitors(updated);
    setValue('known_competitors', updated);
  };

  const handleFormSubmit = (data: FormData) => {
    onSubmit({ ...data, known_competitors: competitors, founderContext: showFounder ? founderCtx : undefined });
  };

  const needsCountry = !existing.target_country;
  const needsModel = !existing.business_model;
  const needsStage = !existing.business_stage;
  const needsPrice = !existing.pricing_range;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#12121A] rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Completar contexto de mercado</h2>
              <p className="text-xs text-gray-400 mt-0.5">Necesitamos estos datos para el análisis actualizado</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="px-6 py-5 space-y-5">
          {/* País + región */}
          {(needsCountry || !existing.target_region) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {needsCountry && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] mb-2">
                    País objetivo <span className="text-red-400">*</span>
                  </label>
                  <select
                    {...register('target_country')}
                    className={`w-full px-4 py-3 border-2 rounded-2xl text-sm outline-none bg-white dark:bg-[#12121A] focus:border-teal-500 transition
                      ${errors.target_country ? 'border-red-300 bg-red-50' : 'border-gray-200 dark:border-white/10'}`}
                  >
                    <option value="">Selecciona un país</option>
                    {TARGET_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ErrorMsg message={errors.target_country?.message} />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] mb-2">
                  Región <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  {...register('target_region')}
                  placeholder="Ej: Santiago, CDMX..."
                  className="w-full px-4 py-3 border-2 rounded-2xl text-sm outline-none bg-white dark:bg-[#12121A] focus:border-teal-500 transition border-gray-200 dark:border-white/10 placeholder:text-gray-300"
                />
              </div>
            </div>
          )}

          {/* Modelo de negocio */}
          {needsModel && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] mb-3">
                Modelo de negocio <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BUSINESS_MODELS.map((m) => (
                  <label key={m} className="cursor-pointer">
                    <input type="radio" {...register('business_model')} value={m} className="peer hidden" />
                    <div className="px-3 py-2.5 text-center text-sm border-2 rounded-xl font-medium text-gray-500 dark:text-[#8B8AA0] border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121A]
                                    peer-checked:bg-teal-500 peer-checked:text-white peer-checked:border-teal-500
                                    hover:border-teal-300 hover:text-teal-600 transition-all duration-150">
                      {BUSINESS_MODEL_LABELS[m]}
                    </div>
                  </label>
                ))}
              </div>
              {errors.business_model && <ErrorMsg message="Selecciona un modelo" />}
            </div>
          )}

          {/* Etapa */}
          {needsStage && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] mb-3">
                Etapa del proyecto <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BUSINESS_STAGES.map((s) => (
                  <label key={s} className="cursor-pointer">
                    <input type="radio" {...register('business_stage')} value={s} className="peer hidden" />
                    <div className="px-3 py-2.5 text-center text-sm border-2 rounded-xl font-medium text-gray-500 dark:text-[#8B8AA0] border-gray-200 dark:border-white/10 bg-white dark:bg-[#12121A]
                                    peer-checked:bg-teal-500 peer-checked:text-white peer-checked:border-teal-500
                                    hover:border-teal-300 hover:text-teal-600 transition-all duration-150">
                      {BUSINESS_STAGE_LABELS[s]}
                    </div>
                  </label>
                ))}
              </div>
              {errors.business_stage && <ErrorMsg message="Selecciona una etapa" />}
            </div>
          )}

          {/* Precio */}
          {needsPrice && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] mb-2">
                Rango de precio estimado <span className="text-red-400">*</span>
              </label>
              <select
                {...register('pricing_range')}
                className={`w-full px-4 py-3 border-2 rounded-2xl text-sm outline-none bg-white dark:bg-[#12121A] focus:border-teal-500 transition
                  ${errors.pricing_range ? 'border-red-300 bg-red-50' : 'border-gray-200 dark:border-white/10'}`}
              >
                <option value="">Selecciona un rango</option>
                {PRICING_RANGES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <ErrorMsg message={errors.pricing_range?.message} />
            </div>
          )}

          {/* Competidores */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] mb-2">
              Competidores que conoces <span className="text-gray-400 font-normal">(opcional, máx. 5)</span>
            </label>
            <div className="flex gap-2">
              <input
                value={competitorInput}
                onChange={(e) => setCompetitorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCompetitor(); } }}
                placeholder="Escribe un nombre y presiona Enter"
                disabled={competitors.length >= 5}
                className="flex-1 px-4 py-3 border-2 rounded-2xl text-sm outline-none bg-white dark:bg-[#12121A] focus:border-teal-500 transition
                           border-gray-200 dark:border-white/10 placeholder:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={addCompetitor}
                disabled={!competitorInput.trim() || competitors.length >= 5}
                className="px-4 py-3 bg-teal-500 text-white rounded-2xl text-sm font-semibold hover:bg-teal-600 transition disabled:opacity-40"
              >
                +
              </button>
            </div>
            {competitors.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {competitors.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-full text-xs font-medium">
                    {c}
                    <button type="button" onClick={() => removeCompetitor(i)} className="text-teal-400 hover:text-teal-700 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* FounderContext — sección opcional colapsable */}
          <div className="border-2 border-purple-100 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFounder((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-purple-600">✦</span>
                <span className="text-xs font-bold text-purple-700">Contexto del fundador</span>
                <span className="text-xs text-purple-400">(mejora el análisis de Founder Fit)</span>
              </div>
              <svg
                className={`w-4 h-4 text-purple-400 transition-transform ${showFounder ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFounder && (
              <div className="px-4 py-4 space-y-4">
                {/* Años de experiencia */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-[#C4C4D4] mb-1">
                    Años de experiencia en esta industria
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={founderCtx.yearsInIndustry}
                    onChange={(e) => setFounderCtx((f) => ({ ...f, yearsInIndustry: Number(e.target.value) }))}
                    className="w-24 px-3 py-2 border-2 rounded-xl text-sm outline-none focus:border-purple-400 transition border-gray-200 dark:border-white/10"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-2.5">
                  {[
                    { key: 'hasBuiltBefore',          label: 'Ya lancé un producto o negocio antes' },
                    { key: 'hasTechnicalCofounder',   label: 'Tengo co-fundador técnico' },
                    { key: 'personallyFacedProblem',  label: 'He vivido personalmente este problema' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                          founderCtx[key as keyof FounderContext]
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-gray-300 group-hover:border-purple-300'
                        }`}
                        onClick={() =>
                          setFounderCtx((f) => ({ ...f, [key]: !f[key as keyof FounderContext] }))
                        }
                      >
                        {founderCtx[key as keyof FounderContext] && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-gray-600 dark:text-[#8B8AA0]">{label}</span>
                    </label>
                  ))}
                </div>

                {/* Red de contactos */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-[#C4C4D4] mb-2">
                    Red de contactos en el mercado objetivo
                  </label>
                  <div className="flex gap-2">
                    {(['none', 'some', 'strong'] as const).map((v) => {
                      const labels = { none: 'Ninguna', some: 'Algunos', strong: 'Sólida' };
                      const active = founderCtx.networkInTargetMarket === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setFounderCtx((f) => ({ ...f, networkInTargetMarket: v }))}
                          className={`flex-1 py-2 text-xs font-semibold rounded-xl border-2 transition ${
                            active
                              ? 'bg-purple-500 text-white border-purple-500'
                              : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-[#8B8AA0] hover:border-purple-300 hover:text-purple-600'
                          }`}
                        >
                          {labels[v]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 border-2 border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8B8AA0] font-semibold rounded-2xl hover:bg-gray-50 dark:bg-[#0A0A0F] transition text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-teal-500 text-white font-bold rounded-2xl hover:bg-teal-600 active:scale-[0.98] transition-all shadow-lg shadow-teal-500/25 text-sm"
            >
              Analizar →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
