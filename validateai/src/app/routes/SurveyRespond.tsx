// Página pública de respuesta de encuesta — accesible sin autenticación
// URL: /s/:slug
// Implementa consentimiento explícito (Ley N° 21.719) y validación en tiempo real.

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { SurveyForm, FormField, FieldType } from '@/types/survey';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function fetchPublicForm(slug: string): Promise<SurveyForm | null> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY as string);
  const { data } = await sb
    .from('survey_forms')
    .select('*')
    .eq('unique_slug', slug)
    .eq('is_published', true)
    .single();
  return data as SurveyForm | null;
}

// ── Renderizador de campo individual ─────────────────────
function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
}) {
  const baseInput = 'w-full text-sm bg-[#12121A] border text-[#F0EFF8] placeholder-white/20 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#7C6FF7] transition-colors';
  const borderClass = error ? 'border-red-500/60' : 'border-white/10';

  switch (field.type as FieldType) {
    case 'text':
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`${baseInput} ${borderClass}`}
        />
      );

    case 'textarea':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder ?? 'Cuéntanos con detalle...'}
          rows={4}
          className={`${baseInput} ${borderClass} resize-none`}
        />
      );

    case 'radio':
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-[#7C6FF7] w-4 h-4"
              />
              <span className="text-sm text-[#C4C4D4] group-hover:text-[#F0EFF8] transition-colors">{opt}</span>
            </label>
          ))}
        </div>
      );

    case 'checkbox': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={e => {
                  if (e.target.checked) onChange([...selected, opt]);
                  else onChange(selected.filter(v => v !== opt));
                }}
                className="accent-[#7C6FF7] w-4 h-4"
              />
              <span className="text-sm text-[#C4C4D4] group-hover:text-[#F0EFF8] transition-colors">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'scale': {
      const num = value !== undefined && value !== '' ? Number(value) : null;
      const min = field.validation?.min ?? 1;
      const max = field.validation?.max ?? 10;
      return (
        <div>
          <div className="flex gap-1 mb-2 flex-wrap">
            {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
              <button
                key={n}
                onClick={() => onChange(n)}
                className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                  num === n
                    ? 'bg-[#7C6FF7] text-white'
                    : 'bg-white/5 border border-white/10 text-[#C4C4D4] hover:border-[#7C6FF7]/50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-white/30 px-1">
            <span>Mínimo</span><span>Máximo</span>
          </div>
        </div>
      );
    }

    case 'date':
      return (
        <input
          type="date"
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className={`${baseInput} ${borderClass}`}
        />
      );

    case 'select':
      return (
        <select
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          className={`${baseInput} ${borderClass}`}
        >
          <option value="">Selecciona una opción...</option>
          {(field.options ?? []).map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      );

    default:
      return null;
  }
}

// ── SurveyRespond ─────────────────────────────────────────
export function SurveyRespond() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<SurveyForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchPublicForm(slug)
      .then(f => {
        if (!f) { setNotFound(true); return; }
        setForm(f);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const setResponse = (fieldId: string, val: unknown) => {
    setResponses(prev => ({ ...prev, [fieldId]: val }));
    setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  // Verifica visibilidad condicional
  const isVisible = (field: FormField) => {
    if (!field.conditional?.showIf) return true;
    const dep = field.conditional.showIf;
    return responses[dep.fieldId] === dep.value;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of (form?.schema_json?.fields ?? [])) {
      if (!isVisible(field)) continue;
      const val = responses[field.id];
      const isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
      if (field.required && isEmpty) newErrors[field.id] = 'Esta pregunta es obligatoria.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!form || !slug) return;
    if (!consentGiven) { toast.error('Debes aceptar el consentimiento para enviar.'); return; }
    if (!validate()) { toast.error('Por favor completa todas las preguntas obligatorias.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/survey-respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          response_data: responses,
          consent_given: true,
          metadata: {
            user_agent: navigator.userAgent,
            referrer: document.referrer,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.validation_errors) {
          toast.error('Hay errores en tus respuestas.');
          return;
        }
        throw new Error(data.error);
      }

      setSubmitted(true);
    } catch (err) {
      toast.error('No se pudo enviar. Inténtalo de nuevo.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Estados de la página ──────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-center px-4">
      <div>
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-xl font-bold text-[#F0EFF8] mb-2">Encuesta no encontrada</h1>
        <p className="text-sm text-[#C4C4D4]">El enlace puede haber expirado o ser incorrecto.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-center px-4">
      <div className="max-w-md">
        <p className="text-5xl mb-4">✅</p>
        <h1 className="text-xl font-bold text-[#F0EFF8] mb-2">¡Gracias por tu tiempo!</h1>
        <p className="text-sm text-[#C4C4D4] mb-4">Tus respuestas fueron registradas. Son muy valiosas para entender mejor el problema de mercado.</p>
        <p className="text-xs text-white/30">Tus datos son procesados bajo consentimiento explícito y la Ley N° 21.719 de Protección de Datos Personales de Chile.</p>
      </div>
    </div>
  );

  if (!form) return null;

  const visibleFields = (form.schema_json?.fields ?? []).filter(isVisible);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0EFF8]">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header del formulario */}
        <div className="mb-8">
          <div className="w-10 h-1 bg-[#7C6FF7] rounded-full mb-4" />
          <h1 className="text-2xl font-bold mb-2">{form.title}</h1>
          {form.description && (
            <p className="text-sm text-[#C4C4D4]">{form.description}</p>
          )}
          <p className="text-xs text-white/30 mt-3">
            {visibleFields.filter(f => f.required).length} preguntas obligatorias ·
            Sin preguntas correctas o incorrectas
          </p>
        </div>

        {/* Preguntas */}
        <div className="space-y-6 mb-8">
          {visibleFields.map((field, idx) => (
            <div key={field.id} className="bg-[#12121A] border border-white/5 rounded-2xl p-5">
              <label className="block mb-3">
                <span className="text-xs font-semibold text-[#7C6FF7] mr-2">{idx + 1}.</span>
                <span className="text-sm font-medium text-[#F0EFF8]">{field.label}</span>
                {field.required && <span className="text-red-400 ml-1 text-xs">*</span>}
              </label>
              <FieldRenderer
                field={field}
                value={responses[field.id]}
                onChange={val => setResponse(field.id, val)}
                error={errors[field.id]}
              />
              {errors[field.id] && (
                <p className="text-xs text-red-400 mt-1.5">{errors[field.id]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Consentimiento — Ley 21.719 */}
        <div className="bg-[#12121A] border border-[#7C6FF7]/20 rounded-2xl p-5 mb-6">
          <label className="flex gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={e => setConsentGiven(e.target.checked)}
              className="accent-[#7C6FF7] w-4 h-4 mt-0.5 shrink-0"
            />
            <span className="text-xs text-[#C4C4D4] leading-relaxed">
              {form.consent_text}
            </span>
          </label>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !consentGiven}
          className="w-full bg-[#7C6FF7] hover:bg-[#6B5FE6] disabled:opacity-40 text-white font-semibold py-3 rounded-2xl text-sm transition-colors"
        >
          {submitting ? 'Enviando...' : 'Enviar respuestas'}
        </button>

        <p className="text-xs text-white/20 text-center mt-4">
          Protegido bajo Ley N° 21.719 de Protección de Datos Personales (Chile).
          Puedes solicitar la eliminación de tus datos en cualquier momento.
        </p>
      </div>
    </div>
  );
}
