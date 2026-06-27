import { useCallback, useEffect, useState } from 'react';
import {
  listPartnerContributions,
  createPartnerContribution,
  deletePartnerContribution,
  listExpenses,
  createExpense,
  deleteExpense,
  listRevenues,
  createRevenue,
  deleteRevenue,
} from '@/lib/cashflow-extra';
import type {
  PartnerContribution,
  Expense,
  Revenue,
  PartnerContributionInsert,
  ExpenseInsert,
  RevenueInsert,
} from '@/lib/cashflow-extra';
import { useAuth } from '@/store/auth';

// DRAFT (Opción B). Carga y alta de las 3 entidades nuevas. Mantiene tenant_id +
// owner_id (los inyecta en cada INSERT, como exige la RLS). Espejo de useCashflow.
//
// Los inputs de los formularios omiten tenant_id/owner_id: el hook los completa.
type ContributionForm = Omit<PartnerContributionInsert, 'tenant_id' | 'owner_id'>;
type ExpenseForm = Omit<ExpenseInsert, 'tenant_id' | 'owner_id'>;
type RevenueForm = Omit<RevenueInsert, 'tenant_id' | 'owner_id'>;

export function useCashflowExtra(tenantId: string | null) {
  const userId = useAuth((s) => s.user?.id ?? null);
  const [contributions, setContributions] = useState<PartnerContribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, e, r] = await Promise.all([listPartnerContributions(), listExpenses(), listRevenues()]);
      setContributions(c);
      setExpenses(e);
      setRevenues(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) void refresh();
  }, [userId, refresh]);

  const requireCtx = () => {
    if (!userId || !tenantId) throw new Error('Sin tenant/sesión');
    return { tenant_id: tenantId, owner_id: userId };
  };

  const addContribution = useCallback(
    async (input: ContributionForm) => {
      await createPartnerContribution({ ...input, ...requireCtx() });
      await refresh();
    },
    [userId, tenantId, refresh],
  );

  const addExpense = useCallback(
    async (input: ExpenseForm) => {
      await createExpense({ ...input, ...requireCtx() });
      await refresh();
    },
    [userId, tenantId, refresh],
  );

  const addRevenue = useCallback(
    async (input: RevenueForm) => {
      await createRevenue({ ...input, ...requireCtx() });
      await refresh();
    },
    [userId, tenantId, refresh],
  );

  const removeContribution = useCallback(async (id: string) => { await deletePartnerContribution(id); await refresh(); }, [refresh]);
  const removeExpense = useCallback(async (id: string) => { await deleteExpense(id); await refresh(); }, [refresh]);
  const removeRevenue = useCallback(async (id: string) => { await deleteRevenue(id); await refresh(); }, [refresh]);

  return {
    contributions, expenses, revenues, loading, error, refresh,
    addContribution, addExpense, addRevenue,
    removeContribution, removeExpense, removeRevenue,
  };
}
