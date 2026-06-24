import { useCallback, useEffect, useState } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/report-error';

// Hook aislado que sirve la cifra fiscal del /dashboard heredado desde la RPC
// `cashflow.metrics_pyme` (fuente única de verdad, débito−crédito server-side).
//
// DOBLE ANILLO DE SEGURIDAD (Fase 1, Strangler-Fig):
//  • Anillo 1 — Kill-switch de operador: VITE_FISCAL_SOURCE=heuristic revierte al
//    cálculo heredado (rollback vía redeploy de Vercel, ~1–2 min). Default: rpc.
//  • Anillo 2 — Guard de UX: timeout agresivo (4s). Si la RPC se degrada en
//    latencia, el tile claudica a estado de error localizado — NUNCA swap silencioso
//    a heurística (evita el parpadeo de doble métrica).
//
// `not deployed` (PGRST202/…) sí cae a heurística: es ausencia binaria de la RPC
// (lag de despliegue / preview), no una degradación de rendimiento.

export type FiscalSource = 'rpc' | 'heuristic';

/** Lee el flag de build una vez. Cualquier valor != 'heuristic' → 'rpc' (default seguro). */
export const FISCAL_SOURCE: FiscalSource =
  (import.meta.env.VITE_FISCAL_SOURCE as string | undefined) === 'heuristic' ? 'heuristic' : 'rpc';

const RPC_TIMEOUT_MS = 4000;

const NOT_DEPLOYED_CODES = new Set<string>(['PGRST202', 'PGRST204', '42883', '42703', '42P01']);

interface RpcMetric {
  value?: number | null;
  display?: string;
}
type PymePayload = Record<string, RpcMetric>;

interface MetricsRpcArgs {
  p_tenant_id: string;
  p_period?: string;
}

export type RestrictedCashStatus = 'loading' | 'ready' | 'error';

export interface RestrictedCashState {
  status: RestrictedCashStatus;
  /** 'rpc' = cifra estricta del servidor · 'heuristic' = rama de rollback/fallback. */
  source: FiscalSource;
  value: number | null;
  display: string | null;
  /** Reintenta la llamada (lo usa el affordance de error del tile). */
  reload: () => void;
}

type Internal = Omit<RestrictedCashState, 'reload'>;

const READY_HEURISTIC: Internal = { status: 'ready', source: 'heuristic', value: null, display: null };

export function useRestrictedCash(tenantId: string | null): RestrictedCashState {
  const [state, setState] = useState<Internal>(
    FISCAL_SOURCE === 'heuristic' ? READY_HEURISTIC : { status: 'loading', source: 'rpc', value: null, display: null },
  );
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    // Anillo 1: kill-switch — sin red, usa la heurística (valor lo aporta el componente).
    if (FISCAL_SOURCE === 'heuristic') {
      setState(READY_HEURISTIC);
      return;
    }
    if (!tenantId) {
      setState({ status: 'loading', source: 'rpc', value: null, display: null });
      return;
    }

    let ignore = false;
    let timedOut = false;
    const controller = new AbortController();
    setState({ status: 'loading', source: 'rpc', value: null, display: null });

    // Anillo 2: timeout agresivo — aborta la RPC si excede el presupuesto.
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, RPC_TIMEOUT_MS);

    (async () => {
      try {
        // Aserción contenida: el cliente tipado aún no expone esta RPC
        // (resolver con `npm run gen:types` post-despliegue). Se invoca como MÉTODO
        // sobre el cliente para preservar `this` (supabase-js usa `this.rest`).
        const client = supabase as unknown as {
          rpc: (
            name: 'metrics_pyme',
            args: MetricsRpcArgs,
          ) => { abortSignal: (s: AbortSignal) => PromiseLike<{ data: PymePayload | null; error: PostgrestError | null }> };
        };

        const { data, error } = await client.rpc('metrics_pyme', { p_tenant_id: tenantId }).abortSignal(controller.signal);
        if (ignore) return;
        clearTimeout(timer);

        if (error) {
          if (NOT_DEPLOYED_CODES.has(error.code)) {
            reportError(error, { stage: 'restricted-cash', reason: 'not-deployed' });
            setState(READY_HEURISTIC); // ausencia de RPC → heurística (no es latencia)
            return;
          }
          reportError(error, { stage: 'restricted-cash', reason: 'rpc-error' });
          setState({ status: 'error', source: 'rpc', value: null, display: null });
          return;
        }

        const m = data?.restrictedCashWidget;
        setState({ status: 'ready', source: 'rpc', value: m?.value ?? null, display: m?.display ?? null });
      } catch (err: unknown) {
        if (ignore) return;
        clearTimeout(timer);
        if (timedOut) {
          reportError(new Error('metrics_pyme timeout'), { stage: 'restricted-cash', reason: 'timeout', timeoutMs: RPC_TIMEOUT_MS });
          setState({ status: 'error', source: 'rpc', value: null, display: null });
          return;
        }
        if (err instanceof DOMException && err.name === 'AbortError') return; // desmontaje
        reportError(err, { stage: 'restricted-cash', reason: 'exception' });
        setState({ status: 'error', source: 'rpc', value: null, display: null });
      }
    })();

    return () => {
      ignore = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [tenantId, nonce]);

  return { ...state, reload };
}
