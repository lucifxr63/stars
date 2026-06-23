import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

// Provider con un único diálogo a nivel app. Uso:
//   const confirm = useConfirm();
//   if (await confirm({ title: '¿Eliminar?', danger: true })) { ... }
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current(value);
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {opts.danger && (
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-danger/15 text-danger">
                  <AlertTriangle className="size-5" aria-hidden="true" />
                </span>
              )}
              <div>
                <h2 className="font-semibold">{opts.title}</h2>
                {opts.message && <p className="mt-1 text-sm text-muted-foreground">{opts.message}</p>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className={opts.danger ? 'bg-danger text-white hover:bg-danger/90' : ''}
                onClick={() => close(true)}
                autoFocus
              >
                {opts.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
