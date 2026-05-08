import { useState } from 'react';
import { useFigmaIntegration } from '@/hooks/useFigmaIntegration';
import { NavigationCanvas } from './NavigationCanvas';
import type { ReactFlowNodeData, ReactFlowEdgeData } from './FigmaPanel';

interface Insight {
  type: 'warning' | 'info' | 'error';
  title: string;
  description: string;
}

export function FigmaAdminPanel() {
  const figma = useFigmaIntegration();
  const [showFiles, setShowFiles] = useState(false);

  async function handleShowFiles() {
    await figma.fetchFiles();
    setShowFiles(true);
  }

  async function handleScan(fileKey: string) {
    setShowFiles(false);
    await figma.scanFile(fileKey);
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!figma.status?.connected) {
    return (
      <div className="max-w-md mx-auto mt-16 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#7C6FF7]/10 border-2 border-[#7C6FF7]/20 flex items-center justify-center">
          <FigmaIcon className="w-8 h-8 text-[#7C6FF7]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">
            Conecta tu cuenta de Figma
          </h2>
          <p className="text-sm text-gray-400 dark:text-[#8B8AA0] leading-relaxed max-w-sm">
            ValidateAI leerá la estructura de tus prototipos y generará un mapa de
            navegación interactivo con análisis de IA.
          </p>
          <p className="text-xs text-gray-400 dark:text-[#8B8AA0]/60 mt-2">
            Solo lectura · Solo estructura y nombres de capas · Sin acceso a imágenes privadas
          </p>
        </div>
        <button
          onClick={figma.connect}
          disabled={figma.loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#7C6FF7] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition-colors shadow-lg shadow-[#7C6FF7]/25 disabled:opacity-50"
        >
          {figma.loading
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <FigmaIcon className="w-4 h-4" />
          }
          Conectar con Figma
        </button>
      </div>
    );
  }

  // ── Connected — show file picker or map ──────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">

      {/* Connection header */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-white dark:bg-[#13121F] border border-gray-100 dark:border-[#2A2940]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7C6FF7]/10 flex items-center justify-center">
            <FigmaIcon className="w-5 h-5 text-[#7C6FF7]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFF8]">
              Figma conectado
            </p>
            <p className="text-xs text-gray-400 dark:text-[#8B8AA0]">
              @{figma.status.figma_handle}
              {figma.status.created_at && ` · vinculado el ${new Date(figma.status.created_at).toLocaleDateString('es-CL')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShowFiles}
            disabled={figma.loading || figma.scanning}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#7C6FF7] text-white text-sm font-semibold rounded-xl hover:bg-[#6B5EE6] transition-colors disabled:opacity-50"
          >
            {figma.loading
              ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <ScanIcon className="w-3.5 h-3.5" />
            }
            Escanear archivo
          </button>
          <button
            onClick={figma.disconnect}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Desconectar
          </button>
        </div>
      </div>

      {/* File picker */}
      {showFiles && (
        <div className="rounded-2xl border border-[#2A2940] bg-[#13121F] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#F0EFF8]">
              Elige el archivo a escanear
            </h3>
            <button
              onClick={() => setShowFiles(false)}
              className="text-xs text-[#8B8AA0] hover:text-[#F0EFF8] transition-colors"
            >
              Cancelar
            </button>
          </div>
          {figma.files.length === 0 ? (
            <p className="text-sm text-[#8B8AA0] text-center py-8">
              No se encontraron archivos en tu cuenta de Figma.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {figma.files.map((file) => (
                <button
                  key={file.key}
                  onClick={() => handleScan(file.key)}
                  disabled={figma.scanning}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#2A2940] hover:border-[#7C6FF7]/50 hover:bg-[#7C6FF7]/5 transition-all text-left group disabled:opacity-50"
                >
                  {file.thumbnail_url ? (
                    <img
                      src={file.thumbnail_url}
                      alt={file.name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#2A2940]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#7C6FF7]/10 flex items-center justify-center shrink-0">
                      <FigmaIcon className="w-6 h-6 text-[#7C6FF7]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#F0EFF8] truncate group-hover:text-[#7C6FF7] transition-colors">
                      {file.name}
                    </p>
                    <p className="text-xs text-[#8B8AA0] mt-0.5">
                      Modificado {new Date(file.last_modified).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <span className="text-[#7C6FF7] text-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scanning indicator */}
      {figma.scanning && (
        <div className="rounded-xl bg-[#7C6FF7]/5 border border-[#7C6FF7]/20 p-4 flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-[#7C6FF7] border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#F0EFF8]">Escaneando prototipo...</p>
            <p className="text-xs text-[#8B8AA0]">
              Detectando pantallas, conexiones y generando análisis de IA
            </p>
          </div>
        </div>
      )}

      {/* Map result */}
      {figma.map && !figma.scanning && (
        <div className="space-y-4">
          {/* Map header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">
                {figma.map.file_name}
              </h2>
              <p className="text-xs text-gray-400 dark:text-[#8B8AA0] mt-0.5">
                Página: <span className="font-medium">{figma.map.page_name}</span>
                {' · '}
                <span className="text-emerald-400 font-medium">{(figma.map.nodes as unknown[]).length} pantallas</span>
                {' · '}
                {(figma.map.edges as unknown[]).length} conexiones
                {' · '}
                Actualizado {new Date(figma.map.updated_at).toLocaleDateString('es-CL')}
              </p>
            </div>
            <button
              onClick={handleShowFiles}
              disabled={figma.loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#7C6FF7] border border-[#7C6FF7]/30 rounded-lg hover:bg-[#7C6FF7]/10 transition-colors disabled:opacity-40"
            >
              <ScanIcon className="w-3 h-3" />
              Cambiar archivo
            </button>
          </div>

          {/* AI Insights */}
          {figma.map.ai_insights && (
            <AIInsightsSection insights={figma.map.ai_insights as Record<string, unknown>} />
          )}

          {/* Navigation Canvas */}
          <NavigationCanvas
            nodes={figma.map.nodes as ReactFlowNodeData[]}
            edges={figma.map.edges as ReactFlowEdgeData[]}
          />
        </div>
      )}

      {/* Empty state — connected but no map yet */}
      {!figma.map && !figma.scanning && !showFiles && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2A2940] flex items-center justify-center">
            <ScanIcon className="w-7 h-7 text-[#8B8AA0]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#F0EFF8] mb-1">
              Ningún archivo escaneado aún
            </p>
            <p className="text-xs text-[#8B8AA0]">
              Haz clic en "Escanear archivo" para analizar tu prototipo de Figma
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Insights Section ────────────────────────────────────────────────────────

function AIInsightsSection({ insights }: { insights: Record<string, unknown> }) {
  const items = (insights.insights as Insight[] | undefined) ?? [];
  const score = insights.health_score as number | null;
  const summary = insights.summary as string | undefined;
  const recommendation = insights.recommendation as string | undefined;
  const ratio = insights.breadth_depth_ratio as string | undefined;

  return (
    <div className="rounded-2xl border border-[#2A2940] bg-[#13121F] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#F0EFF8]">Análisis de IA · Arquitectura de Navegación</h3>
        {score != null && (
          <span className={`text-sm font-black px-3 py-1 rounded-lg ${
            score >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
            score >= 40 ? 'bg-amber-500/10 text-amber-400' :
            'bg-red-500/10 text-red-400'
          }`}>
            {score}/100
          </span>
        )}
      </div>

      {summary && (
        <p className="text-sm text-[#8B8AA0] leading-relaxed">{summary}</p>
      )}

      {ratio && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#7C6FF7]/10 border border-[#7C6FF7]/20">
          <span className="text-xs font-semibold text-[#7C6FF7]">Arquitectura: {ratio}</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
              item.type === 'error'   ? 'bg-red-500/5 border-red-500/20' :
              item.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
              'bg-[#7C6FF7]/5 border-[#7C6FF7]/20'
            }`}>
              <span className={`mt-0.5 text-lg leading-none ${
                item.type === 'error' ? 'text-red-400' :
                item.type === 'warning' ? 'text-amber-400' :
                'text-[#7C6FF7]'
              }`}>
                {item.type === 'error' ? '✕' : item.type === 'warning' ? '!' : 'i'}
              </span>
              <div>
                <p className="text-xs font-semibold text-[#F0EFF8]">{item.title}</p>
                <p className="text-xs text-[#8B8AA0] mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {recommendation && (
        <div className="pt-3 border-t border-[#2A2940]">
          <p className="text-xs font-semibold text-[#7C6FF7] mb-1">Recomendación principal</p>
          <p className="text-sm text-[#F0EFF8] leading-relaxed">{recommendation}</p>
        </div>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function FigmaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 57" fill="currentColor">
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" opacity=".9"/>
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" opacity=".5"/>
      <path d="M19 0v19h9.5a9.5 9.5 0 0 0 0-19H19z" opacity=".7"/>
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" opacity=".6"/>
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" opacity=".8"/>
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" />
    </svg>
  );
}
