import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Modelos de negocio soportados en el MVP. El diseño final contempla 5, pero
// este sprint se limita estrictamente a dos (ver CLAUDE_CASHFLOW_MVP.md §2).
export type WorkspaceModel = 'pyme-tradicional' | 'startup-saas';

export interface WorkspaceMeta {
  id: WorkspaceModel;
  /** Nombre visible en el switcher. */
  label: string;
  /** Subtítulo breve del enfoque del modelo. */
  description: string;
  /** Icono de lucide-react asociado (nombre, resuelto en la UI). */
  icon: 'building' | 'rocket';
}

// Catálogo declarativo. Mantener el orden = orden de aparición en el switcher.
export const WORKSPACES: readonly WorkspaceMeta[] = [
  {
    id: 'pyme-tradicional',
    label: 'PyME Tradicional',
    description: 'Liquidez, caja restringida (IVA/PPM) y capital de trabajo.',
    icon: 'building',
  },
  {
    id: 'startup-saas',
    label: 'Startup SaaS',
    description: 'Burn rate, runway y MRR.',
    icon: 'rocket',
  },
] as const;

export function getWorkspaceMeta(model: WorkspaceModel): WorkspaceMeta {
  return WORKSPACES.find((w) => w.id === model) ?? WORKSPACES[0];
}

interface WorkspaceState {
  /** Modelo de negocio activo. */
  model: WorkspaceModel;
  /** Conmuta el modelo activo (lo consume el Workspace Switcher). */
  setModel: (model: WorkspaceModel) => void;
}

// Persistido en localStorage con el middleware `persist`: la selección sobrevive
// entre sesiones. Clave aislada con prefijo `cf_` (convención del proyecto).
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      model: 'pyme-tradicional',
      setModel: (model) => set({ model }),
    }),
    {
      name: 'cf_workspace',
      version: 1,
    },
  ),
);
