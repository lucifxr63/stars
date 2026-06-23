import { useCallback, useEffect, useState } from 'react';
import {
  getDefaultTenant,
  updateTenantSettings,
  listAccounts,
  updateAccount,
  deleteAccount,
  listTransactions,
  listInvoices,
  listRecurringTransactions,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  createAccount,
  createTransaction,
  deleteTransaction,
  createRecurringTransaction,
  deleteRecurringTransaction,
  uploadAndParsePdf,
  getPdfUsage,
  PDF_MONTHLY_LIMIT,
  type Tenant,
  type BankAccount,
  type Transaction,
  type Invoice,
  type RecurringTransaction,
  type InvoiceType,
  type TxType,
  type Frequency,
  type SourceSystem,
  type ParsedInvoice,
} from '@/lib/queries';
import { useAuth } from '@/store/auth';

export function useCashflow() {
  const userId = useAuth((s) => s.user?.id ?? null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [pdfUsed, setPdfUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, accs, txs, invs, recs, usage] = await Promise.all([
        getDefaultTenant(),
        listAccounts(),
        listTransactions(),
        listInvoices(),
        listRecurringTransactions(),
        getPdfUsage(),
      ]);
      setTenant(t);
      setAccounts(accs);
      setTransactions(txs);
      setInvoices(invs);
      setRecurringTransactions(recs);
      setPdfUsed(usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) void refresh();
  }, [userId, refresh]);

  // Caja actual = suma de saldos de las cuentas bancarias.
  const currentCash = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

  const addAccount = useCallback(
    async (name: string, openingBalance: number, currency = 'CLP') => {
      if (!userId || !tenant) throw new Error('Sin tenant');
      await createAccount({
        tenant_id: tenant.id,
        owner_id: userId,
        name,
        currency,
        current_balance: openingBalance,
      });
      await refresh();
    },
    [userId, tenant, refresh],
  );

  const editAccount = useCallback(
    async (id: string, patch: { name?: string; currency?: string; current_balance?: number }) => {
      await updateAccount(id, patch);
      await refresh();
    },
    [refresh],
  );

  const removeAccount = useCallback(
    async (id: string) => {
      await deleteAccount(id);
      await refresh();
    },
    [refresh],
  );

  const addTransaction = useCallback(
    async (input: { account_id: string; amount: number; type: TxType; category?: string | null; transaction_date?: string }) => {
      if (!userId) throw new Error('Sin sesión');
      await createTransaction({ ...input, owner_id: userId });
      await refresh();
    },
    [userId, refresh],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      await deleteTransaction(id);
      await refresh();
    },
    [refresh],
  );

  const addInvoice = useCallback(
    async (input: {
      type: InvoiceType;
      total_amount: number;
      issue_date: string;
      due_date: string;
      contact_name?: string | null;
      source_system?: SourceSystem;
    }) => {
      if (!tenant) throw new Error('Sin tenant');
      await createInvoice({ ...input, tenant_id: tenant.id });
      await refresh();
    },
    [tenant, refresh],
  );

  const parsePdf = useCallback(
    async (file: File): Promise<ParsedInvoice> => {
      if (!userId || !tenant) throw new Error('Sin sesión');
      const result = await uploadAndParsePdf(userId, tenant.id, file);
      setPdfUsed((n) => n + 1); // optimista; refresh lo reconcilia al guardar
      return result;
    },
    [userId, tenant],
  );

  const resolveInvoice = useCallback(
    async (id: string, patch: { status?: 'PAID' | 'CANCELLED'; due_date?: string }) => {
      await updateInvoice(id, patch);
      await refresh();
    },
    [refresh],
  );

  const removeInvoice = useCallback(
    async (id: string) => {
      await deleteInvoice(id);
      await refresh();
    },
    [refresh],
  );

  const addRecurringTransaction = useCallback(
    async (input: { type: TxType; name: string; amount: number; frequency: Frequency; next_date: string }) => {
      if (!tenant) throw new Error('Sin tenant');
      await createRecurringTransaction({ ...input, tenant_id: tenant.id });
      await refresh();
    },
    [tenant, refresh],
  );

  const removeRecurringTransaction = useCallback(
    async (id: string) => {
      await deleteRecurringTransaction(id);
      await refresh();
    },
    [refresh],
  );

  const updateSettings = useCallback(
    async (default_tax_rate: number, weekly_alerts_enabled: boolean) => {
      if (!tenant) throw new Error('Sin tenant');
      await updateTenantSettings({ tenant_id: tenant.id, default_tax_rate, weekly_alerts_enabled });
      await refresh();
    },
    [tenant, refresh],
  );

  return {
    tenant,
    accounts,
    transactions,
    invoices,
    recurringTransactions,
    currentCash,
    pdfUsed,
    pdfLimit: PDF_MONTHLY_LIMIT,
    loading,
    error,
    refresh,
    addAccount,
    editAccount,
    removeAccount,
    addTransaction,
    removeTransaction,
    addInvoice,
    resolveInvoice,
    removeInvoice,
    addRecurringTransaction,
    removeRecurringTransaction,
    updateSettings,
    parsePdf,
  };
}
