import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Options {
  filters?: Record<string, string>;
  order?:   { column: string; ascending?: boolean };
  pageSize?: number;
  enabled?: boolean;
}

export function usePaginatedQuery<T>(
  table: string,
  select: string,
  options: Options = {},
) {
  const { filters = {}, order, pageSize = 20, enabled = true } = options;
  const [page, setPage]       = useState(0);
  const [data, setData]       = useState<T[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);

  const filtersKey = JSON.stringify(filters);
  const orderKey   = JSON.stringify(order);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(table).select(select, { count: 'exact' });

    Object.entries(filters).forEach(([col, val]) => {
      if (val.trim()) q = q.ilike(col, `%${val}%`);
    });

    if (order) q = q.order(order.column, { ascending: order.ascending ?? false });

    q = q.range(page * pageSize, (page + 1) * pageSize - 1);

    const { data: rows, count } = await q;
    setData((rows ?? []) as T[]);
    setTotal(count ?? 0);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, page, pageSize, filtersKey, orderKey, enabled]);

  useEffect(() => {
    setPage(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return {
    data,
    total,
    loading,
    page,
    pages: Math.ceil(total / pageSize),
    setPage,
    refetch: fetch,
  };
}
