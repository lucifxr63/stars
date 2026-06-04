import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { detectBias } from '@/utils/biasDetector';
import type { FormField, FieldType, SurveyForm, BiasDetectionResult } from '@/types/survey';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const FIELD_TYPES: Array<{ value: FieldType; label: string; icon: string }> = [
  { value: 'text',     label: 'Texto corto',      icon: '✏️' },
  { value: 'textarea', label: 'Texto largo',       icon: '📄' },
  { value: 'radio',    label: 'Opción única',      icon: '🔘' },
  { value: 'checkbox', label: 'Múltiple opción',   icon: '☑️' },
  { value: 'scale',    label: 'Escala 1-10',       icon: '📊' },
  { value: 'date',     label: 'Fecha',             icon: '📅' },
  { value: 'select',   label: 'Desplegable',       icon: '🔽' },
];

// Plantillas Mom Test listas para usar
const MOM_TEST_TEMPLATES: Array<{ label: string; type: FieldType; text: string }> = [
  { type: 'textarea', label: 'Rutina actual', text: 'Describe paso a paso cómo resuelves actualmente este problema. ¿Qué herramientas usas?' },
  { type: 'text',     label: 'Última vez', text: '¿Cuándo fue la última vez que enfrentaste este problema? ¿Qué hiciste exactamente?' },
  { type: 'textarea', label: 'Impacto económico', text: '¿Cuánto tiempo perdiste la semana pasada en este problema? ¿Cuáles fueron las consecuencias?' },
  { type: 'text',     label: 'Presupuesto real', text: '¿Qué herramientas pagas actualmente para esto y cuánto te cuestan al mes?' },
  { type: 'radio',    label: 'Urgencia revelada', text: '¿En cuántas de las últimas 4 semanas este problema afectó tu trabajo?', },
  { type: 'textarea', label: 'Workaround actual', text: 'Nombra los 3 mayores desafíos operativos que más capital o tiempo consumen en tu negocio hoy.' },
  { type: 'text',     label: 'Equipo afectado', text: '¿Quién más en tu organización se ve afectado por este problema? ¿Cómo lo manejan ellos?' },
];

function newField(type: FieldType = 'text'): FormField {
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    label: '',
    required: false,
    options: type === 'radio' || type === 'checkbox' || type === 'select' ? ['', ''] : undefined,
  };
}

// ── BiasAlert ──────────────────────────────────────────────
function BiasAlert({ result }: { result: BiasDetectionResult }) {
  if (!result.hasBias) return null;
  return (
    <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
      <p className="text-xs font-semibold text-amber-400 mb-1">⚠️ Posible sesgo detectado (Mom Test)</p>
      <ul className="text-xs text-amber-300/80 space-y-0.5 mb-2">
        {result.patterns.map((p, i) => <li key={i}>• {p}</li>)}
      </ul>
      {result.suggestion && (
        <p className="text-xs text-amber-200/70 italic">💡 {result.suggestion}</p>
      )}
    </div>
  );
}

// ── FieldEditor ────────────────────────────────────────────
function FieldEditor({
  field,
  index,
  total,
  onChange,
  onDelete,
  onMove,
}: {
  field: FormField;
  index: number;
  total: number;
  onChange: (f: FormField) => void;
  onDelete: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const bias = detectBias(field.label);

  const updateOption = (i: number, val: string) => {
    const options = [...(field.options ?? [])];
    options[i] = val;
    onChange({ ...field, options });
  };
  const addOption = () => onChange({ ...field, options: [...(field.options ?? []), ''] });
  const removeOption = (i: number) => onChange({ ...field, options: (field.options ?? []).filter((_, idx) => idx !== i) });

  return (
    <div className="bg-[#1A1A28] border border-white/5 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[#7C6FF7] w-5 text-center">{index + 1}</span>
        <select
          value={field.type}
          onChange={e => onChange({ ...newField(e.target.value as FieldType), id: field.id, label: field.label })}
          className="text-xs bg-[#12121A] border border-white/10 text-[#C4C4D4] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#7C6FF7]"
        >
          {FIELD_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>

        <label className="ml-auto flex items-center gap-1.5 text-xs text-[#C4C4D4] cursor-pointer">
          <input
            type="checkbox"
            checked={field.required}
            onChange={e => onChange({ ...field, required: e.target.checked })}
            className="accent-[#7C6FF7]"
          />
          Obligatoria
        </label>

        <div className="flex gap-1">
          <button onClick={() => onMove('up')} disabled={index === 0} className="w-6 h-6 flex items-center justify-center text-[#C4C4D4] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed text-xs">↑</button>
          <button onClick={() => onMove('down')} disabled={index === total - 1} className="w-6 h-6 flex items-center justify-center text-[#C4C4D4] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed text-xs">↓</button>
          <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-red-400/60 hover:text-red-400 text-xs">✕</button>
        </div>
      </div>

      {/* Label */}
      <div>
        <textarea
          value={field.label}
          onChange={e => onChange({ ...field, label: e.target.value })}
          placeholder="Escribe la pregunta aquí..."
          rows={2}
          className="w-full text-sm bg-[#0A0A0F] border border-white/10 text-[#F0EFF8] placeholder-white/20 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#7C6FF7]"
        />
        <BiasAlert result={bias} />
        {!bias.hasBias && field.label.length > 10 && (
          <p className="text-xs text-green-400/60 mt-1">✓ Alineado con Mom Test</p>
        )}
      </div>

      {/* Opciones para radio/checkbox/select */}
      {(field.type === 'radio' || field.type === 'checkbox' || field.type === 'select') && (
        <div className="space-y-2">
          <p className="text-xs text-[#C4C4D4] font-medium">Opciones:</p>
          {(field.options ?? []).map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={opt}
                onChange={e => updateOption(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                className="flex-1 text-sm bg-[#0A0A0F] border border-white/10 text-[#F0EFF8] placeholder-white/20 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#7C6FF7]"
              />
              {(field.options ?? []).length > 2 && (
                <button onClick={() => removeOption(i)} className="text-red-400/50 hover:text-red-400 text-xs px-2">✕</button>
              )}
            </div>
          ))}
          <button onClick={addOption} className="text-xs text-[#7C6FF7] hover:underline">+ Agregar opción</button>
        </div>
      )}

      {/* Placeholder para text/textarea */}
      {(field.type === 'text' || field.type === 'textarea') && (
        <input
          value={field.placeholder ?? ''}
          onChange={e => onChange({ ...field, placeholder: e.target.value })}
          placeholder="Texto de ayuda (opcional)"
          className="w-full text-xs bg-[#0A0A0F] border border-white/10 text-[#C4C4D4] placeholder-white/20 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#7C6FF7]"
        />
      )}
    </div>
  );
}

// ── SurveyBuilder ─────────────────────────────────────────
export function SurveyBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [consentText, setConsentText] = useState(
    'Al enviar este formulario, consiento que mis respuestas sean procesadas para validar el proyecto del solicitante conforme a la Ley N° 21.719 de Protección de Datos Personales.'
  );
  const [fields, setFields] = useState<FormField[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token ?? null;
      setToken(t);
      if (t && isEdit) loadForm(t);
      else setLoading(false);
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadForm = async (t: string) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/survey-crud?id=${id}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error();
      const { form } = await res.json() as { form: SurveyForm };
      setTitle(form.title);
      setDescription(form.description ?? '');
      setConsentText(form.consent_text);
      setFields(form.schema_json?.fields ?? []);
    } catch {
      toast.error('No se pudo cargar la encuesta.');
      navigate('/surveys');
    } finally {
      setLoading(false);
    }
  };

  const addField = useCallback((type: FieldType = 'text') => {
    setFields(prev => [...prev, newField(type)]);
  }, []);

  const addTemplate = useCallback((t: typeof MOM_TEST_TEMPLATES[0]) => {
    const f = newField(t.type);
    f.label = t.text;
    if (t.type === 'radio') f.options = ['1 semana', '2-3 semanas', 'Todas las semanas'];
    setFields(prev => [...prev, f]);
  }, []);

  const updateField = useCallback((index: number, updated: FormField) => {
    setFields(prev => prev.map((f, i) => i === index ? updated : f));
  }, []);

  const deleteField = useCallback((index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveField = useCallback((index: number, dir: 'up' | 'down') => {
    setFields(prev => {
      const arr = [...prev];
      const swapIdx = dir === 'up' ? index - 1 : index + 1;
      [arr[index], arr[swapIdx]] = [arr[swapIdx], arr[index]];
      return arr;
    });
  }, []);

  const handleSave = async (publish = false) => {
    if (!token) return;
    if (!title.trim()) { toast.error('El título es obligatorio.'); return; }
    if (fields.length === 0) { toast.error('Agrega al menos una pregunta.'); return; }

    const emptyLabel = fields.find(f => !f.label.trim());
    if (emptyLabel) { toast.error('Todas las preguntas deben tener texto.'); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        consent_text: consentText,
        schema_json: { version: '1.0', fields },
        ui_schema: { order: fields.map(f => f.id), layout: 'single-page', pages: [] },
        ...(publish ? { is_published: true } : {}),
      };

      const url = isEdit
        ? `${SUPABASE_URL}/functions/v1/survey-crud?id=${id}`
        : `${SUPABASE_URL}/functions/v1/survey-crud`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();
      toast.success(publish ? 'Encuesta guardada y publicada.' : 'Encuesta guardada.');
      navigate('/surveys');
    } catch {
      toast.error('No se pudo guardar la encuesta.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0EFF8]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/surveys" className="text-xs text-[#7C6FF7] hover:underline mb-6 block">← Mis encuestas</Link>
        <h1 className="text-2xl font-bold mb-1">{isEdit ? 'Editar encuesta' : 'Nueva encuesta'}</h1>
        <p className="text-sm text-[#C4C4D4] mb-8">El sistema detecta preguntas sesgadas en tiempo real y sugiere reformulaciones Mom Test.</p>

        {/* Datos básicos */}
        <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5 mb-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#C4C4D4] block mb-1">Título de la encuesta *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Validación de problema — Gestión de proveedores PYME"
              className="w-full text-sm bg-[#0A0A0F] border border-white/10 text-[#F0EFF8] placeholder-white/20 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#7C6FF7]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#C4C4D4] block mb-1">Descripción (visible para el encuestado)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Estamos investigando cómo las PYMEs gestionan sus relaciones con proveedores. No hay respuestas correctas o incorrectas."
              rows={2}
              className="w-full text-sm bg-[#0A0A0F] border border-white/10 text-[#F0EFF8] placeholder-white/20 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#7C6FF7]"
            />
          </div>
        </div>

        {/* Plantillas Mom Test */}
        <div className="bg-[#12121A] border border-[#7C6FF7]/20 rounded-2xl p-5 mb-6">
          <p className="text-xs font-bold text-[#7C6FF7] mb-3">📋 Plantillas Mom Test (listas para usar)</p>
          <div className="flex flex-wrap gap-2">
            {MOM_TEST_TEMPLATES.map((t, i) => (
              <button
                key={i}
                onClick={() => addTemplate(t)}
                className="text-xs bg-[#7C6FF7]/10 hover:bg-[#7C6FF7]/20 border border-[#7C6FF7]/30 text-[#9B8FFF] px-3 py-1.5 rounded-lg transition-colors"
              >
                + {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de preguntas */}
        <div className="space-y-3 mb-6">
          {fields.length === 0 && (
            <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
              <p className="text-sm text-[#C4C4D4]">Agrega preguntas desde las plantillas o el botón de abajo.</p>
            </div>
          )}
          {fields.map((field, idx) => (
            <FieldEditor
              key={field.id}
              field={field}
              index={idx}
              total={fields.length}
              onChange={(f) => updateField(idx, f)}
              onDelete={() => deleteField(idx)}
              onMove={(dir) => moveField(idx, dir)}
            />
          ))}
        </div>

        {/* Agregar campo */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FIELD_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => addField(t.value)}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-[#C4C4D4] px-3 py-1.5 rounded-lg transition-colors"
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Consentimiento */}
        <div className="bg-[#12121A] border border-white/5 rounded-2xl p-5 mb-8">
          <label className="text-xs font-semibold text-[#C4C4D4] block mb-2">
            Texto de consentimiento (Ley N° 21.719)
          </label>
          <textarea
            value={consentText}
            onChange={e => setConsentText(e.target.value)}
            rows={3}
            className="w-full text-xs bg-[#0A0A0F] border border-white/10 text-[#C4C4D4] rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#7C6FF7]"
          />
          <p className="text-xs text-white/30 mt-1">Obligatorio — mostrado al encuestado antes de enviar sus respuestas.</p>
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[#F0EFF8] font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 bg-[#7C6FF7] hover:bg-[#6B5FE6] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Publicando...' : 'Guardar y publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
