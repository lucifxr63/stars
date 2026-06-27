import type { Transaction, Invoice, RecurringTransaction, Frequency } from '@/lib/queries';

// Motor de proyección de flujo de caja (CASHFLOW_PRD.md §1).
// Modelo de vencimientos ASIMÉTRICO:
//   · A/P vencida  → se mueve a HOY (peor escenario: quema inmediata).
//   · A/R vencida  → NO se proyecta; va al Resolution Center (acción manual).
//   · A/R y A/P futuras (PENDING) → se proyectan en su due_date.
// Solo PENDING entra a la proyección (PAID/CANCELLED se ignoran).

export type Granularity = 'day' | 'week' | 'month';

export interface ProjectionPoint {
  date: string;
  balance: number;
}

// Horizonte por vista. Default operativo: semanal a 12 semanas (90 días).
export const HORIZON_DAYS: Record<Granularity, number> = {
  day: 30,
  week: 90,
  month: 365,
};

const DAY_MS = 86_400_000;

function toDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function dayIndex(from: Date, to: Date): number {
  return Math.round((toMidnight(to).getTime() - toMidnight(from).getTime()) / DAY_MS);
}
function toMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Avanza una fecha según la frecuencia de la transacción recurrente. */
function advance(d: Date, freq: Frequency): Date {
  const x = new Date(d);
  if (freq === 'WEEKLY') x.setDate(x.getDate() + 7);
  else if (freq === 'MONTHLY') x.setMonth(x.getMonth() + 1);
  else if (freq === 'QUARTERLY') x.setMonth(x.getMonth() + 3);
  else x.setFullYear(x.getFullYear() + 1); // YEARLY
  return x;
}

/**
 * "Eventos fantasma": expande cada transacción recurrente (ingreso o gasto fijo)
 * en sus ocurrencias futuras dentro del horizonte. No persiste nada (PRD parte 3/6).
 */
export function phantomEvents(
  txs: RecurringTransaction[],
  today: Date,
  horizonDays: number,
): { idx: number; amount: number; type: 'IN' | 'OUT' }[] {
  const events: { idx: number; amount: number; type: 'IN' | 'OUT' }[] = [];
  const t0 = toMidnight(today);
  for (const tx of txs) {
    let d = toDate(tx.next_date);
    // Si next_date quedó en el pasado, rodar hacia adelante a la próxima ocurrencia.
    let guard = 0;
    while (d < t0 && guard++ < 1000) d = advance(d, tx.frequency as Frequency);
    while (true) {
      const idx = dayIndex(today, d);
      if (idx > horizonDays) break;
      if (idx >= 0) events.push({ idx, amount: Number(tx.amount), type: tx.type as 'IN' | 'OUT' });
      d = advance(d, tx.frequency as Frequency);
    }
  }
  return events;
}

/**
 * Serie diaria de "Saldo Disponible Real" desde hoy hasta hoy+horizonDays.
 * Reserva de impuestos: si taxRate>0, cada ingreso proyectado (A/R o IN) entra
 * neto del impuesto (amount*(1-taxRate/100)); el % reservado queda fuera del
 * disponible (ver restrictedTax para el monto retenido).
 */
export function buildDailyProjection(
  currentCash: number,
  invoices: Invoice[],
  today: Date,
  horizonDays: number,
  recurringTxs: RecurringTransaction[] = [],
  taxRate = 0,
): ProjectionPoint[] {
  const deltas = new Array<number>(horizonDays + 1).fill(0);
  const inFactor = 1 - Math.max(0, Math.min(100, taxRate)) / 100;

  for (const inv of invoices) {
    if (inv.status !== 'PENDING') continue;
    const idx = dayIndex(today, toDate(inv.due_date));
    const amt = Number(inv.total_amount);

    if (inv.type === 'AP') {
      if (idx < 0) deltas[0] -= amt; // A/P vencida → hoy
      else if (idx <= horizonDays) deltas[idx] -= amt;
    } else {
      if (idx < 0) continue; // A/R vencida → Resolution Center (no proyecta)
      if (idx <= horizonDays) deltas[idx] += amt * inFactor; // ingreso neto de impuesto
    }
  }

  // Recurrentes: IN suma (neto de impuesto), OUT resta (Run Rate + Burn Rate).
  for (const ev of phantomEvents(recurringTxs, today, horizonDays)) {
    deltas[ev.idx] += ev.type === 'IN' ? ev.amount * inFactor : -ev.amount;
  }

  const points: ProjectionPoint[] = [];
  let bal = currentCash;
  for (let i = 0; i <= horizonDays; i++) {
    bal += deltas[i];
    points.push({ date: isoDate(addDays(today, i)), balance: Math.round(bal) });
  }
  return points;
}

/**
 * Caja Restringida (Impuestos): total reservado sobre los ingresos proyectados
 * (A/R futuras pendientes + IN recurrentes) dentro del horizonte. Estimación
 * bruta (no descuenta crédito fiscal de compras).
 */
export function restrictedTax(
  invoices: Invoice[],
  recurringTxs: RecurringTransaction[],
  today: Date,
  horizonDays: number,
  taxRate: number,
): number {
  const r = Math.max(0, Math.min(100, taxRate)) / 100;
  if (r <= 0) return 0;
  let income = 0;
  for (const inv of invoices) {
    if (inv.status !== 'PENDING' || inv.type !== 'AR') continue;
    const idx = dayIndex(today, toDate(inv.due_date));
    if (idx >= 0 && idx <= horizonDays) income += Number(inv.total_amount);
  }
  for (const ev of phantomEvents(recurringTxs, today, horizonDays)) {
    if (ev.type === 'IN') income += ev.amount;
  }
  return Math.round(income * r);
}

/** Normaliza una recurrente a su equivalente mensual (magnitud, sin signo). */
export function monthlyEquivalent(ex: RecurringTransaction): number {
  const a = Number(ex.amount);
  switch (ex.frequency as Frequency) {
    case 'WEEKLY': return (a * 52) / 12;
    case 'MONTHLY': return a;
    case 'QUARTERLY': return a / 3;
    case 'YEARLY': return a / 12;
    default: return 0;
  }
}

/** Agrega la serie diaria a la granularidad pedida (saldo al cierre del bucket). */
export function aggregate(points: ProjectionPoint[], g: Granularity): ProjectionPoint[] {
  if (g === 'day' || points.length === 0) return points;
  const out: ProjectionPoint[] = [];

  if (g === 'week') {
    for (let i = 0; i < points.length; i += 7) {
      const bucket = points.slice(i, i + 7);
      out.push(bucket[bucket.length - 1]);
    }
    return out;
  }

  // month: último punto de cada mes calendario.
  let curMonth = points[0].date.slice(0, 7);
  let last = points[0];
  for (const p of points) {
    const m = p.date.slice(0, 7);
    if (m !== curMonth) {
      out.push(last);
      curMonth = m;
    }
    last = p;
  }
  out.push(last);
  return out;
}

export interface Kpis {
  currentCash: number;
  monthlyNet: number; // IN - OUT por mes (trailing 90d). +/-
  monthlyBurn: number; // quema neta mensual (>0); 0 si cash-positive
  runwayMonths: number | null; // null = infinito (no quema)
  lowestBalance: number; // mínimo de la proyección
  lowestDate: string | null;
}

/**
 * Runway + Burn Rate. Combina el neto histórico (transacciones trailing 90d)
 * con los gastos recurrentes normalizados a mensual (Burn Rate Autopilot):
 * así el runway es realista incluso sin historial de transacciones.
 */
export function computeKpis(
  currentCash: number,
  transactions: Transaction[],
  projection: ProjectionPoint[],
  today: Date,
  recurringTxs: RecurringTransaction[] = [],
  taxRate = 0,
): Kpis {
  const inFactor = 1 - Math.max(0, Math.min(100, taxRate)) / 100;
  const since = addDays(today, -90);
  let inSum = 0;
  let outSum = 0;
  for (const t of transactions) {
    const d = toDate(t.transaction_date);
    if (d < since || d > today) continue;
    if (t.type === 'IN') inSum += Number(t.amount);
    else outSum += Number(t.amount);
  }
  // Neto recurrente mensual: ingresos fijos (netos de impuesto) − gastos fijos.
  const recurringNet = recurringTxs.reduce(
    (s, ex) => s + (ex.type === 'IN' ? monthlyEquivalent(ex) * inFactor : -monthlyEquivalent(ex)),
    0,
  );
  const monthlyNet = (inSum * inFactor - outSum) / 3 + recurringNet; // ingresos netos de impuesto
  const monthlyBurn = monthlyNet < 0 ? -monthlyNet : 0;
  const runwayMonths = monthlyBurn > 0 ? currentCash / monthlyBurn : null;

  let lowestBalance = currentCash;
  let lowestDate: string | null = null;
  for (const p of projection) {
    if (p.balance < lowestBalance) {
      lowestBalance = p.balance;
      lowestDate = p.date;
    }
  }
  return { currentCash, monthlyNet, monthlyBurn, runwayMonths, lowestBalance, lowestDate };
}

/** A/R vencidas y pendientes → Resolution Center. */
export function overdueReceivables(invoices: Invoice[], today: Date): Invoice[] {
  const t = toMidnight(today);
  return invoices.filter(
    (i) => i.type === 'AR' && i.status === 'PENDING' && toDate(i.due_date) < t,
  );
}
