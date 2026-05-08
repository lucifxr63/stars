import { useState, useEffect } from 'react';
import { useCarouselStore } from '@/stores/carouselStore';
import { CarouselEditor } from '@/components/carousel/CarouselEditor';
import { supabase } from '@/lib/supabase';
import type { CarouselPlatform, CarouselTheme } from '@/types/carousel';

interface AdminData {
  usersTotal: number;
  validationsTotal: number;
  completedValidations: number;
  aiInteractionsTotal: number;
  topIndustries: any[];
  topModels: any[];
  topPrompts: any[];
  [key: string]: any;
}

interface ContentStudioProps {
  adminData: AdminData;
}

const INTERNAL_CENTERS = [
  { id: 'metrics', label: 'Métricas de plataforma', icon: '📊', desc: 'Usuarios, completitud y crecimiento' },
  { id: 'trends', label: 'Tendencias de mercado', icon: '📈', desc: 'Industrias, países y modelos más comunes' },
  { id: 'patterns', label: 'Patrones de validación', icon: '🧩', desc: 'Scores, abandono y comportamiento' },
  { id: 'ai', label: 'AI Usage', icon: '🤖', desc: 'Modelos, tokens y tipos de prompts' },
];

const FRAMES = [
  { id: 'PAS', label: 'Problema, Agitación, Solución', desc: 'Ideal para educar sobre un dolor' },
  { id: 'AIDA', label: 'Atención, Interés, Deseo, Acción', desc: 'Ideal para generar interés y conversión' },
  { id: 'HERO', label: 'El Viaje del Héroe', desc: 'Narrativa inspiradora basada en casos de éxito' },
];

const THEMES: { value: CarouselTheme; label: string; icon: string }[] = [
  { value: 'clean', label: 'Clean', icon: '⬜' },
  { value: 'dark', label: 'Dark', icon: '⬛' },
  { value: 'gradient', label: 'Gradient', icon: '🌈' },
];

const PLATFORMS: { value: CarouselPlatform; label: string; desc: string; icon: string }[] = [
  { value: 'linkedin', label: 'LinkedIn', desc: 'PDF · Cuadrado 1:1', icon: '💼' },
  { value: 'instagram', label: 'Instagram', desc: 'PNG ZIP · Vertical 4:5', icon: '📸' },
];

export function ContentStudio({ adminData }: ContentStudioProps) {
  // Tabs: 'internal' | 'api' | 'manual'
  const [activeTab, setActiveTab] = useState<'internal' | 'api' | 'manual'>('internal');
  
  // Internal State
  const [selectedCenter, setSelectedCenter] = useState('metrics');
  
  // API State
  const [apiProvider, setApiProvider] = useState<'cmf' | 'sii'>('cmf');
  const [cmfIndicator, setCmfIndicator] = useState('dolar');
  const [siiEndpoint, setSiiEndpoint] = useState('uf_mes');
  const [siiParam, setSiiParam] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  const [dbKnowledge, setDbKnowledge] = useState<any[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);

  // Manual State
  const [customData, setCustomData] = useState('');

  // Config State
  const [selectedFrame, setSelectedFrame] = useState('PAS');
  const { platform, theme, setPlatform, setTheme, generateStory, status } = useCarouselStore();

  useEffect(() => {
    if (activeTab === 'api') {
      fetchKnowledgeBase();
    }
  }, [activeTab]);

  const fetchKnowledgeBase = async () => {
    setLoadingKnowledge(true);
    try {
      const { data, error } = await supabase
        .from('economic_knowledge')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      setDbKnowledge(data || []);
    } catch (err) {
      console.error('Error fetching knowledge base', err);
    } finally {
      setLoadingKnowledge(false);
    }
  };

  const handleSyncAPI = async () => {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      let payload = {};
      if (apiProvider === 'cmf') {
        payload = { provider: 'CMF', indicator: cmfIndicator };
      } else {
        payload = { provider: 'SII', indicator: siiEndpoint, param: siiParam };
      }

      const { data, error } = await supabase.functions.invoke('sync-economic-data', {
        body: payload
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSyncMessage({ type: 'success', text: 'Datos sincronizados correctamente en la BD' });
      fetchKnowledgeBase(); // refresh
    } catch (err) {
      setSyncMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al sincronizar API' });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleGenerate = () => {
    let finalCustomData = customData;
    let finalCenter = selectedCenter;

    if (activeTab === 'api') {
      finalCenter = `RAG APIs Económicas`;
      // We send ALL the cached knowledge base entries as context so the AI can use them.
      // In a real RAG with large DB we'd use vector search. Here we just serialize the table.
      const recentContext = dbKnowledge.map(k => `${k.provider} - ${k.indicator} (Actualizado: ${new Date(k.updated_at).toLocaleDateString()}):\n${k.context_text}`).join('\n\n');
      finalCustomData = recentContext || 'No hay datos en caché aún.';
    } else if (activeTab === 'manual') {
      finalCenter = 'Data Manual / RAG';
    } else {
      finalCustomData = ''; // internal data only
    }

    generateStory(finalCenter, selectedFrame, finalCustomData, adminData);
  };

  const getInternalPreview = () => {
    switch (selectedCenter) {
      case 'metrics':
        return {
          'Total Usuarios': adminData.usersTotal,
          'Total Validaciones': adminData.validationsTotal,
          'Completadas': adminData.completedValidations,
        };
      case 'trends':
        return {
          'Top Industrias': adminData.topIndustries.slice(0, 3).map((i: any) => i.name).join(', '),
        };
      case 'ai':
        return {
          'Total Interacciones AI': adminData.aiInteractionsTotal,
          'Modelos Dominantes': adminData.topModels.slice(0, 2).map((m: any) => m.name).join(', '),
          'Prompt más usado': adminData.topPrompts[0]?.type || 'N/A',
        };
      case 'patterns':
        return {
          'Completitud': `${Math.round((adminData.completedValidations / Math.max(1, adminData.validationsTotal)) * 100)}%`,
        };
      default:
        return {};
    }
  };

  return (
    <div className="space-y-8">
      {/* ── 1. Configuración de Fuente y Narrativa ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Izquierda: Selección de datos */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#12121A] p-6 rounded-2xl border border-gray-100 dark:border-white/5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-4 uppercase tracking-wide">
              1. Selecciona la fuente de datos
            </h2>

            {/* TABS */}
            <div className="flex bg-gray-100 dark:bg-[#0A0A0F] p-1 rounded-xl mb-6">
              {[
                { id: 'internal', label: '📊 Validaciones' },
                { id: 'api', label: '🌐 APIs Públicas (RAG)' },
                { id: 'manual', label: '🧠 Manual' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${
                    activeTab === tab.id 
                      ? 'bg-white dark:bg-[#1C1C24] text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* CONTENIDO TAB INTERNA */}
            {activeTab === 'internal' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {INTERNAL_CENTERS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCenter(c.id)}
                      className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left
                        ${selectedCenter === c.id
                          ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-500/10'
                          : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                        }`}
                    >
                      <span className="text-xl mb-1">{c.icon}</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{c.label}</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{c.desc}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 dark:text-[#C4C4D4]">Preview de datos internos</p>
                  <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl p-4 text-xs font-mono text-gray-600 dark:text-gray-300">
                    {Object.entries(getInternalPreview()).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-gray-200/50 dark:border-white/5 last:border-0">
                        <span>{k}:</span>
                        <span className="font-bold">{v as React.ReactNode}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO TAB APIs PUBLICAS (RAG) */}
            {activeTab === 'api' && (
              <div className="space-y-5 animate-in fade-in">
                
                {/* Visualización del Knowledge Base (RAG) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-gray-700 dark:text-[#C4C4D4]">Base de Conocimiento Económico (Caché)</p>
                    <button onClick={fetchKnowledgeBase} className="text-xs text-teal-500 hover:text-teal-600">🔄 Actualizar vista</button>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl p-3 h-40 overflow-y-auto">
                    {loadingKnowledge ? (
                      <p className="text-xs text-gray-500 text-center py-4">Cargando base de conocimiento...</p>
                    ) : dbKnowledge.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">Aún no has sincronizado ningún dato. Sincroniza desde abajo.</p>
                    ) : (
                      <ul className="space-y-2">
                        {dbKnowledge.map(k => (
                          <li key={k.id} className="flex justify-between items-center text-xs border-b border-gray-200/50 dark:border-white/5 pb-2 last:border-0">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{k.provider} - {k.indicator}</span>
                            <span className="text-gray-500">{new Date(k.updated_at).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 leading-tight">
                    *Al generar el carrusel, la IA leerá **toda esta tabla** sin consumir tokens de la API Gateway.
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-white/10">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-3">Sincronizar Nueva Información (Gasta Créditos/Tokens)</h3>
                  
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setApiProvider('cmf')}
                      className={`flex-1 py-2 text-xs font-bold border rounded-lg ${apiProvider === 'cmf' ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400' : 'border-gray-200 dark:border-white/10 text-gray-500'}`}
                    >
                      🏦 CMF Chile
                    </button>
                    <button
                      onClick={() => setApiProvider('sii')}
                      className={`flex-1 py-2 text-xs font-bold border rounded-lg ${apiProvider === 'sii' ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400' : 'border-gray-200 dark:border-white/10 text-gray-500'}`}
                    >
                      🏢 SII (API Gateway)
                    </button>
                  </div>

                  {apiProvider === 'cmf' && (
                    <div className="space-y-3 mb-4">
                      <select
                        value={cmfIndicator}
                        onChange={(e) => setCmfIndicator(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-teal-500"
                      >
                        <option value="dolar">Dólar</option>
                        <option value="euro">Euro</option>
                        <option value="uf">Unidad de Fomento (UF)</option>
                        <option value="utm">Unidad Tributaria Mensual (UTM)</option>
                      </select>
                    </div>
                  )}

                  {apiProvider === 'sii' && (
                    <div className="space-y-4 mb-4">
                      <div className="space-y-3">
                        <select
                          value={siiEndpoint}
                          onChange={(e) => setSiiEndpoint(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-teal-500"
                        >
                          <option value="uf_mes">UF Mensual</option>
                          <option value="uf_anio">UF Anual</option>
                          <option value="corr_monetaria">Corrección Monetaria Anual</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={siiParam}
                          onChange={(e) => setSiiParam(e.target.value)}
                          placeholder={siiEndpoint.includes('mes') ? 'YYYY-MM' : 'YYYY'}
                          className="w-full bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSyncAPI}
                    disabled={syncLoading}
                    className="w-full py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold text-xs rounded-lg transition-all shadow-sm"
                  >
                    {syncLoading ? 'Sincronizando y guardando...' : '📥 Llamar a API y Guardar en Caché'}
                  </button>

                  {syncMessage && (
                    <div className={`mt-3 p-3 text-xs rounded-xl border ${
                      syncMessage.type === 'error' 
                        ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                        : 'bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                    }`}>
                      {syncMessage.text}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* CONTENIDO TAB MANUAL */}
            {activeTab === 'manual' && (
              <div className="space-y-2 animate-in fade-in">
                <label className="text-xs font-semibold text-gray-700 dark:text-[#C4C4D4]">
                  Pega contexto directo, recortes de PDF o outputs de tu RAG manual:
                </label>
                <textarea
                  value={customData}
                  onChange={(e) => setCustomData(e.target.value)}
                  placeholder="Ej: Según el reporte de tendencias tecnológicas del Q3..."
                  rows={8}
                  className="w-full bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Derecha: Configuración Narrativa y Visual */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#12121A] p-6 rounded-2xl border border-gray-100 dark:border-white/5">
            <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-4 uppercase tracking-wide">
              2. Formato y Narrativa
            </h2>
            
            <div className="space-y-5">
              {/* Frame */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Marco Narrativo</label>
                <div className="flex flex-col gap-2">
                  {FRAMES.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFrame(f.id)}
                      className={`px-3 py-2 text-left rounded-lg border text-xs ${
                        selectedFrame === f.id
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400'
                          : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <span className="font-bold">{f.id}</span> — <span className="opacity-80">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plataforma */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Plataforma</label>
                <div className="flex gap-3">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPlatform(p.value)}
                      className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all
                        ${platform === p.value
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                          : 'border-gray-200 dark:border-white/10 hover:border-gray-300'
                        }`}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <div>
                        <p className="font-bold text-xs text-gray-900 dark:text-[#F0EFF8]">{p.label}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tema */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Tema visual</label>
                <div className="flex gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
                        ${theme === t.value
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400'
                          : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8B8AA0] hover:border-gray-400'
                        }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={status === 'generating'}
                className="w-full py-3 mt-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {status === 'generating' ? 'Generando narrativa...' : '✨ Generar Carrusel'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Editor de Carrusel ── */}
      <div className="bg-white dark:bg-[#12121A] p-6 rounded-2xl border border-gray-100 dark:border-white/5">
        <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-4 uppercase tracking-wide">
          3. Editor y Exportación
        </h2>
        {status === 'idle' ? (
          <div className="py-12 text-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
            <span className="text-4xl mb-2 block">🖌️</span>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Configura tus datos y haz clic en "Generar Carrusel" para empezar
            </p>
          </div>
        ) : (
          <CarouselEditor hideConfig />
        )}
      </div>
    </div>
  );
}
