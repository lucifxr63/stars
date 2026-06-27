import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

// Capa de data-access tipada sobre el modelo PRD de cashflow.*.
// RLS filtra por owner_id = auth.uid(); en INSERT inyectamos owner_id (lo exige
// el WITH CHECK). Las facturas se crean vía la Edge Function (contrato estricto).

type Tables = Database['cashflow']['Tables'];

export type Tenant = Tables['tenant']['Row'];
export type BankAccount = Tables['bank_account']['Row'];
export type Transaction = Tables['transaction']['Row'];
export type Invoice = Tables['invoice']['Row'];
export type RecurringTransaction = Tables['recurring_transaction']['Row'];

export type TxType = 'IN' | 'OUT';
export type InvoiceType = 'AR' | 'AP';
export type InvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type SourceSystem = 'MANUAL' | 'PDF_AI';
export type Frequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

// Resultado de la extracción IA de un PDF (Human-in-the-Loop: pre-llena el form).
// Escudo anti-basura: is_valid_invoice=false bloquea cotizaciones/presupuestos.
export interface ParsedInvoice {
  is_valid_invoice: boolean;
  rejection_reason: string | null;
  extracted_fields: {
    type: InvoiceType | null;
    contact_name: string | null;
    total_amount: number | null;
    currency: string | null;
    issue_date: string | null;
    due_date: string | null;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings: string[];
}

// ── Tenant ──────────────────────────────────────────────────
export async function getDefaultTenant(): Promise<Tenant | null> {
  // RLS limita a los tenants del usuario; tomamos el más antiguo como default.
  const { data, error } = await supabase
    .from('tenant')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Settings del tenant (impuestos + alertas) vía Edge Function (contrato Fase 2).
export async function updateTenantSettings(input: {
  tenant_id: string;
  default_tax_rate: number;
  weekly_alerts_enabled: boolean;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('cashflow-tenant-settings', { body: input, method: 'PATCH' });
  if (error) {
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
}

// ── Bank accounts ───────────────────────────────────────────
export async function listAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase.from('bank_account').select('*').order('created_at');
  if (error) throw error;
  return data;
}

export async function createAccount(input: {
  tenant_id: string;
  owner_id: string;
  name: string;
  currency?: string;
  current_balance?: number;
}): Promise<BankAccount> {
  const { data, error } = await supabase.from('bank_account').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateAccount(
  id: string,
  patch: Partial<Pick<BankAccount, 'name' | 'currency' | 'current_balance'>>,
): Promise<void> {
  const { error } = await supabase.from('bank_account').update(patch).eq('id', id);
  if (error) throw error;
}

// ON DELETE CASCADE elimina también las transacciones de la cuenta.
export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('bank_account').delete().eq('id', id);
  if (error) throw error;
}

// ── Transactions ────────────────────────────────────────────
export async function listTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transaction')
    .select('*')
    .order('transaction_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTransaction(input: {
  account_id: string;
  owner_id: string;
  amount: number;
  type: TxType;
  category?: string | null;
  transaction_date?: string;
}): Promise<Transaction> {
  const { data, error } = await supabase.from('transaction').insert(input).select().single();
  if (error) throw error;
  return data;
}

// El trigger de balance revierte el saldo de la cuenta al borrar.
export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transaction').delete().eq('id', id);
  if (error) throw error;
}

// ── Invoices ────────────────────────────────────────────────
export async function listInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoice')
    .select('*')
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data;
}

// Creación vía Edge Function (contrato del PRD). NO insertamos directo para
// respetar la validación central (source_system MANUAL en Fase 1).
export async function createInvoice(input: {
  tenant_id: string;
  type: InvoiceType;
  total_amount: number;
  currency?: string;
  issue_date: string;
  due_date: string;
  contact_name?: string | null;
  source_system?: SourceSystem;
}): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke('cashflow-invoices', {
    body: { source_system: 'MANUAL', external_id: null, ...input },
  });
  if (error) {
    // El cuerpo de error de la función trae error_code/message.
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
  return data.data;
}

// Acciones sobre facturas: marcar pagada/cancelar (Resolution Center y lista general).
export async function updateInvoice(
  id: string,
  patch: Partial<Pick<Invoice, 'status' | 'due_date'>>,
): Promise<void> {
  const { error } = await supabase.from('invoice').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('invoice').delete().eq('id', id);
  if (error) throw error;
}

// ── Transacciones recurrentes (Run Rate + Burn Rate Autopilot) ──
export async function listRecurringTransactions(): Promise<RecurringTransaction[]> {
  const { data, error } = await supabase
    .from('recurring_transaction')
    .select('*')
    .order('next_date', { ascending: true });
  if (error) throw error;
  return data;
}

// Creación vía Edge Function (contrato del PRD parte 6: type IN/OUT).
export async function createRecurringTransaction(input: {
  tenant_id: string;
  type: TxType;
  name: string;
  amount: number;
  frequency: Frequency;
  next_date: string;
  currency?: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke('cashflow-recurring', { body: input });
  if (error) {
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
  return data.data;
}

export async function deleteRecurringTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_transaction').delete().eq('id', id);
  if (error) throw error;
}

// Cuota Beta de lecturas de PDF (10/mes). Lee el contador del mes en curso.
export const PDF_MONTHLY_LIMIT = 10;
export const MAX_PDF_BYTES = 2 * 1024 * 1024;

export async function getPdfUsage(): Promise<number> {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data, error } = await supabase
    .from('pdf_usage')
    .select('count')
    .eq('period', period)
    .maybeSingle();
  if (error) throw error;
  return data?.count ?? 0;
}

// ── Ingesta por PDF (IA) ────────────────────────────────────
// Sube el PDF al bucket privado bajo {uid}/{uuid}.pdf y lo manda a parsear.
// La función borra el archivo tras procesarlo. Devuelve los campos extraídos
// para PRE-LLENAR el formulario; el usuario revisa y guarda (Human-in-the-Loop).
export async function uploadAndParsePdf(ownerId: string, tenantId: string, file: File): Promise<ParsedInvoice> {
  const path = `${ownerId}/${crypto.randomUUID()}.pdf`;
  const { error: upErr } = await supabase.storage.from('cashflow_docs').upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase.functions.invoke('cashflow-parse-pdf', {
    body: { tenant_id: tenantId, file_path: path, expected_type: 'AR_OR_AP' },
  });
  if (error) {
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
  return data.data as ParsedInvoice;
}
