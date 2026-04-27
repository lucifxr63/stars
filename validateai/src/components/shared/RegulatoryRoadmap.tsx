import { useMemo } from 'react';
import { getRegulatoryItems } from '@/data/regulatoryData';

interface Props {
  industry: string;
}

const URGENCY_CONFIG = {
  critical:      { label: 'Crítico',       className: 'bg-red-100 text-red-700 border-red-200' },
  important:     { label: 'Importante',    className: 'bg-amber-100 text-amber-700 border-amber-200' },
  informational: { label: 'Informativo',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export function RegulatoryRoadmap({ industry }: Props) {
  const items = useMemo(() => getRegulatoryItems(industry), [industry]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
          <span className="text-base">⚖️</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Marco regulatorio Chile</p>
          <p className="text-xs text-gray-400">{items.length} regulacion{items.length !== 1 ? 'es' : ''} relevante{items.length !== 1 ? 's' : ''} para tu industria</p>
        </div>
      </div>

      {items.map((item) => {
        const urgency = URGENCY_CONFIG[item.urgency];
        return (
          <div key={item.id} className="border border-gray-100 rounded-2xl p-4 hover:border-gray-200 dark:border-white/10 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="font-semibold text-gray-900 dark:text-[#F0EFF8] text-sm flex-1">{item.title}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${urgency.className}`}>
                {urgency.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-2">{item.entity}</p>
            <p className="text-xs text-gray-600 dark:text-[#8B8AA0] leading-relaxed mb-3">{item.description}</p>
            <ul className="space-y-1 mb-3">
              {item.keyPoints.map((point) => (
                <li key={point} className="text-xs text-gray-600 dark:text-[#8B8AA0] flex gap-1.5">
                  <span className="text-gray-400 shrink-0 mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800 transition-colors"
              >
                Ver normativa oficial
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
