import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
interface DoneRow {
  id: string;
  idea_name: string | null;
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
      const { data: { user } } = await supabase.auth.getUser();
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
          .select('id, idea_name, status')
          .in('id', gone);
        const completed = (doneData ?? []).filter((r) => r.status === 'completed');
        if (completed.length > 0 && !cancelled) {
          setDone((prev) => {
            const ids = new Set(prev.map((p) => p.id));
            const fresh = completed.filter((c) => !ids.has(c.id));
            fresh.forEach((c) =>
              toast.success(`Tu validación de ${c.idea_name ?? 'tu startup'} está lista`),
            );
            return [...fresh.map((c) => ({ id: c.id, idea_name: c.idea_name })), ...prev];
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

  const visibleDone = done.filter((d) => !dismissed.has(d.id));
  if (active.length === 0 && visibleDone.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {active.map((row) => {
        const successCount = row.generation_progress
          ? Object.values(row.generation_progress).filter((v) => v === 'success').length
          : 0;
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
              {successCount > 0 && (
                <span className="text-xs font-bold text-[#0EB5C6] tabular-nums shrink-0">
                  {successCount} ✓
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

      {visibleDone.map((row) => (
        <div
          key={row.id}
          className="flex items-center gap-3 px-5 py-4 rounded-2xl border-2 border-emerald-300 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/10"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">
              ¡Listo! Tu validación de {row.idea_name ?? 'tu startup'} está completa
            </p>
            <Link
              to={`/results/${row.id}`}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Ver resultado →
            </Link>
          </div>
          <button
            onClick={() => setDismissed((p) => new Set(p).add(row.id))}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Descartar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
