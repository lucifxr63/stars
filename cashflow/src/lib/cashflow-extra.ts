import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { CashflowAnalytics } from '@/types/cashflow';

// ============================================================
// DATA-ACCESS — Aportes / Gastos / Ingresos SaaS + analítica
// ============================================================
// Tipado contra el esquema vivo (database.types.ts). RLS filtra por
// owner_id = auth.uid(); en INSERT inyectamos owner_id (lo exige el WITH CHECK).
// ============================================================

type Tables = Database['cashflow']['Tables'];

export type PartnerContribution = Tables['partner_contributions']['Row'];
export type PartnerContributionInsert = Tables['partner_contributions']['Insert'];
export type Expense = Tables['expense']['Row'];
export type ExpenseInsert = Tables['expense']['Insert'];
export type Revenue = Tables['revenue']['Row'];
export type RevenueInsert = Tables['revenue']['Insert'];

// Desempaqueta el cuerpo de error de una Edge Function (error_code/message).
async function unwrapFnError(error: { message: string; context?: unknown }): Promise<never> {
  let msg = error.message;
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.message) msg = body.message;
    }
  } catch { /* noop */ }
  throw new Error(msg);
}

// ── Aportes de socios ───────────────────────────────────────
export async function listPartnerContributions(): Promise<PartnerContribution[]> {
  const { data, error } = await supabase.from('partner_contributions').select('*').order('record_date', { ascending: false });
  if (error) throw error;
  return data as PartnerContribution[];
}

export async function createPartnerContribution(input: PartnerContributionInsert): Promise<PartnerContribution> {
  const { data, error } = await supabase.from('partner_contributions').insert(input).select().single();
  if (error) throw error;
  return data as PartnerContribution;
}

export async function deletePartnerContribution(id: string): Promise<void> {
  const { error } = await supabase.from('partner_contributions').delete().eq('id', id);
  if (error) throw error;
}

// ── Gastos ──────────────────────────────────────────────────
export async function listExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from('expense').select('*').order('record_date', { ascending: false });
  if (error) throw error;
  return data as Expense[];
}

export async function createExpense(input: ExpenseInsert): Promise<Expense> {
  const { data, error } = await supabase.from('expense').insert(input).select().single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expense').delete().eq('id', id);
  if (error) throw error;
}

// ── Ingresos SaaS ───────────────────────────────────────────
export async function listRevenues(): Promise<Revenue[]> {
  const { data, error } = await supabase.from('revenue').select('*').order('record_date', { ascending: false });
  if (error) throw error;
  return data as Revenue[];
}

export async function createRevenue(input: RevenueInsert): Promise<Revenue> {
  const { data, error } = await supabase.from('revenue').insert(input).select().single();
  if (error) throw error;
  return data as Revenue;
}

export async function deleteRevenue(id: string): Promise<void> {
  const { error } = await supabase.from('revenue').delete().eq('id', id);
  if (error) throw error;
}

// ── Analítica mensual (Edge Function cashflow-analytics) ────
// GET con tenant_id + period (YYYY-MM). El parámetro tenant_id queda listo para
// inyección desde el hook useCashflowAnalytics.
export async function getCashflowAnalytics(tenantId: string, period: string): Promise<CashflowAnalytics> {
  const qs = new URLSearchParams({ tenant_id: tenantId, period }).toString();
  const { data, error } = await supabase.functions.invoke<CashflowAnalytics>(`cashflow-analytics?${qs}`, {
    method: 'GET',
  });
  if (error) await unwrapFnError(error as { message: string });
  if (!data) throw new Error('Respuesta vacía de cashflow-analytics');
  return data;
}
