import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { trackTelemetryEvent } from '@/lib/telemetry';
import type { UserTier } from '@/hooks/useUserTier';

// ── Feedback de calidad del reporte ───────────────────────────────────────────
// Reemplaza el micro-feedback hardcodeado (3 botones fijos → solo PostHog).
// Ahora:
//   1. Captura rating 1-5 + dimensiones a corregir (abiertas) + texto libre.
//   2. PERSISTE en la tabla report_feedback (fuente accionable para el RAG).
//   3. Sigue emitiendo el evento PostHog micro_feedback (no perdemos analítica).
// Flujo en 2 tiempos para no abrumar: primero el rating, luego (si lo da) el detalle.

const DEFAULT_DIMENSIONS = [
  'Tamaño de mercado (TAM)',
  'Competidores',
  'Finanzas / Unit economics',
  'El veredicto / score',
];

interface ReportFeedbackProps {
  validationId: string;
  /** Sección o prompt sobre el que opina (ej: 'playbook_analysis'). */
  section?: string;
  tier: UserTier;
  /** Dimensiones sugeridas para "¿qué corregirías?". Por defecto las comunes. */
  dimensions?: string[];
  className?: string;
}

const RATINGS = [
  { value: 1, emoji: '😖', label: 'Muy malo' },
  { value: 2, emoji: '🙁', label: 'Flojo' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '🙂', label: 'Bueno' },
  { value: 5, emoji: '🤩', label: 'Excelente' },
];

export function ReportFeedback({
  validationId,
  section = 'report',
  tier,
  dimensions = DEFAULT_DIMENSIONS,
  className = '',
}: ReportFeedbackProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [dims, setDims] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false); // ya opinó antes → no re-preguntar

  // ¿Ya dejó feedback de esta sección? RLS permite leer el propio.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const { count } = await supabase
        .from('report_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('validation_id', validationId)
        .eq('section', section)
        .eq('user_id', uid);
      if (active && (count ?? 0) > 0) setHidden(true);
    })();
    return () => { active = false; };
  }, [validationId, section]);

  const toggleDim = (d: string) =>
    setDims((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const submit = async (finalRating: number) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        await supabase.from('report_feedback').insert({
          validation_id: validationId,
          user_id: uid,
          rating: finalRating,
          section,
          dimensions_wrong: dims,
          free_text: text.trim() || null,
        });
      }
      // Analítica de embudo (no perdemos la señal agregada en PostHog).
      await trackTelemetryEvent({
        event_name: 'micro_feedback',
        context: {
          tier: (tier ?? 'free') as 'free' | 'basic' | 'pro' | 'premium',
          action_taken: `rating_${finalRating}${dims.length ? `:${dims.join(',')}` : ''}`,
          feature_name: section,
        },
      });
      setDone(true);
    } catch {
      // El feedback nunca debe romper la UI; mostramos el agradecimiento igual.
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (hidden) return null;

  if (done) {
    return (
      <p className={`text-xs text-center text-gray-400 dark:text-[#afaebb] ${className}`}>
        ¡Gracias! Tu feedback nos ayuda a mejorar los reportes.
      </p>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 shadow-sm ${className}`}
    >
      {/* Paso 1 — rating */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs font-medium text-gray-600 dark:text-[#C4C4D4] flex-1 leading-snug">
          ¿Qué tan útil te resultó este reporte?
        </p>
        <div className="flex gap-1.5 shrink-0">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              title={r.label}
              aria-label={r.label}
              onClick={() => {
                setRating(r.value);
                // 4-5 = positivo → envío directo sin pedir más. 1-3 = abrimos el detalle.
                if (r.value >= 4) submit(r.value);
              }}
              className={`w-9 h-9 rounded-xl text-lg transition-all ${
                rating === r.value
                  ? 'bg-[#0EB5C6]/15 ring-2 ring-[#0EB5C6] scale-110'
                  : 'bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Paso 2 — detalle (solo si valoró bajo) */}
      {rating !== null && rating < 4 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">¿Qué deberíamos corregir? (opcional)</p>
          <div className="flex gap-2 flex-wrap">
            {dimensions.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDim(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                  dims.includes(d)
                    ? 'bg-[#0EB5C6]/15 border-[#0EB5C6]/40 text-[#0EB5C6]'
                    : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#C4C4D4] hover:bg-gray-100 dark:hover:bg-white/10'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Contanos qué estuvo mal o qué tuviste que corregir…"
            className="w-full text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-[#C4C4D4] p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#0EB5C6]/40"
          />
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit(rating)}
            className="px-4 py-2 bg-[#0EB5C6] text-white text-xs font-bold rounded-xl hover:bg-[#6B5EE6] transition disabled:opacity-50"
          >
            {submitting ? 'Enviando…' : 'Enviar feedback'}
          </button>
        </div>
      )}
    </div>
  );
}
