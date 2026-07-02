// ── generationProgress ────────────────────────────────────────────────────────
// Helpers PUROS para leer validations.generation_progress (JSONB) sin tocar backend.
//
// Forma real del dato (escrito por generationService.ts y StepGenerating.tsx vía
// la RPC merge_generation_progress): Record<taskKey, 'success' | 'error'>.
// Una tarea sin clave = todavía no finalizó (pendiente). Durante la generación el
// objeto sólo contiene tareas ya resueltas; en estados terminales (completed /
// partial / failed) contiene todas las tareas intentadas.

export type GenerationProgress = Record<string, string>;
export type TaskStatus = 'success' | 'error' | 'pending';

// Etiquetas legibles de las claves REALES de tarea. No inventar secciones: si
// aparece una clave desconocida, se prettifica (snake_case → Título) como fallback.
const TASK_LABELS: Record<string, string> = {
  summary: 'Resumen ejecutivo',
  summary_quick: 'Resumen ejecutivo',
  market: 'Mercado',
  market_sizing: 'Mercado',
  competitors: 'Competencia',
  competitive_analysis: 'Competencia',
};

export function getGenerationTaskLabel(key: string): string {
  const known = TASK_LABELS[key];
  if (known) return known;
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export interface GenerationTask {
  key: string;
  label: string;
  status: TaskStatus;
}

export interface GenerationSummary {
  /** Tareas con un resultado registrado (success o error). Fiable en estados terminales. */
  total: number;
  completed: number;   // 'success'
  failed: number;      // 'error'
  pending: number;     // registradas sin resolver (normalmente 0: sólo se registran al resolver)
  tasks: GenerationTask[];
  failedLabels: string[];
  completedLabels: string[];
}

function toStatus(v: string): TaskStatus {
  if (v === 'success') return 'success';
  if (v === 'error') return 'error';
  return 'pending';
}

/** Resume el progreso: conteos + etiquetas legibles. Puro y null-safe. */
export function summarizeGenerationProgress(
  progress: GenerationProgress | null | undefined,
): GenerationSummary {
  const entries = Object.entries(progress ?? {});
  const tasks: GenerationTask[] = entries.map(([key, value]) => ({
    key,
    label: getGenerationTaskLabel(key),
    status: toStatus(String(value)),
  }));

  const completed = tasks.filter((t) => t.status === 'success');
  const failed = tasks.filter((t) => t.status === 'error');
  const pending = tasks.filter((t) => t.status === 'pending');

  return {
    total: tasks.length,
    completed: completed.length,
    failed: failed.length,
    pending: pending.length,
    tasks,
    failedLabels: failed.map((t) => t.label),
    completedLabels: completed.map((t) => t.label),
  };
}

export type GenerationHealth = 'generating' | 'completed' | 'partial' | 'failed' | 'unknown';

/**
 * Salud general derivada del status persistido (fuente de verdad). El progreso se
 * usa sólo como refuerzo: si el status no es terminal pero el progreso ya registra
 * errores + éxitos, se sugiere 'partial'. Nunca invierte un status terminal.
 */
export function getGenerationHealth(
  status: string | null | undefined,
  progress?: GenerationProgress | null,
): GenerationHealth {
  switch (status) {
    case 'completed': return 'completed';
    case 'partial':   return 'partial';
    case 'failed':    return 'failed';
    case 'in_progress': {
      const s = summarizeGenerationProgress(progress);
      if (s.failed > 0 && s.completed > 0) return 'partial';
      return 'generating';
    }
    default: return 'unknown';
  }
}
