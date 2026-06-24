import { useEffect, useState } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getDefaultTenant } from '@/lib/queries';
import { reportError } from '@/lib/report-error';
import { useWorkspaceStore, type WorkspaceModel } from '@/store/useWorkspaceStore';

// Hook orquestador central. Único punto que "hace fetch": escucha el modelo
// activo en useWorkspaceStore y obtiene el payload de métricas vía RPC. Los
// widgets son stateless y reciben su porción ya resuelta desde el DashboardCanvas.
//
// Fuente de verdad: cashflow.metrics_pyme / cashflow.metrics_saas (migración
// 20260624000000). Mientras la migración no esté desplegada, se aplica
// DEGRADACIÓN ELEGANTE al mock — pero SOLO ante "RPC/columna no desplegada".
// Cualquier otro fallo (RLS, permisos, timeout) falla ruidosamente.

export type MetricTone = 'positive' | 'negative' | 'warning' | 'neutral';

export interface WidgetMetric {
  /** Valor formateado y listo para render (ej. "$4,8M", "8,2 meses"). */
  display: string;
  /** Valor numérico crudo (lo añade la RPC; el mock no lo trae). */
  value?: number | null;
  /** Variación relativa vs. período previo, en fracción (0.12 = +12%). */
  delta?: number;
  /** Serie corta para sparkline/placeholder de gráfico. */
  trend?: number[];
  /** Semántica de color para el widget. */
  tone?: MetricTone;
  /** Glosa contextual bajo el valor. */
  note?: string;
}

/** Diccionario widgetId → métrica. Lo consume el DashboardCanvas. */
export type MetricsPayload = Record<string, WidgetMetric>;

export interface DashboardMetricsResult {
  model: WorkspaceModel;
  data: MetricsPayload | null;
  loading: boolean;
  error: string | null;
  /** true = los datos provienen del mock (RPC aún no desplegada). */
  degraded: boolean;
}

// ── Contrato de la RPC (DEUDA TÉCNICA contenida) ────────────────────────────
// database.types.ts aún no conoce estas funciones ni la columna business_model.
// Tipamos el contrato localmente y hacemos UNA aserción acotada sobre
// supabase.rpc. Resolver con `npm run gen:types` tras desplegar la migración.
type MetricsRpcName = 'metrics_pyme' | 'metrics_saas';

const RPC_BY_MODEL: Record<WorkspaceModel, MetricsRpcName> = {
  'pyme-tradicional': 'metrics_pyme',
  'startup-saas': 'metrics_saas',
};

interface MetricsRpcArgs {
  p_tenant_id: string;
  p_period?: string;
}

async function callMetricsRpc(
  fn: MetricsRpcName,
  tenantId: string,
  signal: AbortSignal,
): Promise<{ data: MetricsPayload | null; error: PostgrestError | null }> {
  // Aserción contenida: el cliente tipado todavía no expone estas RPCs.
  const rpc = supabase.rpc as unknown as (
    name: MetricsRpcName,
    args: MetricsRpcArgs,
  ) => {
    abortSignal: (s: AbortSignal) => PromiseLike<{ data: MetricsPayload | null; error: PostgrestError | null }>;
  };
  return rpc(fn, { p_tenant_id: tenantId }).abortSignal(signal);
}

// Códigos que indican "RPC/columna aún no desplegada" → ÚNICO caso en que se
// permite degradar al mock. Cualquier otro error debe propagarse a la UI.
const NOT_DEPLOYED_CODES = new Set<string>([
  'PGRST202', // función no encontrada en el schema cache de PostgREST
  'PGRST204', // columna no encontrada (ej. business_model no reconocida aún)
  '42883', // undefined_function (Postgres)
  '42703', // undefined_column
  '42P01', // undefined_table
]);

function isNotDeployed(error: PostgrestError): boolean {
  return NOT_DEPLOYED_CODES.has(error.code);
}

// ── Mocks por modelo (fallback temporal; se elimina al desplegar la migración) ─
const MOCKS: Record<WorkspaceModel, MetricsPayload> = {
  'pyme-tradicional': {
    currentCashWidget: { display: '$12,4M', delta: 0.04, tone: 'positive', note: 'Disponible en cuentas' },
    restrictedCashWidget: { display: '$3,1M', tone: 'warning', note: '19% IVA + PPM reservado' },
    workingCapitalWidget: { display: '$8,9M', delta: -0.02, tone: 'neutral', note: 'Activo circulante − pasivo' },
    liquidityProjectionWidget: {
      display: 'Saldo mínimo $1,2M',
      tone: 'neutral',
      note: 'Próximos 90 días',
      trend: [12.4, 11.8, 10.2, 8.6, 6.1, 4.4, 2.8, 1.2, 2.0, 3.5],
    },
    receivablesWidget: { display: '$6,7M', tone: 'warning', note: '4 facturas vencidas' },
  },
  'startup-saas': {
    burnRateWidget: { display: '$9,8M/mes', delta: 0.08, tone: 'negative', note: 'Quema neta mensual' },
    runwayWidget: { display: '8,2 meses', tone: 'warning', note: 'A burn rate actual' },
    mrrWidget: { display: '$4,1M', delta: 0.12, tone: 'positive', note: 'Ingreso recurrente mensual' },
    burnTrendWidget: {
      display: 'Quema 6M',
      tone: 'negative',
      note: 'Últimos 6 meses',
      trend: [7.2, 7.9, 8.4, 8.8, 9.3, 9.8],
    },
    cashBalanceWidget: { display: '$80,4M', delta: -0.11, tone: 'neutral', note: 'Caja en banco' },
  },
};

/** Mock asíncrono con latencia simulada. Solo se usa en degradación elegante. */
function fetchMockMetrics(model: WorkspaceModel, signal: AbortSignal): Promise<MetricsPayload> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(MOCKS[model]), 300);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

export function useDashboardMetricsPayload(): DashboardMetricsResult {
  const model = useWorkspaceStore((s) => s.model);
  // undefined = resolviendo · null = sin empresa · string = tenant activo.
  const [tenantId, setTenantId] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

  // Resuelve la empresa activa una vez (la RLS la acota al usuario).
  useEffect(() => {
    let ignore = false;
    getDefaultTenant()
      .then((t) => {
        if (!ignore) setTenantId(t?.id ?? null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        reportError(err, { stage: 'resolve-tenant' });
        setError('No se pudo resolver la empresa activa.');
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Carga métricas al cambiar el modelo o resolverse el tenant.
  useEffect(() => {
    if (tenantId === undefined) return; // aún resolviendo el tenant
    if (tenantId === null) {
      setData(null);
      setError(null);
      setDegraded(false);
      setLoading(false);
      return;
    }

    let ignore = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data: rpcData, error: rpcError } = await callMetricsRpc(
          RPC_BY_MODEL[model],
          tenantId,
          controller.signal,
        );
        if (ignore) return;

        if (rpcError) {
          if (isNotDeployed(rpcError)) {
            // Degradación elegante: la RPC aún no existe → mock temporal (visible).
            reportError(rpcError, { stage: 'metrics-rpc', model, degraded: true });
            const mock = await fetchMockMetrics(model, controller.signal);
            if (ignore) return;
            setData(mock);
            setDegraded(true);
            setLoading(false);
            return;
          }
          // RPC existe pero falló (RLS, permisos, timeout): fallar ruidosamente.
          reportError(rpcError, { stage: 'metrics-rpc', model, degraded: false });
          setError('No se pudieron cargar las métricas. Inténtalo nuevamente.');
          setDegraded(false);
          setLoading(false);
          return;
        }

        setData(rpcData ?? {});
        setDegraded(false);
        setLoading(false);
      } catch (err: unknown) {
        if (ignore) return;
        if (err instanceof DOMException && err.name === 'AbortError') return; // cambio de modelo
        reportError(err, { stage: 'metrics-rpc', model });
        setError('No se pudieron cargar las métricas. Inténtalo nuevamente.');
        setDegraded(false);
        setLoading(false);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [model, tenantId]);

  return { model, data, loading, error, degraded };
}
