import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepIdeaSchema, type StepIdea } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';
import { INDUSTRIES } from '@/utils/constants';
import { supabase } from '@/lib/supabase';

// ── Badge de extracción ────────────────────────────────────────────────────────
// Visible cuando el valor del campo coincide exactamente con el dato extraído del PDF.
// Desaparece en cuanto el usuario edita el campo (reactivo vía watch()).
function ExtractionBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold
                     bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 shrink-0">
      ✨ Extraído
    </span>
  );
}

// ── Indicador "Requerido para el análisis" en campos vacíos no auto-llenados ──
function RequiredHint() {
  return (
    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
      Requerido para el análisis
    </span>
  );
}

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

const inputCls = (hasError: boolean, highlight = false) =>
  `w-full px-4 py-3.5 rounded-xl text-sm text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#0A0A0F] border transition-all duration-150 outline-none
   placeholder:text-gray-400 dark:placeholder:text-[#afaebb]
   focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20
   ${hasError ? 'border-red-500/50 bg-red-500/5' : highlight ? 'border-violet-300 dark:border-violet-500/30 bg-violet-50/30 dark:bg-violet-900/5' : 'border-gray-200 dark:border-white/8 hover:border-gray-300 dark:hover:border-white/15'}`;

function DescriptionQuality({ length }: { length: number }) {
  if (length === 0) return null;
  const config =
    length < 100
      ? { label: `${length}/100 mín`, color: 'text-red-500', bar: 'bg-red-400', pct: (length / 100) * 50 }
      : length < 200
        ? { label: `${length} — añade más contexto`, color: 'text-amber-500', bar: 'bg-amber-400', pct: 50 + ((length - 100) / 100) * 25 }
        : length < 400
          ? { label: `${length} — buen nivel ✓`, color: 'text-emerald-600', bar: 'bg-emerald-500', pct: 75 + ((length - 200) / 200) * 20 }
          : { label: `${length} — calidad máxima ✓`, color: 'text-[#0EB5C6]', bar: 'bg-[#0EB5C6]', pct: 95 };
  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${config.bar}`} style={{ width: `${config.pct}%` }} />
      </div>
      <p className={`text-[11px] ${config.color}`}>{config.label}</p>
    </div>
  );
}

export function StepIdeaPremium() {
  const { stepIdea, extractedData, updateStepIdea, nextStep, prevStep } = useValidationStore();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<StepIdea>({
    resolver: zodResolver(StepIdeaSchema),
    defaultValues: stepIdea as StepIdea,
  });

  const ideaNameVal = watch('idea_name') ?? '';
  const ideaProblemVal = watch('idea_problem') ?? '';
  const ideaDescVal = watch('idea_description') ?? '';
  const industryVal = watch('idea_industry');
  const descriptionLen = ideaDescVal.length;

  // Badge: visible si el valor actual coincide con el extraído del PDF.
  // Desaparece en cuanto el usuario edita el campo.
  const badges = {
    idea_name: !!(extractedData?.projectName && ideaNameVal === extractedData.projectName),
    idea_problem: !!(extractedData?.problem && ideaProblemVal === extractedData.problem),
    idea_description: !!(extractedData?.solution && ideaDescVal === extractedData.solution),
  };

  const onSubmit = (data: StepIdea) => {
    updateStepIdea(data);
    const { validationId } = useValidationStore.getState();
    if (validationId) {
      supabase.from('validations').update({
        idea_name: data.idea_name,
        idea_problem: data.idea_problem,
        idea_description: data.idea_description,
        idea_industry: data.idea_industry,
        current_solution: data.current_solution,
        current_step: 3,
      }).eq('id', validationId).then(() => { });
    }
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header informativo */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800/30">
        <svg className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-violet-700 dark:text-violet-300 leading-relaxed">
          <strong className="font-semibold">La IA pre-llenó tu formulario.</strong>{' '}
          Revisa cada campo y ajusta lo que no sea preciso — tú tienes la última palabra.
        </p>
      </div>

      <div className="space-y-5">
        {/* Nombre de la idea */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2">
            Nombre de tu idea
            <ExtractionBadge visible={badges.idea_name} />
            {!ideaNameVal && <RequiredHint />}
          </label>
          <input
            {...register('idea_name')}
            placeholder="Ej: FreshBox, MediConnect, EduTrack..."
            className={inputCls(!!errors.idea_name, badges.idea_name)}
          />
          <ErrorMsg message={errors.idea_name?.message} />
        </div>

        {/* Problema */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2">
            Problema que resuelves <span className="text-red-400">*</span>
            <ExtractionBadge visible={badges.idea_problem} />
            {!ideaProblemVal && <RequiredHint />}
          </label>
          <p className="text-xs text-gray-400 dark:text-[#afaebb] mb-2">
            El dolor del cliente. ¿Qué le cuesta tiempo, dinero o frustración?
          </p>
          <textarea
            {...register('idea_problem')}
            rows={2}
            placeholder="Ej: Los gerentes de clínicas pierden 3h/día coordinando turnos manualmente en Excel..."
            className={`${inputCls(!!errors.idea_problem, badges.idea_problem)} resize-none leading-relaxed`}
          />
          <ErrorMsg message={errors.idea_problem?.message} />
        </div>

        {/* Descripción de la solución */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2">
            Describe tu solución <span className="text-red-400">*</span>
            <ExtractionBadge visible={badges.idea_description} />
          </label>
          <textarea
            {...register('idea_description')}
            rows={4}
            placeholder="Describe cómo funciona tu solución, para quién es y qué la diferencia..."
            className={`${inputCls(!!errors.idea_description, badges.idea_description)} resize-none leading-relaxed`}
          />
          <DescriptionQuality length={descriptionLen} />
          {errors.idea_description && <ErrorMsg message={errors.idea_description.message} />}
        </div>

        {/* Solución actual de incumbentes — siempre vacío, el usuario debe completar */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-1.5">
            ¿Cómo lo resuelven tus clientes hoy? <span className="text-red-400">*</span>
            <RequiredHint />
          </label>
          <p className="text-xs text-gray-400 dark:text-[#afaebb] mb-2">
            No extraíble automáticamente — nombra 2 herramientas o métodos concretos que usa tu cliente.
          </p>
          <input
            {...register('current_solution')}
            placeholder="Ej: Excel + WhatsApp para coordinarse, o contratan un asistente administrativo"
            className={inputCls(!!errors.current_solution)}
          />
          <ErrorMsg message={errors.current_solution?.message} />
        </div>

        {/* Industria — siempre vacío, el usuario selecciona */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-[#F0EFF8] mb-2">
            Industria
            {!industryVal && <RequiredHint />}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
            {INDUSTRIES.map((ind) => (
              <label key={ind.value} className="cursor-pointer">
                <input type="radio" {...register('idea_industry')} value={ind.value} className="peer hidden" />
                <div className="px-3 py-2.5 text-center text-xs border rounded-xl font-medium
                                text-gray-500 dark:text-[#8B8AA0] border-gray-200 dark:border-white/8 bg-white dark:bg-transparent
                                peer-checked:bg-[#0EB5C6]/15 peer-checked:text-[#0EB5C6] dark:peer-checked:text-[#38D5E3] peer-checked:border-[#0EB5C6]/40
                                hover:border-gray-300 dark:hover:border-white/20 transition-all duration-150">
                  {ind.label}
                </div>
              </label>
            ))}
          </div>
          {errors.idea_industry && <ErrorMsg message="Selecciona una industria" />}
        </div>
      </div>

      <div className="flex gap-4">
        <button type="button" onClick={prevStep}
          className="w-1/3 py-4 text-gray-600 dark:text-[#8B8AA0] font-bold rounded-2xl hover:bg-gray-100 dark:bg-white/5 transition-all text-sm">
          Volver
        </button>
        <button type="submit"
          className="w-2/3 py-4 bg-[#0EB5C6] text-white font-bold rounded-2xl
                     hover:bg-[#6B5EE6] active:scale-[0.98] transition-all
                     shadow-lg shadow-[#0EB5C6]/25 text-sm">
          Continuar al mercado →
        </button>
      </div>
    </form>
  );
}
