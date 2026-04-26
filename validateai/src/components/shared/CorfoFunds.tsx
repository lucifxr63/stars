import { useMemo } from 'react';
import { matchCorfoInstruments } from '@/data/corfoInstruments';

interface Props {
  stage: string;
  industry: string;
  businessModel: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  seed: 'bg-green-100 text-green-700 border-green-200',
  innovation: 'bg-blue-100 text-blue-700 border-blue-200',
  acceleration: 'bg-violet-100 text-violet-700 border-violet-200',
  internationalization: 'bg-amber-100 text-amber-700 border-amber-200',
  credit: 'bg-gray-100 text-gray-700 border-gray-200',
};

const CATEGORY_LABELS: Record<string, string> = {
  seed: 'Capital semilla',
  innovation: 'Innovación',
  acceleration: 'Aceleración',
  internationalization: 'Internacionalización',
  credit: 'Crédito',
};

function fmtClp(n: number | null): string {
  if (!n) return '—';
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M CLP` : `$${(n / 1_000).toFixed(0)}K CLP`;
}

export function CorfoFunds({ stage, industry, businessModel }: Props) {
  const matches = useMemo(
    () => matchCorfoInstruments({ stage, industry, businessModel }),
    [stage, industry, businessModel],
  );

  if (matches.length === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl p-5 text-center">
        <p className="text-sm text-gray-500">No se encontraron instrumentos CORFO aplicables en esta etapa e industria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
          <span className="text-base">🇨🇱</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">Fondos CORFO aplicables</p>
          <p className="text-xs text-gray-400">{matches.length} instrumento{matches.length !== 1 ? 's' : ''} relevante{matches.length !== 1 ? 's' : ''} para tu etapa</p>
        </div>
      </div>

      {matches.map(({ instrument: inst, matchScore, matchReasons }) => (
        <div key={inst.id} className="border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-colors">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-sm">{inst.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${CATEGORY_COLORS[inst.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {CATEGORY_LABELS[inst.category] ?? inst.category}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-black text-teal-600">{matchScore}%</p>
              <p className="text-[10px] text-gray-400">match</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 mb-3 leading-relaxed">{inst.description}</p>

          <div className="flex items-center gap-4 mb-3">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Monto máx.</p>
              <p className="text-sm font-bold text-gray-800">{fmtClp(inst.maxAmountClp)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Etapas</p>
              <p className="text-sm font-bold text-gray-800 capitalize">{inst.stages.join(', ')}</p>
            </div>
          </div>

          {matchReasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {matchReasons.map((r) => (
                <span key={r} className="text-[11px] px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full font-medium">✓ {r}</span>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Requisitos principales</p>
            {inst.requirements.slice(0, 2).map((req) => (
              <p key={req} className="text-xs text-gray-500">• {req}</p>
            ))}
          </div>

          <a
            href={inst.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800 transition-colors"
          >
            Ver en CORFO
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      ))}
    </div>
  );
}
