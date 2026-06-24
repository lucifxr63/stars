import { Link } from 'react-router-dom';
import { Wallet, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import { DashboardCanvas } from '@/components/dashboard/DashboardCanvas';

// Página host del motor de Dashboards Financieros Dinámicos. El header lleva el
// Workspace Switcher (cambio de modelo sin modales) y el cuerpo es el lienzo
// config-driven que reacciona al modelo activo.
export function Workspace() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
        <span className="flex items-center gap-2.5 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold">Denarius</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <WorkspaceSwitcher />
          <ThemeToggle />
          <Link
            to="/dashboard"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <DashboardCanvas />
      </main>
    </div>
  );
}
