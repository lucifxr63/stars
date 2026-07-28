import { useState } from 'react';
import { ShieldAlert, BookOpen, Clock, Copy, Check, ExternalLink, Database, Layers } from 'lucide-react';
import { toast } from 'sonner';

export interface AnimusEvidenceItem {
  id?: string;
  claim: string;
  shape?: 'financial' | 'doctrine';
  date?: string;
  indicator?: string;
  value?: number | string;
  unit?: string;
  source?: string;
  source_url?: string;
  entity_value?: string;
  dimension?: string;
  threshold?: number;
  severity?: 'info' | 'warning' | 'critical';
}

export interface AnimusAlertItem {
  title: string;
  severity: 'info' | 'warning' | 'critical';
  description?: string;
}

interface Props {
  evidences: AnimusEvidenceItem[];
  alerts?: AnimusAlertItem[];
  dataFreshness?: Record<string, string> | null;
  className?: string;
}

export function AnimusEvidenceWall({ evidences = [], alerts = [], dataFreshness, className = '' }: Props) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCitation = (item: AnimusEvidenceItem, index: number) => {
    let citation = '';
    if (item.shape === 'financial') {
      const val = typeof item.value === 'number' ? item.value.toLocaleString('es-CL') : item.value ?? '';
      const src = item.source ? ` (Fuente: ${item.source})` : '';
      citation = `[Dato ${item.date ?? 'reciente'}] ${item.claim}: ${val}${item.unit ?? ''}${src}`;
    } else {
      const dim = item.dimension ? ` / ${item.dimension}` : '';
      citation = `[Doctrina] ${item.entity_value ?? item.claim}${dim}`;
    }

    navigator.clipboard.writeText(citation);
    setCopiedIndex(index);
    toast.success('Cita copiada al portapapeles');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (evidences.length === 0 && alerts.length === 0) {
    return (
      <div className={`p-6 rounded-2xl bg-[#12121A] border border-white/5 text-center ${className}`}>
        <Database className="w-8 h-8 text-[#0EB5C6]/40 mx-auto mb-2" />
        <p className="text-sm font-medium text-[#C4C4D4]">Sin evidencias macro o doctrina asociadas a este perfil</p>
        <p className="text-xs text-white/40 mt-1">El motor GraphRAG Animus se actualiza constantemente.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Cabecera del Muro de Evidencias */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#0EB5C6]/10 text-[#0EB5C6]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Evidencias Citables Animus
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0EB5C6]/20 text-[#0EB5C6] font-mono border border-[#0EB5C6]/30">
                GraphRAG MoE
              </span>
            </h4>
            <p className="text-xs text-[#C4C4D4]">Evidencia verificada y doctrina legal de grado institucional</p>
          </div>
        </div>

        {dataFreshness && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/50 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
            <Clock className="w-3.5 h-3.5 text-[#2DD4BF]" />
            <span>Verificado: {Object.values(dataFreshness)[0] ?? 'Reciente'}</span>
          </div>
        )}
      </div>

      {/* Alertas de Alerta/Riesgo (Familia A) */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                alert.severity === 'critical'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              }`}
            >
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold uppercase tracking-wider text-[10px] opacity-80">
                  Alerta Regulatoria / Macro — {alert.severity}
                </p>
                <p className="font-medium text-white">{alert.title}</p>
                {alert.description && <p className="text-white/70 leading-relaxed">{alert.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid de Tarjetas de Evidencia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {evidences.map((item, idx) => {
          const isFinancial = item.shape === 'financial';

          return (
            <div
              key={idx}
              className="group relative p-4 rounded-xl bg-[#12121A]/80 border border-white/5 hover:border-[#0EB5C6]/30 transition-all duration-200 backdrop-blur-sm flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                      isFinancial
                        ? 'bg-[#0EB5C6]/15 text-[#0EB5C6] border border-[#0EB5C6]/20'
                        : 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                    }`}
                  >
                    {isFinancial ? <Database className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                    {isFinancial ? 'Dato Macro' : 'Doctrina'}
                  </span>

                  {item.date && (
                    <span className="text-[11px] font-mono text-white/40 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.date}
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium text-white/90 leading-relaxed group-hover:text-white transition-colors">
                  {item.claim || item.entity_value}
                </p>

                {isFinancial && item.value !== undefined && (
                  <div className="text-sm font-bold text-[#2DD4BF] font-mono pt-1">
                    {typeof item.value === 'number' ? item.value.toLocaleString('es-CL') : item.value}{' '}
                    <span className="text-xs text-white/50 font-normal">{item.unit}</span>
                  </div>
                )}
              </div>

              {/* Pie de tarjeta con fuente y acción */}
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-white/40 truncate max-w-[180px]">
                  {item.source ? `Fuente: ${item.source}` : 'Verificado Animus'}
                </span>

                <div className="flex items-center gap-1.5">
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                      title="Ver fuente original"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => handleCopyCitation(item, idx)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-[#0EB5C6]/20 text-white/60 hover:text-[#0EB5C6] transition-all text-[10px] font-medium"
                    title="Copiar cita formatada"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="w-3 h-3 text-[#2DD4BF]" />
                        <span className="text-[#2DD4BF]">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Citar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
