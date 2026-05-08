import { useState } from 'react';
import { useFigmaIntegration } from '@/hooks/useFigmaIntegration';
import { NavigationCanvas } from './NavigationCanvas';
import type { ReactFlowNodeData, ReactFlowEdgeData } from './FigmaPanel';

interface Insight {
  type: 'warning' | 'info' | 'error';
  title: string;
  description: string;
}

interface ResolvedFile {
  file_key: string;
  file_name: string;
  pages: { id: string; name: string }[];
}

export function FigmaAdminPanel() {
  const figma = useFigmaIntegration();
  const [urlInput, setUrlInput] = useState('');
  const [resolved, setResolved] = useState<ResolvedFile | null>(null);
  const [selectedPage, setSelectedPage] = useState<string>('');

  async function handleResolve() {
    const result = await figma.resolveUrl(urlInput.trim());
    if (result) {
      setResolved(result);
      setSelectedPage(result.pages[0]?.id ?? '');
    }
  }

  async function handleScan() {
    if (!resolved) return;
    await figma.scanFile(resolved.file_key, { pageId: selectedPage || undefined });
  }

  function handleReset() {
    setResolved(null);
    setUrlInput('');
    setSelectedPage('');
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
            ValidateAI leerá la estructura de tus prototipos y generará un mapa
            de navegación interactivo con análisis de IA.
          </p>
          <p className="text-xs text-gray-400/60 mt-2">
            Solo lectura · Solo estructura y nombres de capas
          </p>
        </div>
        <button
          onClick={figma.connect}
          disabled={figma.loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#7C6FF7] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition-colors shadow-lg shadow-[#7C6FF7]/25 disabled:opacity-50"
        >
          {figma.loading
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <FigmaIcon className="w-4 h-4" />}
          Conectar con Figma
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Connection status bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-white dark:bg-[#13121F] border border-gray-100 dark:border-[#2A2940]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7C6FF7]/10 flex items-center justify-center">
            <FigmaIcon className="w-5 h-5 text-[#7C6FF7]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFF8]">
                Figma conectado · @{figma.status.figma_handle}
              </p>
            </div>
            <p className="text-xs text-gray-400 dark:text-[#8B8AA0]">
              Pega la URL de tu archivo para escanear su mapa de navegación
            </p>
          </div>
        </div>
        <button
          onClick={figma.disconnect}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          Desconectar
        </button>
      </div>

      {/* URL input */}
      {!resolved && (
        <div className="rounded-2xl border border-[#2A2940] bg-[#13121F] p-5 space-y-3">
          <div>
            <label className="text-sm font-semibold text-[#F0EFF8] block mb-1">
              URL del archivo de Figma
            </label>
            <p className="text-xs text-[#8B8AA0] mb-3">
              Copia el enlace desde Figma → botón "Compartir" → "Copiar enlace"
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !figma.loading && urlInput.trim() && handleResolve()}
                placeholder="https://www.figma.com/design/AbCdEf123/Mi-App"
                className="flex-1 px-3 py-2.5 rounded-xl bg-[#0D0C1A] border border-[#2A2940] text-sm text-[#F0EFF8] placeholder-[#8B8AA0]/50 focus:outline-none focus:border-[#7C6FF7] transition-colors"
              />
              <button
                onClick={handleResolve}
                disabled={figma.loading || !urlInput.trim()}
                className="px-4 py-2.5 bg-[#7C6FF7] text-white text-sm font-semibold rounded-xl hover:bg-[#6B5EE6] transition-colors disabled:opacity-50 shrink-0"
              >
                {figma.loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                  : 'Verificar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page selector after resolve */}
      {resolved && !figma.map && !figma.scanning && (
        <div className="rounded-2xl border border-[#7C6FF7]/30 bg-[#13121F] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#8B8AA0]">Archivo encontrado</p>
              <p className="text-base font-bold text-[#F0EFF8]">{resolved.file_name}</p>
            </div>
            <button onClick={handleReset} className="text-xs text-[#8B8AA0] hover:text-[#F0EFF8] transition-colors">
              Cambiar URL
            </button>
          </div>

          {resolved.pages.length > 1 && (
            <div>
              <label className="text-xs font-semibold text-[#8B8AA0] block mb-2">
                Selecciona la página a escanear
              </label>
              <div className="flex flex-wrap gap-2">
                {resolved.pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => setSelectedPage(page.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      selectedPage === page.id
                        ? 'bg-[#7C6FF7] text-white'
                        : 'bg-[#2A2940] text-[#8B8AA0] hover:text-[#F0EFF8]'
                    }`}
                  >
                    {page.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={figma.scanning}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#7C6FF7] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition-colors disabled:opacity-50"
          >
            <ScanIcon className="w-4 h-4" />
            Escanear mapa de navegación
          </button>
        </div>
      )}

      {/* Scanning indicator */}
      {figma.scanning && (
        <div className="rounded-xl bg-[#7C6FF7]/5 border border-[#7C6FF7]/20 p-5 flex items-center gap-4">
          <span className="w-6 h-6 border-2 border-[#7C6FF7] border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#F0EFF8]">Escaneando prototipo...</p>
            <p className="text-xs text-[#8B8AA0] mt-0.5">
              Extrayendo pantallas, conexiones y generando análisis de IA
            </p>
          </div>
        </div>
      )}

      {/* Map result */}
      {figma.map && !figma.scanning && (
        <div className="space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">
                {figma.map.file_name}
              </h2>
              <p className="text-xs text-gray-400 dark:text-[#8B8AA0] mt-0.5">
                Página: <span className="font-medium">{figma.map.page_name}</span>
                {' · '}
                <span className="text-emerald-400 font-medium">
                  {(figma.map.nodes as unknown[]).length} pantallas
                </span>
                {' · '}
                {(figma.map.edges as unknown[]).length} conexiones
                {' · '}
                Actualizado {new Date(figma.map.updated_at).toLocaleDateString('es-CL')}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#7C6FF7] border border-[#7C6FF7]/30 rounded-lg hover:bg-[#7C6FF7]/10 transition-colors"
            >
              <ScanIcon className="w-3 h-3" />
              Nuevo escaneo
            </button>
          </div>

          {figma.map.ai_insights && (
            <AIInsightsSection insights={figma.map.ai_insights as Record<string, unknown>} />
          )}

          <NavigationCanvas
            nodes={figma.map.nodes as ReactFlowNodeData[]}
            edges={figma.map.edges as ReactFlowEdgeData[]}
          />
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
      {summary && <p className="text-sm text-[#8B8AA0] leading-relaxed">{summary}</p>}
      {ratio && (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 text-xs font-semibold text-[#7C6FF7]">
          Arquitectura: {ratio}
        </span>
      )}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
              item.type === 'error'   ? 'bg-red-500/5 border-red-500/20' :
              item.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
              'bg-[#7C6FF7]/5 border-[#7C6FF7]/20'
            }`}>
              <span className={`text-base leading-none mt-0.5 ${
                item.type === 'error' ? 'text-red-400' :
                item.type === 'warning' ? 'text-amber-400' : 'text-[#7C6FF7]'
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
