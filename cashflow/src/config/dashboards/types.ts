import type { WorkspaceModel } from '@/store/useWorkspaceStore';

// Contrato de los esquemas JSON config-driven. La disposición visual del
// dashboard se dicta por datos, no por JSX monolítico (ver §2.4 del brief).

/** Identificador de widget. Debe existir como clave en el registro de su kind. */
export type WidgetId = string;

// Tipo de slot. El motor ya no asume "número de solo lectura": un slot puede ser
// una métrica, una lista de control, o un formulario que requiere inyección de
// acciones del orquestador.
export type WidgetKind = 'metric' | 'list' | 'action-form';

// Capacidades que un slot 'action-form' puede DECLARAR consumir. Claves (strings),
// no funciones: el motor las resuelve contra el orquestador vía un mapa tipado
// (least-privilege: el widget recibe solo la acción que declara).
export type ActionBinding =
  | 'addInvoice'
  | 'resolveInvoice'
  | 'removeInvoice'
  | 'addTransaction'
  | 'removeTransaction';

// Colección viva que un slot 'list' puede declarar consumir.
export type CollectionBinding = 'invoices' | 'transactions' | 'accounts' | 'recurring';

export interface WidgetSlot {
  /** Componente a instanciar; resuelto contra el registro de su kind. */
  widgetId: WidgetId;
  /** Título mostrado en la cabecera del widget. */
  title: string;
  /** Columnas que ocupa en la grilla de 12 (1–12). */
  span: 4 | 6 | 8 | 12;
  /** Tipo de slot. Ausente = 'metric' (retrocompat con layouts existentes). */
  kind?: WidgetKind;
  /** Solo 'action-form': clave de la acción del orquestador a inyectar. */
  binding?: ActionBinding;
  /** Solo 'list': colección viva a inyectar. */
  collection?: CollectionBinding;
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
