import { useState } from 'react';
import type { useFigmaIntegration } from '@/hooks/useFigmaIntegration';
import { NavigationCanvas } from './NavigationCanvas';

type FigmaHook = ReturnType<typeof useFigmaIntegration>;

interface FigmaFile {
  key: string;
  name: string;
  last_modified: string;
  thumbnail_url?: string;
}

interface Props {
  figma: FigmaHook;
  validationId: string;
}

export function FigmaPanel({ figma }: Props) {
  const [selectedFile, setSelectedFile] = useState<FigmaFile | null>(null);
  const [showFiles, setShowFiles] = useState(false);

  function handleConnect() {
    figma.connect();
  }

  async function handleShowFiles() {
    await figma.fetchFiles();
    setShowFiles(true);
  }

  async function handleScan(file: FigmaFile) {
    setSelectedFile(file);
    setShowFiles(false);
    await figma.scanFile(file.key);
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!figma.status?.connected) {
    return (
      <div className="rounded-2xl border border-dashed border-[#7C6FF7]/30 bg-[#7C6FF7]/5 p-10 flex flex-col items-center gap-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#7C6FF7]/10 border-2 border-[#7C6FF7]/20 flex items-center justify-center">
          <FigmaIcon className="w-7 h-7 text-[#7C6FF7]" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-800 dark:text-[#F0EFF8] mb-1">
            Vincula tu prototipo de Figma
          </h3>
          <p className="text-sm text-gray-400 dark:text-[#8B8AA0] max-w-sm leading-relaxed">
            Conecta tu cuenta de Figma para que ValidateAI analice la arquitectura
            de navegación de tu producto y detecte fricciones antes de escribir código.
          </p>
          <p className="text-xs text-gray-400 dark:text-[#8B8AA0]/60 mt-2">
            Solo lectura · Solo estructura y nombres de capas
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={figma.loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7C6FF7] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition-colors shadow-lg shadow-[#7C6FF7]/25 disabled:opacity-50"
        >
          {figma.loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FigmaIcon className="w-4 h-4" />
          )}
          Conectar con Figma
        </button>
      </div>
    );
  }

  // ── Connected, no map yet ──────────────────────────────────────────────────
  if (!figma.map) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span className="text-sm text-gray-500 dark:text-[#8B8AA0]">
              Figma conectado como{' '}
              <span className="font-semibold text-gray-700 dark:text-[#F0EFF8]">
                {figma.status.figma_handle}
              </span>
            </span>
          </div>
          <button
            onClick={figma.disconnect}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Desconectar
          </button>
        </div>

        {!showFiles ? (
          <div className="rounded-2xl border border-[#2A2940] bg-[#13121F] p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#7C6FF7]/10 flex items-center justify-center">
              <GridIcon className="w-6 h-6 text-[#7C6FF7]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#F0EFF8] mb-1">
                Selecciona un archivo de Figma
              </h3>
              <p className="text-sm text-[#8B8AA0] max-w-xs">
                ValidateAI extraerá las pantallas y flujos de navegación para analizarlos con IA.
              </p>
            </div>
            <button
              onClick={handleShowFiles}
              disabled={figma.loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#7C6FF7] text-white text-sm font-semibold rounded-xl hover:bg-[#6B5EE6] transition-colors disabled:opacity-50"
            >
              {figma.loading
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Ver mis archivos de Figma'
              }
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#2A2940] bg-[#13121F] p-4">
            <h3 className="text-sm font-semibold text-[#F0EFF8] mb-3 px-1">
              Elige un archivo para analizar
            </h3>
            {figma.files.length === 0 ? (
              <p className="text-sm text-[#8B8AA0] text-center py-6">
                No se encontraron archivos en tu cuenta de Figma.
              </p>
            ) : (
              <ul className="space-y-2">
                {figma.files.map((file) => (
                  <li key={file.key}>
                    <button
                      onClick={() => handleScan(file)}
                      disabled={figma.scanning}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#7C6FF7]/10 transition-colors text-left group disabled:opacity-50"
                    >
                      {file.thumbnail_url ? (
                        <img
                          src={file.thumbnail_url}
                          alt={file.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#2A2940]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#7C6FF7]/10 flex items-center justify-center shrink-0">
                          <FigmaIcon className="w-5 h-5 text-[#7C6FF7]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#F0EFF8] truncate group-hover:text-[#7C6FF7] transition-colors">
                          {file.name}
                        </p>
                        <p className="text-xs text-[#8B8AA0]">
                          {new Date(file.last_modified).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                      <span className="ml-auto text-[#7C6FF7] text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Analizar →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {figma.scanning && (
          <div className="rounded-xl bg-[#7C6FF7]/5 border border-[#7C6FF7]/20 p-4 flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-[#7C6FF7] border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#F0EFF8]">Analizando prototipo...</p>
              <p className="text-xs text-[#8B8AA0]">
                Detectando pantallas, conexiones y generando insights de IA
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Map available ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-800 dark:text-[#F0EFF8]">
            {figma.map.file_name}
          </h3>
          <p className="text-xs text-gray-400 dark:text-[#8B8AA0]">
            Página: {figma.map.page_name} ·{' '}
            {(figma.map.nodes as unknown[]).length} pantallas ·{' '}
            {(figma.map.edges as unknown[]).length} conexiones ·{' '}
            Actualizado {new Date(figma.map.updated_at).toLocaleDateString('es-CL')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedFile && figma.scanFile(selectedFile.key)}
            disabled={figma.scanning || !selectedFile}
            className="text-xs text-[#7C6FF7] hover:text-[#6B5EE6] font-semibold transition-colors disabled:opacity-40"
          >
            {figma.scanning ? 'Sincronizando...' : '↺ Sincronizar'}
          </button>
          <button
            onClick={() => { figma.disconnect(); }}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Desconectar
          </button>
        </div>
      </div>

      {/* AI Insights */}
      {figma.map.ai_insights && (
        <AIInsightsBar insights={figma.map.ai_insights} />
      )}

      {/* Canvas */}
      <NavigationCanvas
        nodes={figma.map.nodes as ReactFlowNodeData[]}
        edges={figma.map.edges as ReactFlowEdgeData[]}
      />
    </div>
  );
}

// ── AI Insights Bar ────────────────────────────────────────────────────────────

interface Insight {
  type: 'warning' | 'info' | 'error';
  title: string;
  description: string;
}

function AIInsightsBar({ insights }: { insights: Record<string, unknown> }) {
  const items = (insights.insights as Insight[] | undefined) ?? [];
  const score = insights.health_score as number | null;
  const summary = insights.summary as string | undefined;

  return (
    <div className="rounded-2xl border border-[#2A2940] bg-[#13121F] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#F0EFF8]">Análisis de IA</p>
        {score != null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
            score >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
            score >= 40 ? 'bg-amber-500/10 text-amber-400' :
            'bg-red-500/10 text-red-400'
          }`}>
            Score {score}/100
          </span>
        )}
      </div>
      {summary && (
        <p className="text-xs text-[#8B8AA0] leading-relaxed">{summary}</p>
      )}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.slice(0, 4).map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                item.type === 'error' ? 'bg-red-400' :
                item.type === 'warning' ? 'bg-amber-400' :
                'bg-[#7C6FF7]'
              }`} />
              <div>
                <span className="text-xs font-medium text-[#F0EFF8]">{item.title}: </span>
                <span className="text-xs text-[#8B8AA0]">{item.description}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {typeof insights.recommendation === 'string' && (
        <p className="text-xs text-[#7C6FF7] font-medium border-t border-[#2A2940] pt-3">
          Recomendación: {insights.recommendation}
        </p>
      )}
    </div>
  );
}

// ── Types for canvas props ─────────────────────────────────────────────────────

export interface ReactFlowNodeData {
  id: string;
  data: { label: string; figmaId: string };
  position: { x: number; y: number };
  type?: string;
}

export interface ReactFlowEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: { triggerType: string; transitionType?: string; isExternal?: boolean };
}

// ── Inline icons ───────────────────────────────────────────────────────────────

function FigmaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 57" fill="none">
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="currentColor" opacity=".9"/>
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="currentColor" opacity=".5"/>
      <path d="M19 0v19h9.5a9.5 9.5 0 0 0 0-19H19z" fill="currentColor" opacity=".7"/>
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="currentColor" opacity=".6"/>
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="currentColor" opacity=".8"/>
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}
