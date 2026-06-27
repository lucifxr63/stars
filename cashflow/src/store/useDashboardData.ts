import { create } from 'zustand';
import type { BankAccount, Invoice, Transaction, RecurringTransaction } from '@/lib/queries';

// ════════════════════════════════════════════════════════════════════════════
// SPIKE — Capa de datos del DashboardCanvas (Épica #52, Hito 1). DATA-LAYER ONLY.
// ════════════════════════════════════════════════════════════════════════════
// NETWORK-AGNOSTIC por diseño: el store solo modela ESTADO + transiciones PURAS +
// selectores DERIVADOS. La orquestación async (fetch/mutación vía supabase) NO
// vive aquí: un hook a nivel de ruta hidratará este store y traducirá las
// mutaciones de red (ej. `addInvoice` = await createInvoice(...) → `upsertInvoice`).
//
// Por qué Zustand y no Context (decisión oficializada, Épica #52):
//  • Las acciones son referencias ESTABLES → seleccionarlas NO re-renderiza.
//  • Selectores granulares → cada widget se suscribe solo a su slice. El estado
//    transversal del What-If (`ignoredEvents`) se comparte sin render storms.
//
// ⚠️ Este spike NO se conecta a la UI. Es para auditar la topología pura del store.

export interface DashboardCollections {
  accounts: BankAccount[];
  invoices: Invoice[];
  transactions: Transaction[];
  recurring: RecurringTransaction[];
}

export interface DashboardDataState extends DashboardCollections {
  tenantId: string | null;
  /** IDs de eventos ocultos por el simulador What-If (estado transversal). */
  ignoredEvents: Set<string>;
  /** true tras la primera hidratación desde el orquestador de ruta. */
  hydrated: boolean;

  // ── Acciones estables (referencias fijas; seleccionarlas no re-renderiza) ──
  setTenant: (tenantId: string | null) => void;
  /** Hidrata colecciones en bloque. Lo invoca el orquestador de ruta (capa de red). */
  hydrate: (data: Partial<DashboardCollections>) => void;
  upsertInvoice: (invoice: Invoice) => void;
  removeInvoice: (id: string) => void;
  upsertTransaction: (tx: Transaction) => void;
  removeTransaction: (id: string) => void;
  /** Alterna un evento (factura/recurrente) en la simulación What-If. */
  toggleSimulation: (eventId: string) => void;
  resetSimulation: () => void;
  reset: () => void;
}

/** Inserta o reemplaza por id, preservando inmutabilidad (nueva referencia de array). */
function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...list];
  const copy = list.slice();
  copy[idx] = item;
  return copy;
}

const EMPTY: DashboardCollections = { accounts: [], invoices: [], transactions: [], recurring: [] };

export const useDashboardData = create<DashboardDataState>((set) => ({
  tenantId: null,
  ...EMPTY,
  ignoredEvents: new Set<string>(),
  hydrated: false,

  setTenant: (tenantId) => set({ tenantId }),

  hydrate: (data) =>
    set((s) => ({
      accounts: data.accounts ?? s.accounts,
      invoices: data.invoices ?? s.invoices,
      transactions: data.transactions ?? s.transactions,
      recurring: data.recurring ?? s.recurring,
      hydrated: true,
    })),

  upsertInvoice: (invoice) => set((s) => ({ invoices: upsertById(s.invoices, invoice) })),
  removeInvoice: (id) => set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) })),
  upsertTransaction: (tx) => set((s) => ({ transactions: upsertById(s.transactions, tx) })),
  removeTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

  toggleSimulation: (eventId) =>
    set((s) => {
      const next = new Set(s.ignoredEvents);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return { ignoredEvents: next };
    }),
  resetSimulation: () => set({ ignoredEvents: new Set<string>() }),

  reset: () => set({ tenantId: null, ...EMPTY, ignoredEvents: new Set<string>(), hydrated: false }),
}));

// ── Selectores derivados ────────────────────────────────────────────────────
// Suscripción granular: cada widget consume solo el selector que necesita.
// Espejan la lógica del /dashboard heredado (visInvoices/visRecurring/currentCash/simActive)
// para garantizar paridad cuando se porten los widgets en el Hito 1.

export const selectCurrentCash = (s: DashboardDataState): number =>
  s.accounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

/** Facturas visibles tras aplicar el simulador What-If. */
export const selectVisibleInvoices = (s: DashboardDataState): Invoice[] =>
  s.ignoredEvents.size === 0 ? s.invoices : s.invoices.filter((i) => !s.ignoredEvents.has(i.id));

/** Recurrentes visibles tras aplicar el simulador What-If. */
export const selectVisibleRecurring = (s: DashboardDataState): RecurringTransaction[] =>
  s.ignoredEvents.size === 0 ? s.recurring : s.recurring.filter((r) => !s.ignoredEvents.has(r.id));

export const selectSimulationActive = (s: DashboardDataState): boolean => s.ignoredEvents.size > 0;
