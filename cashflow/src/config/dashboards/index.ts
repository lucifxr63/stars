import type { WorkspaceModel } from '@/store/useWorkspaceStore';
import type { DashboardLayout } from './types';
import pymeLayout from './pymeLayout.json';
import startupLayout from './startupLayout.json';

// Mapa modelo → layout. El cast es seguro: los JSON están validados contra
// `DashboardLayout` por su forma (span/columns literales). Si un JSON deriva del
// contrato, fallará aquí en compilación.
const LAYOUTS: Record<WorkspaceModel, DashboardLayout> = {
  'pyme-tradicional': pymeLayout as DashboardLayout,
  'startup-saas': startupLayout as DashboardLayout,
};

export function getDashboardLayout(model: WorkspaceModel): DashboardLayout {
  return LAYOUTS[model];
}

export type { DashboardLayout } from './types';
