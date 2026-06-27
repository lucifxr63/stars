import { createContext, useContext, type ReactElement } from 'react';
import type { DashboardOrchestrator } from '@/hooks/useDashboardDataOrchestrator';
import type { BankAccount, Invoice, RecurringTransaction, Transaction } from '@/lib/queries';
import type { ActionBinding } from '@/config/dashboards/types';

// ════════════════════════════════════════════════════════════════════════════
// Contrato de Slot Kinds (Épica #52, Hito 1). El motor deja de asumir "número de
// solo lectura": un slot puede requerir colecciones vivas (list) o inyección de
// acciones (action-form).
// ════════════════════════════════════════════════════════════════════════════
// DISEÑO (aprobado): declaración EXPLÍCITA de claves en el JSON + resolución por
// registro TIPADO. El JSON declara `binding: "addInvoice"` (string, no función);
// el motor resuelve la clave contra el orquestador. Transporte implícito (el
// contexto lleva la instancia del orquestador), contrato explícito (el slot
// declara qué consume) → least-privilege: el widget recibe solo su acción.

export interface DashboardCollections {
  invoices: Invoice[];
  transactions: Transaction[];
  accounts: BankAccount[];
  recurring: RecurringTransaction[];
}

export interface DashboardSlotContextValue {
  orchestrator: DashboardOrchestrator;
  collections: DashboardCollections;
}

// Contexto = transporte de dependencias. Un proveedor (PR siguiente) lo monta con
// el orquestador + las colecciones del store. Ausente → slots no-métricos degradan
// a un placeholder claro (no rompen el Canvas).
const DashboardSlotContext = createContext<DashboardSlotContextValue | null>(null);
export const DashboardSlotProvider = DashboardSlotContext.Provider;
export function useDashboardSlot(): DashboardSlotContextValue | null {
  return useContext(DashboardSlotContext);
}

// Resolución TIPADA: clave declarada → función del orquestador. Si `binding` no es
// una acción válida, TypeScript lo rechaza en compilación.
export type OrchestratorAction = DashboardOrchestrator[ActionBinding];
export function resolveAction(orchestrator: DashboardOrchestrator, binding: ActionBinding): OrchestratorAction {
  return orchestrator[binding];
}

// ── Contratos de props por kind ─────────────────────────────────────────────
export interface ListWidgetProps {
  title: string;
  items: ReadonlyArray<{ id: string }>;
}
export interface ActionFormWidgetProps {
  title: string;
  /** Acción ya enlazada y resuelta desde el orquestador (least-privilege). */
  action: OrchestratorAction;
}

// ── Placeholders que DEMUESTRAN la inyección (componentes reales = backlog #52) ──
// El list muestra el conteo real de la colección inyectada; el action-form, que la
// acción llegó enlazada. Prueban que el contrato resuelve datos y funciones.
function SlotShell({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="h-full rounded-xl border border-dashed border-border bg-card/40 p-5">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

const ListWidgetPlaceholder = ({ title, items }: ListWidgetProps) => (
  <SlotShell title={title} hint={`Lista · ${items.length} elemento(s) inyectado(s) · componente real pendiente (#52)`} />
);
const ActionFormPlaceholder = ({ title, action }: ActionFormWidgetProps) => (
  <SlotShell title={title} hint={`Formulario · acción enlazada: ${action.name || 'fn'} · componente real pendiente (#52)`} />
);

// Registros por kind: widgetId → componente. Las claves anticipan los componentes
// del backlog (#52); hoy resuelven a placeholders tipados.
export const LIST_WIDGET_REGISTRY: Record<string, (p: ListWidgetProps) => ReactElement> = {
  invoicesList: ListWidgetPlaceholder,
  transactionsList: ListWidgetPlaceholder,
  accountsList: ListWidgetPlaceholder,
};

export const ACTION_WIDGET_REGISTRY: Record<string, (p: ActionFormWidgetProps) => ReactElement> = {
  invoiceForm: ActionFormPlaceholder,
  movementForm: ActionFormPlaceholder,
};
