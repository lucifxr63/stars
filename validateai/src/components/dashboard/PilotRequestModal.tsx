import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

// ── PilotRequestModal ─────────────────────────────────────────────────────────
// Formulario de solicitud de piloto (autenticado). Inserta en public.pilots vía
// RLS (auth.uid() = user_id). No usa service_role. No envía PII a analytics.

const SEGMENTS: { value: string; label: string }[] = [
  { value: 'founder', label: 'Founder' },
  { value: 'pre_seed_seed', label: 'Pre-seed / Seed' },
  { value: 'aceleradora', label: 'Aceleradora' },
  { value: 'incubadora', label: 'Incubadora' },
  { value: 'innovacion_corporativa', label: 'Innovación corporativa' },
  { value: 'mentor_scout', label: 'Mentor / Scout' },
  { value: 'otro', label: 'Otro' },
];

const STAGES: { value: string; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'mvp', label: 'MVP' },
  { value: 'piloto', label: 'Piloto' },
  { value: 'traccion_inicial', label: 'Tracción inicial' },
  { value: 'levantando_capital', label: 'Levantando capital' },
  { value: 'otro', label: 'Otro' },
];

const PLANS: { value: string; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
];

const OBJECTIVE_MAX = 500;

interface PilotRequestModalProps {
  tier?: string;
  source?: string;
  onClose: () => void;
  /** Se llama tras un insert exitoso para que la card refresque su estado. */
  onSubmitted: () => void;
}

const selectCls =
  'w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-[#F0EFF8] focus:outline-none focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20 transition-all';
const labelCls = 'block text-[11px] font-semibold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-1.5';

export function PilotRequestModal({ tier, source = 'dashboard', onClose, onSubmitted }: PilotRequestModalProps) {
  const [segment, setSegment] = useState('');
  const [stage, setStage] = useState('');
  const [objective, setObjective] = useState('');
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent('pilot_request_modal_opened', { tier, source });
  }, [tier, source]);

  const submit = useCallback(async () => {
    if (!segment) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user?.email) {
        toast.error('Necesitas una sesión válida para solicitar un piloto.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('pilots').insert({
        user_id: user.id,
        email: user.email,
        segment,
        stage: stage || null,
        objective: objective.trim() || null,
        plan_interes: plan || null,
        source,
      });

      if (error) {
        // 23505 = unique_violation → ya hay una solicitud abierta (índice parcial).
        const failureType = error.code === '23505' ? 'duplicate' : 'insert_error';
        trackEvent('pilot_request_failed', { tier, source, segment, failure_type: failureType });
        toast.error(
          failureType === 'duplicate'
            ? 'Ya tienes una solicitud de piloto abierta.'
            : 'No pudimos registrar la solicitud. Intenta nuevamente o contáctanos por correo.',
        );
        setLoading(false);
        return;
      }

      // PII-safe: nunca objective/email.
      trackEvent('pilot_requested', { tier, source, segment, stage: stage || undefined, plan_interes: plan || undefined });

      // Notificación interna al equipo (Fase 3A). Best-effort: NO bloquea el éxito del
      // founder ni depende del ciclo de vida del modal (no toca estado). El id se obtiene
      // por la RPC segura porque el founder no tiene SELECT sobre `pilots`.
      void (async () => {
        try {
          const { data: st } = await supabase.rpc('get_my_pilot_status');
          const pilotId = (st as { id?: string } | null)?.id;
          if (!pilotId) { trackEvent('pilot_notify_failed', { source, failure_type: 'no_pilot_id' }); return; }
          const { data: res, error: nErr } = await supabase.functions.invoke('pilot-notify', { body: { pilot_id: pilotId } });
          if (nErr) trackEvent('pilot_notify_failed', { source, failure_type: 'invoke_error' });
          else trackEvent('pilot_notify_sent', { source, dry_run: Boolean((res as { dry_run?: boolean } | null)?.dry_run) });
        } catch {
          trackEvent('pilot_notify_failed', { source, failure_type: 'exception' });
        }
      })();

      toast.success('¡Solicitud de piloto enviada! El equipo Scouttech te contactará.');
      setLoading(false);
      onSubmitted();
      onClose();
    } catch {
      trackEvent('pilot_request_failed', { tier, source, segment, failure_type: 'insert_error' });
      toast.error('No pudimos registrar la solicitud. Intenta nuevamente o contáctanos por correo.');
      setLoading(false);
    }
  }, [segment, stage, objective, plan, source, tier, onSubmitted, onClose]);

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white dark:bg-[#12121A] rounded-3xl border border-[#0EB5C6]/30 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8] mb-1.5">Solicitar piloto</h3>
        <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-5 leading-relaxed">
          Contanos brevemente tu contexto. El equipo Scouttech revisa cada solicitud de forma manual.
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelCls} htmlFor="pilot-segment">Segmento *</label>
            <select id="pilot-segment" value={segment} onChange={(e) => setSegment(e.target.value)} className={selectCls}>
              <option value="" disabled>Selecciona…</option>
              {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="pilot-stage">Etapa</label>
            <select id="pilot-stage" value={stage} onChange={(e) => setStage(e.target.value)} className={selectCls}>
              <option value="">Sin especificar</option>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="pilot-objective">Objetivo del piloto</label>
            <textarea
              id="pilot-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value.slice(0, OBJECTIVE_MAX))}
              placeholder="¿Qué querés validar con Validus?"
              rows={3}
              className={`${selectCls} resize-none`}
            />
            <p className="text-[10px] text-gray-400 dark:text-[#afaebb] mt-1 text-right tabular-nums">
              {objective.length}/{OBJECTIVE_MAX}
            </p>
          </div>

          <div>
            <label className={labelCls} htmlFor="pilot-plan">Plan de interés</label>
            <select id="pilot-plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={selectCls}>
              <option value="">Sin especificar</option>
              {PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <button
            onClick={submit}
            disabled={loading || !segment}
            className="w-full py-3 bg-[#0EB5C6] hover:bg-[#6B5EE6] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Enviar solicitud →'}
          </button>
          <p className="text-[11px] text-center text-gray-400 dark:text-[#afaebb]">
            No compartimos tus datos. Solo el equipo Scouttech ve tu solicitud.
          </p>
        </div>
      </div>
    </div>
  );
}
