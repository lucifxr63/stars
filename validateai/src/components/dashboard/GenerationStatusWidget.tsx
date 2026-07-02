import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { summarizeGenerationProgress, type GenerationProgress } from '@/lib/generationProgress';

// ── GenerationStatusWidget ────────────────────────────────────────────────────
// El indicador "inconfundible" de que una validación se está procesando tras el
// redirect del wizard al Dashboard (req #3, KPI anchor anti-churn).
//
// Observa por polling las validaciones del usuario en status='in_progress' y
// current_step=4 (la firma de un job de generación, vs un borrador del wizard).
// Cuando una desaparece de ese set y queda 'completed', muestra el aviso "listo".

const POLL_MS = 4000;

interface ActiveRow {
  id: string;
  idea_name: string | null;
  generation_progress: Record<string, string> | null;
}
type TerminalStatus = 'completed' | 'partial' | 'failed';
interface DoneRow {
  id: string;
  idea_name: string | null;
  status: TerminalStatus;
  failedCount: number;
  progress: GenerationProgress | null;
}

export function GenerationStatusWidget() {
  const [active, setActive] = useState<ActiveRow[]>([]);
  const [done, setDone] = useState<DoneRow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || cancelled) return;

      const { data } = await supabase
        .from('validations')
        .select('id, idea_name, status, generation_progress')
        .eq('user_id', user.id)
        .eq('current_step', 4)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false });
      if (cancelled) return;

      const rows = (data ?? []) as Array<ActiveRow & { status: string }>;
      const activeRows: ActiveRow[] = rows.map((r) => ({
        id: r.id,
        idea_name: r.idea_name,
        generation_progress: r.generation_progress,
      }));
      const currentIds = new Set(activeRows.map((r) => r.id));

      // Transición in_progress → completed: lo que vimos antes y ya no está activo.
      const gone = [...seen.current].filter((id) => !currentIds.has(id));
      if (gone.length > 0) {
        const { data: doneData } = await supabase
          .from('validations')
          .select('id, idea_name, status, generation_progress')
          .in('id', gone);
        // Fase 15 (11B): estados terminales honestos — completed / partial / failed.
        const TERMINAL: TerminalStatus[] = ['completed', 'partial', 'failed'];
        const finished = (doneData ?? []).filter((r) => TERMINAL.includes(r.status as TerminalStatus));
        if (finished.length > 0 && !cancelled) {
          setDone((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const fresh = finished.filter((c) => !ids.has(c.id));
            const toRow = (c: typeof fresh[number]): DoneRow => {
              const prog = (c.generation_progress ?? {}) as GenerationProgress;
              const failedCount = Object.values(prog).filter((v) => v === 'error').length;
              return { id: c.id, idea_name: c.idea_name, status: c.status as TerminalStatus, failedCount, progress: prog };
            };
            fresh.map(toRow).forEach((row) => {
              const name = row.idea_name ?? 'tu startup';
              if (row.status === 'completed') toast.success(`Tu validación de ${name} está lista`);
              else if (row.status === 'partial') toast.warning(`Validación de ${name} lista — ${row.failedCount} ${row.failedCount === 1 ? 'sección no se generó' : 'secciones no se generaron'}`);
              else toast.error(`No pudimos generar la validación de ${name}`);
            });
            return [...fresh.map(toRow), ...prev];
          });
        }
        gone.forEach((id) => seen.current.delete(id));
      }

      activeRows.forEach((r) => seen.current.add(r.id));
      setActive(activeRows);

      if (!cancelled && activeRows.length > 0) {
        timer = setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  // Analítica PII-safe: se registra una vez que el widget tiene contenido visible.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    const firstDone = done.find((d) => !dismissed.has(d.id));
    if (firstDone) {
      viewedRef.current = true;
      const s = summarizeGenerationProgress(firstDone.progress);
      trackEvent('generation_status_viewed', {
        status: firstDone.status, sections_completed: s.completed, sections_failed: s.failed, source: 'generation_widget',
      });
    } else if (active.length > 0) {
      viewedRef.current = true;
      trackEvent('generation_status_viewed', {
        status: 'generating', sections_completed: 0, sections_failed: 0, source: 'generation_widget',
      });
    }
  }, [active, done, dismissed]);

  const visibleDone = done.filter((d) => !dismissed.has(d.id));
  if (active.length === 0 && visibleDone.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {active.map((row) => {
        // Durante la generación, generation_progress sólo contiene tareas ya
        // resueltas; mostramos listas / con error, sin un total (aún desconocido).
        const s = summarizeGenerationProgress(row.generation_progress);
        return (
          <div
            key={row.id}
            className="rounded-2xl border-2 border-[#0EB5C6]/30 bg-[#0EB5C6]/[0.06] overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <Loader2 className="w-5 h-5 text-[#0EB5C6] animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">
                  Validus AI está procesando {row.idea_name ?? 'tu startup'}…
                </p>
                <p className="text-xs text-[#0EB5C6] dark:text-[#38D5E3] mt-0.5">
                  Generando tu validación. Puedes seguir explorando — te avisamos al terminar.
                </p>
              </div>
              {(s.completed > 0 || s.failed > 0) && (
                <span className="text-xs font-bold tabular-nums shrink-0 flex items-center gap-1.5">
                  {s.completed > 0 && <span className="text-[#0EB5C6]">{s.completed} listas</span>}
                  {s.failed > 0 && <span className="text-amber-600 dark:text-amber-400">{s.failed} con error</span>}
                </span>
              )}
            </div>
            {/* Barra indeterminada — señal de actividad inconfundible */}
            <div className="h-1 bg-[#0EB5C6]/10 overflow-hidden">
              <div className="h-full w-1/2 bg-[#0EB5C6] animate-pulse" />
            </div>
          </div>
        );
      })}

      {visibleDone.map((row) => {
        const name = row.idea_name ?? 'tu startup';
        const s = summarizeGenerationProgress(row.progress);
        // Fase 15 (11B): estilo y copy honestos por estado terminal. Punto 4:
        // conteos "X de Y" + secciones fallidas legibles, sin ocultar fallos.
        const cfg = row.status === 'completed'
          ? {
              box: 'border-emerald-300 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/10',
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />, link: 'text-emerald-600 dark:text-emerald-400',
              title: `¡Listo! Tu validación de ${name} está completa`,
              detail: s.total > 0 ? `${s.total} ${s.total === 1 ? 'sección generada' : 'secciones generadas'}.` : null,
            }
          : row.status === 'partial'
          ? {
              box: 'border-amber-300 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10',
              icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />, link: 'text-amber-600 dark:text-amber-400',
              title: s.total > 0
                ? `Validación de ${name} lista — ${s.completed} de ${s.total} secciones`
                : `Validación de ${name} lista — algunas secciones no se generaron`,
              detail: s.failedLabels.length > 0
                ? `No se generó: ${s.failedLabels.join(', ')}. Puedes revisar el resultado parcial.`
                : 'Tu análisis está disponible, pero algunas secciones no pudieron completarse.',
            }
          : {
              box: 'border-red-300 dark:border-red-700/40 bg-red-50 dark:bg-red-900/10',
              icon: <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />, link: 'text-red-600 dark:text-red-400',
              title: `No pudimos generar la validación de ${name}`,
              detail: 'Suele ser un problema temporal. Puedes reintentar o crear una nueva.',
            };
        return (
          <div key={row.id} className={`flex items-start gap-3 px-5 py-4 rounded-2xl border-2 ${cfg.box}`}>
            <span className="mt-0.5">{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">{cfg.title}</p>
              {cfg.detail && (
                <p className="text-xs text-gray-600 dark:text-[#C4C4D4] mt-0.5 mb-1">{cfg.detail}</p>
              )}
              {row.status === 'failed' ? (
                <Link
                  to="/validate"
                  onClick={() => trackEvent('generation_retry_clicked', { status: 'failed', sections_completed: s.completed, sections_failed: s.failed, source: 'generation_widget' })}
                  className={`text-xs font-bold hover:underline ${cfg.link}`}
                >
                  Reintentar →
                </Link>
              ) : row.status === 'partial' ? (
                <Link
                  to={`/results/${row.id}`}
                  onClick={() => trackEvent('generation_partial_review_clicked', { status: 'partial', sections_completed: s.completed, sections_failed: s.failed, source: 'generation_widget' })}
                  className={`text-xs font-bold hover:underline ${cfg.link}`}
                >
                  Ver resultado parcial →
                </Link>
              ) : (
                <Link to={`/results/${row.id}`} className={`text-xs font-bold hover:underline ${cfg.link}`}>
                  Ver resultado →
                </Link>
              )}
            </div>
            <button
              onClick={() => setDismissed((p) => new Set(p).add(row.id))}
              className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Descartar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
