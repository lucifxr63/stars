import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type EventType = 'pre_order' | 'loi' | 'active_user' | 'interview' | 'revenue' | 'other';

interface TractionEvent {
  id: string;
  event_type: EventType;
  title: string;
  value: number | null;
  value_unit: string | null;
  event_date: string;
  notes: string | null;
  created_at: string;
}

const EVENT_CONFIG: Record<EventType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  pre_order:   { label: 'Pre-order',      icon: '🛒', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
  loi:         { label: 'LOI / Carta',    icon: '📄', color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-500/10',    border: 'border-blue-200 dark:border-blue-500/20'    },
  active_user: { label: 'Usuario Activo', icon: '👤', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20' },
  interview:   { label: 'Entrevista',     icon: '🎤', color: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-500/10',  border: 'border-amber-200 dark:border-amber-500/20'  },
  revenue:     { label: 'Ingreso',        icon: '💰', color: 'text-teal-700 dark:text-teal-400',    bg: 'bg-teal-50 dark:bg-teal-500/10',    border: 'border-teal-200 dark:border-teal-500/20'    },
  other:       { label: 'Otro',           icon: '📌', color: 'text-gray-700 dark:text-[#8B8AA0]',   bg: 'bg-gray-50 dark:bg-white/5',        border: 'border-gray-200 dark:border-white/10'        },
};

interface FormState {
  event_type: EventType;
  title: string;
  value: string;
  value_unit: string;
  event_date: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  event_type: 'pre_order',
  title: '',
  value: '',
  value_unit: '',
  event_date: new Date().toISOString().split('T')[0],
  notes: '',
};

interface Props {
  validationId: string;
}

export function TractionTracker({ validationId }: Props) {
  const [events, setEvents] = useState<TractionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('traction_events')
      .select('*')
      .eq('validation_id', validationId)
      .order('event_date', { ascending: false });

    if (!error) setEvents((data ?? []) as TractionEvent[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [validationId]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Agrega un título al hito'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No session');

      const { error } = await supabase.from('traction_events').insert({
        validation_id: validationId,
        user_id: user.id,
        event_type: form.event_type,
        title: form.title.trim(),
        value: form.value ? parseFloat(form.value) : null,
        value_unit: form.value_unit.trim() || null,
        event_date: form.event_date,
        notes: form.notes.trim() || null,
      });

      if (error) throw error;
      toast.success('Hito registrado');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch {
      toast.error('No se pudo guardar el hito');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('traction_events').delete().eq('id', id);
    if (error) { toast.error('No se pudo eliminar'); }
    else { setEvents((prev) => prev.filter((e) => e.id !== id)); }
    setDeletingId(null);
  };

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

  // Summary counts
  const summary = Object.entries(EVENT_CONFIG).map(([type, cfg]) => ({
    type: type as EventType,
    cfg,
    count: events.filter((e) => e.event_type === type).length,
  })).filter((s) => s.count > 0);

  return (
    <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center shrink-0">
            <svg className="w-4.5 h-4.5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Traction Tracker</h3>
            <p className="text-xs text-gray-400">{events.length} hito{events.length !== 1 ? 's' : ''} registrado{events.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all active:scale-[0.97]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={showForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
          </svg>
          {showForm ? 'Cancelar' : 'Agregar hito'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="p-5 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#0A0A0F]/60 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tipo */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide block mb-1.5">Tipo de hito</label>
              <select
                value={form.event_type}
                onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value as EventType }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-800 dark:text-[#F0EFF8] focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              >
                {Object.entries(EVENT_CONFIG).map(([type, cfg]) => (
                  <option key={type} value={type}>{cfg.icon} {cfg.label}</option>
                ))}
              </select>
            </div>
            {/* Fecha */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide block mb-1.5">Fecha</label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-800 dark:text-[#F0EFF8] focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide block mb-1.5">Título del hito *</label>
            <input
              type="text"
              placeholder="Ej: 5 pre-orders confirmados de beta cerrada"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-800 dark:text-[#F0EFF8] focus:outline-none focus:ring-2 focus:ring-teal-500/40 placeholder:text-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Valor */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide block mb-1.5">Valor (opcional)</label>
              <input
                type="number"
                placeholder="Ej: 5"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-800 dark:text-[#F0EFF8] focus:outline-none focus:ring-2 focus:ring-teal-500/40 placeholder:text-gray-400"
              />
            </div>
            {/* Unidad */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide block mb-1.5">Unidad</label>
              <input
                type="text"
                placeholder="CLP, USD, usuarios..."
                value={form.value_unit}
                onChange={(e) => setForm((f) => ({ ...f, value_unit: e.target.value }))}
                className="w-full px-3 py-2 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-800 dark:text-[#F0EFF8] focus:outline-none focus:ring-2 focus:ring-teal-500/40 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide block mb-1.5">Notas (opcional)</label>
            <textarea
              placeholder="Contexto, condiciones, fuente..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-800 dark:text-[#F0EFF8] focus:outline-none focus:ring-2 focus:ring-teal-500/40 placeholder:text-gray-400 resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            {saving ? 'Guardando...' : 'Guardar hito'}
          </button>
        </div>
      )}

      {/* Summary chips */}
      {summary.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 flex flex-wrap gap-2">
          {summary.map(({ type, cfg, count }) => (
            <span key={type} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              {cfg.icon} {count} {cfg.label}{count > 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Events list */}
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {loading && (
          <div className="py-8 text-center">
            <div className="w-5 h-5 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="py-10 text-center px-6">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] mb-1">Sin hitos registrados</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              Registra pre-orders, entrevistas con usuarios, LOIs o cualquier señal de tracción real para mostrar a inversores.
            </p>
          </div>
        )}

        {events.map((ev) => {
          const cfg = EVENT_CONFIG[ev.event_type];
          return (
            <div key={ev.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base border ${cfg.bg} ${cfg.border}`}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-[#E0DFF5] leading-snug">{ev.title}</p>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    disabled={deletingId === ev.id}
                    className="opacity-0 group-hover:opacity-100 shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                    title="Eliminar"
                  >
                    {deletingId === ev.id ? (
                      <div className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-[11px] text-gray-400">{fmtDate(ev.event_date)}</span>
                  {ev.value != null && (
                    <span className="text-[11px] font-semibold text-gray-600 dark:text-[#C4C4D4]">
                      {ev.value.toLocaleString('es-CL')} {ev.value_unit ?? ''}
                    </span>
                  )}
                </div>
                {ev.notes && (
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{ev.notes}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
