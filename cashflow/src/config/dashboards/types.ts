import type { WorkspaceModel } from '@/store/useWorkspaceStore';

// Contrato de los esquemas JSON config-driven. La disposición visual del
// dashboard se dicta por datos, no por JSX monolítico (ver §2.4 del brief).

/** Identificador de widget. Debe existir como clave en el WIDGET_REGISTRY. */
export type WidgetId = string;

export interface WidgetSlot {
  /** Componente a instanciar; resuelto contra el registro de widgets. */
  widgetId: WidgetId;
  /** Título mostrado en la cabecera del widget. */
  title: string;
  /** Columnas que ocupa en la grilla de 12 (1–12). */
  span: 4 | 6 | 8 | 12;
}

export interface DashboardLayout {
  /** Modelo al que pertenece este layout (debe casar con el archivo). */
  model: WorkspaceModel;
  title: string;
  subtitle: string;
  grid: {
    /** Número de columnas base de la grilla (fijado a 12 en el MVP). */
    columns: 12;
  };
  widgets: WidgetSlot[];
}
