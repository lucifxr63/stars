import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useValidationHistory } from '@/hooks/useValidationHistory';
import { VersionTimeline } from '@/components/shared/VersionTimeline';
import type { ValidationVersion } from '@/types/validation';

type ViewMode = 'timeline' | 'compare';

function CompareView({ versions }: { versions: ValidationVersion[] }) {
  const completed = versions.filter((v) => v.validation_score !== null);
  const [leftId, setLeftId]   = useState<string>(completed[0]?.id ?? '');
  const [rightId, setRightId] = useState<string>(completed[completed.length - 1]?.id ?? '');

  const leftV  = versions.find((v) => v.id === leftId);
  const rightV = versions.find((v) => v.id === rightId);

  const scoreDelta =
    leftV?.validation_score != null && rightV?.validation_score != null
      ? rightV.validation_score - leftV.validation_score
      : null;

  const VersionSelect = ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
    >
      {versions.map((v) => (
        <option key={v.id} value={v.id}>
          v{v.version} — {v.idea_name ?? 'Sin nombre'} ({v.validation_score ?? '–'} pts)
        </option>
      ))}
    </select>
  );

  const VersionCard = ({ v, label }: { v: ValidationVersion | undefined; label: string }) => {
    if (!v) return <div className="flex-1 bg-gray-50 dark:bg-[#0A0A0F] rounded-2xl p-6 text-center text-gray-400 text-sm">Selecciona una versión</div>;
    const scoreColor = (v.validation_score ?? 0) >= 70 ? 'bg-green-500' : (v.validation_score ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500';
    return (
      <div className="flex-1 bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-xl ${scoreColor} flex items-center justify-center text-white font-black text-base shrink-0`}>
            {v.validation_score ?? '–'}
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">{label}</p>
            <p className="font-bold text-gray-900 dark:text-[#F0EFF8] text-sm">{v.idea_name ?? 'Sin nombre'}</p>
            <p className="text-xs text-gray-400">v{v.version} · {new Date(v.created_at).toLocaleDateString('es-CL')}</p>
          </div>
        </div>
        {v.pivot_reason && (
          <div className="bg-amber-50 rounded-xl p-3 mb-3 border border-amber-100">
            <p className="text-xs font-semibold text-amber-700 mb-1">Razón del pivot</p>
            <p className="text-xs text-gray-700 dark:text-[#C4C4D4]">{v.pivot_reason}</p>
          </div>
        )}
        <Link
          to={`/results/${v.id}`}
          className="text-xs font-semibold text-teal-600 hover:text-teal-800 transition-colors"
        >
          Ver reporte completo →
        </Link>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 font-semibold mb-1.5">Versión A</p>
          <VersionSelect value={leftId} onChange={setLeftId} />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-semibold mb-1.5">Versión B</p>
          <VersionSelect value={rightId} onChange={setRightId} />
        </div>
      </div>

      {/* Score delta */}
      {scoreDelta !== null && (
        <div className={`rounded-xl p-3 text-center border ${
          scoreDelta > 0 ? 'bg-green-50 border-green-100' : scoreDelta < 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 dark:bg-[#0A0A0F] border-gray-100 dark:border-white/5'
        }`}>
          <p className={`text-2xl font-black ${scoreDelta > 0 ? 'text-green-600' : scoreDelta < 0 ? 'text-red-600' : 'text-gray-500 dark:text-[#8B8AA0]'}`}>
            {scoreDelta > 0 ? '+' : ''}{scoreDelta} pts
          </p>
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">
            {scoreDelta > 0 ? 'Mejora entre versiones' : scoreDelta < 0 ? 'Caída entre versiones' : 'Sin cambio en el score'}
          </p>
        </div>
      )}

      {/* Side by side cards */}
      <div className="flex gap-3">
        <VersionCard v={leftV} label="Versión A" />
        <VersionCard v={rightV} label="Versión B" />
      </div>
    </div>
  );
}

export function IdeaHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { versions, loading } = useValidationHistory(id);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0F]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-500 dark:text-[#8B8AA0]">Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0A0A0F] gap-4">
        <p className="text-gray-500 dark:text-[#8B8AA0]">No se encontró el historial para esta idea.</p>
        <button
          onClick={() => navigate(id ? `/results/${id}` : '/validate')}
          className="text-teal-600 font-bold hover:underline"
        >
          Volver
        </button>
      </div>
    );
  }

  const rootIdeaName = versions[0]?.idea_name ?? 'Idea original';
  const totalPivots = versions.length - 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] text-gray-900 dark:text-[#F0EFF8] pb-20">
      {/* Header flotante */}
      <header className="sticky top-0 z-30 bg-white dark:bg-[#12121A]/80 backdrop-blur-md border-b-2 border-gray-100 dark:border-white/5 flex items-center h-16 px-4 sm:px-6">
        <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/results/${id}`)}
              className="w-10 h-10 rounded-full border-2 border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-800 dark:text-[#F0EFF8] hover:border-gray-200 dark:border-white/10 transition"
              title="Volver al reporte"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-black truncate max-w-[200px] sm:max-w-md">Historial de iteraciones</h1>
              <p className="text-xs text-gray-400 font-medium">
                {rootIdeaName} · {totalPivots} pivote{totalPivots !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* View toggle */}
          {versions.length >= 2 && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
              {(['timeline', 'compare'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    viewMode === mode
                      ? 'bg-white dark:bg-[#12121A] text-gray-900 dark:text-[#F0EFF8] shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-[#C4C4D4]'
                  }`}
                >
                  {mode === 'timeline' ? 'Línea de tiempo' : 'Comparar'}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-bl-[100px] -z-10 opacity-50" />

          <div className="max-w-2xl mx-auto">
            {viewMode === 'timeline' ? (
              <>
                <div className="mb-8 text-center">
                  <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                    🔄
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8] mb-2">Evolución de la Idea</h2>
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0] max-w-md mx-auto">
                    El camino al Product-Market Fit nunca es lineal. Aquí puedes ver cómo ha evolucionado tu validación a través de cada iteración.
                  </p>
                </div>
                <div className="mt-10">
                  <VersionTimeline versions={versions} currentId={id!} />
                </div>
              </>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <h2 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8] mb-2">Comparar versiones</h2>
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">Compara el score y contexto de dos versiones de tu idea.</p>
                </div>
                <CompareView versions={versions} />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
