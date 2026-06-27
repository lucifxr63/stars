import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/store/theme';

/** Botón sol/luna que alterna el tema y persiste la elección. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={isDark ? 'Tema claro' : 'Tema oscuro'}
      className={`grid size-9 place-items-center rounded-lg border border-border bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer ${className ?? ''}`}
    >
      {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </button>
  );
}
