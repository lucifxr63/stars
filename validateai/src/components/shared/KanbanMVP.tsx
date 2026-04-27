interface Feature {
  name: string;
  description: string;
  priority: string;
}

interface KanbanMVPProps {
  features: Feature[];
  userFlow?: string | null;
}

const KANBAN_COLS = [
  { id: 'must', label: 'Esencial (Must)', icon: '🚀', className: 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-400', cardBorder: 'border-red-200 dark:border-red-500/20', dot: 'bg-red-500' },
  { id: 'should', label: 'Importante (Should)', icon: '⭐', className: 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400', cardBorder: 'border-amber-200 dark:border-amber-500/20', dot: 'bg-amber-500' },
  { id: 'could', label: 'Deseable (Could)', icon: '💡', className: 'bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-400', cardBorder: 'border-blue-200 dark:border-blue-500/20', dot: 'bg-blue-500' },
];

export function KanbanMVP({ features, userFlow }: KanbanMVPProps) {
  // Usar datos reales si existen, sino usar mocks para propósitos de visualización UI
  const displayFeatures = features && features.length > 0 ? features : [
    { name: '(Ejemplo) Autenticación', description: 'Registro con Google o Email', priority: 'must' },
    { name: '(Ejemplo) Dashboard Core', description: 'Vista principal de métricas de usuario', priority: 'must' },
    { name: '(Ejemplo) Exportación PDF', description: 'Descargar reportes en formato PDF', priority: 'should' },
    { name: '(Ejemplo) Integración Slack', description: 'Notificaciones automáticas', priority: 'could' }
  ];

  const displayFlow = userFlow || "(Ejemplo) 1. El usuario entra a la landing -> 2. Se registra -> 3. Conecta su cuenta bancaria -> 4. Es dirigido al dashboard donde revisa sus finanzas.";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {KANBAN_COLS.map((col) => {
          const colFeatures = displayFeatures.filter((f) => f.priority === col.id);
          const isMock = !features || features.length === 0;
          
          return (
            <div key={col.id} className={`rounded-2xl border-2 p-4 flex flex-col ${col.className}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">{col.icon}</span>
                <h3 className="font-bold text-sm">{col.label}</h3>
                <span className="ml-auto text-xs font-black opacity-60">{colFeatures.length}</span>
              </div>
              
              <div className="flex-1 space-y-3">
                {colFeatures.map((f, i) => (
                  <div key={i} className={`bg-white dark:bg-[#1A1A24] rounded-xl p-3 shadow-sm border ${col.cardBorder} hover:shadow-md transition-all ${isMock ? 'opacity-70' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${col.dot}`} />
                      <div>
                        <p className={`text-sm font-bold text-gray-900 dark:text-[#F0EFF8] leading-snug mb-1 ${isMock ? 'italic' : ''}`}>{f.name}</p>
                        <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{f.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {colFeatures.length === 0 && (
                  <div className="h-20 border-2 border-dashed border-current opacity-20 rounded-xl flex items-center justify-center">
                    <span className="text-xs font-semibold">Vacío</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gray-50 dark:bg-[#1A1A24] rounded-2xl border border-gray-200 dark:border-white/10 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🗺️</span>
          <h3 className="text-sm font-black text-gray-900 dark:text-[#F0EFF8] uppercase tracking-wide">Flujo de Usuario Sugerido</h3>
        </div>
        <p className={`text-sm text-gray-600 dark:text-[#8B8AA0] leading-relaxed ${!userFlow ? 'italic opacity-80' : ''}`}>{displayFlow}</p>
      </div>
    </div>
  );
}
