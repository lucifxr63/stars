import { useEffect, useRef } from 'react';
import { useUserTier } from '@/hooks/useUserTier';
import { trackTelemetryEvent } from '@/lib/telemetry';

export interface BraliduAlert {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
}

const SEVERITY_CONFIG = {
  critical: {
    border: 'border-red-200 dark:border-red-800/40',
    bg:     'bg-red-50 dark:bg-red-900/10',
    dot:    'bg-red-500',
    text:   'text-red-700 dark:text-red-400',
    label:  'RIESGO CRÍTICO',
  },
  warning: {
    border: 'border-amber-200 dark:border-amber-700/40',
    bg:     'bg-amber-50 dark:bg-amber-900/10',
    dot:    'bg-amber-500',
    text:   'text-amber-700 dark:text-amber-400',
    label:  'ALERTA',
  },
  info: {
    border: 'border-blue-200 dark:border-blue-700/30',
    bg:     'bg-blue-50 dark:bg-blue-900/10',
    dot:    'bg-blue-500',
    text:   'text-blue-700 dark:text-blue-400',
    label:  'CONTEXTO',
  },
} as const;

function AlertBadge({ severity }: { severity: BraliduAlert['severity'] }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function AlertRow({ alert }: { alert: BraliduAlert }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 dark:border-white/5 last:border-0">
      <AlertBadge severity={alert.severity} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFF8] leading-snug">{alert.title}</p>
        <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0] mt-0.5">{alert.category}</p>
      </div>
    </div>
  );
}

function PaywallOverlay({ currentTier }: { currentTier: string }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-60 space-y-2 p-4">
        {(['critical', 'warning', 'warning', 'info'] as const).map((sev, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <AlertBadge severity={sev} />
            <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-48" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 dark:bg-[#12121A]/80 rounded-xl backdrop-blur-[2px]">
        <svg className="w-7 h-7 text-gray-400 dark:text-[#4A495E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <div className="text-center px-4">
          <p className="text-sm font-bold text-gray-800 dark:text-[#F0EFF8]">Análisis adversarial PRO</p>
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-1 max-w-[220px] leading-relaxed">
            Detecta riesgos legales, CAC distorsionado y alertas regulatorias antes que los inversores.
          </p>
        </div>
        <a
          href="/pricing"
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#0EB5C6] text-white text-xs font-bold hover:bg-[#0EB5C6]/90 transition-colors cursor-pointer"
        >
          Desbloquear con PRO
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </a>
        <p className="text-[10px] text-gray-400 dark:text-[#4A495E]">Plan actual: {currentTier.toUpperCase()}</p>
      </div>
    </div>
  );
}

interface Props {
  alerts: BraliduAlert[];
  isLoading?: boolean;
}

export function RiskIntelligencePanel({ alerts, isLoading = false }: Props) {
  const { tier } = useUserTier();
  const isPaid = tier === 'pro' || tier === 'premium' || tier === 'admin';
  const paywallFired = useRef(false);

  useEffect(() => {
    if (isLoading || isPaid || paywallFired.current) return;
    paywallFired.current = true;
    trackTelemetryEvent({
      event_name: 'paywall_hit',
      context: {
        tier: (tier === 'basic' ? 'basic' : 'free'),
        action_taken: 'bralidus_panel_blocked',
        feature_name: 'risk_intelligence_panel',
      },
    });
  }, [isLoading, isPaid, tier]);

  const criticals = alerts.filter(a => a.severity === 'critical');
  const warnings  = alerts.filter(a => a.severity === 'warning');
  const infos     = alerts.filter(a => a.severity === 'info');
  const ordered   = [...criticals, ...warnings, ...infos];

  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#0EB5C6]/10 border border-[#0EB5C6]/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[#0EB5C6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-[#F0EFF8]">Inteligencia de Riesgo</p>
            <p className="text-[10px] text-gray-400 dark:text-[#4A495E]">Powered by BralidusPY · GraphRAG</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          isPaid
            ? 'bg-[#0EB5C6]/10 border-[#0EB5C6]/20 text-[#0EB5C6]'
            : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-[#4A495E]'
        }`}>
          {isPaid ? 'PRO' : 'FREE'}
        </span>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="h-5 w-20 bg-gray-100 dark:bg-white/5 rounded-full animate-pulse" />
              <div className="h-4 bg-gray-100 dark:bg-white/5 rounded flex-1 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Paywall for free/basic */}
      {!isLoading && !isPaid && (
        <PaywallOverlay currentTier={tier ?? 'free'} />
      )}

      {/* Alerts for paid tier */}
      {!isLoading && isPaid && ordered.length > 0 && (
        <div className="divide-y divide-gray-50 dark:divide-white/5">
          {ordered.map((alert, i) => (
            <AlertRow key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* Empty state for paid with no alerts */}
      {!isLoading && isPaid && ordered.length === 0 && (
        <div className="flex items-center gap-3 py-3">
          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            Sin alertas Familia A detectadas para este perfil.
          </p>
        </div>
      )}

      {/* Counter badge */}
      {!isLoading && isPaid && criticals.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5">
          <p className="text-[10px] text-gray-400 dark:text-[#4A495E]">
            {criticals.length} riesgo{criticals.length > 1 ? 's' : ''} crítico{criticals.length > 1 ? 's' : ''} ·{' '}
            {warnings.length} alerta{warnings.length !== 1 ? 's' : ''} ·{' '}
            {infos.length} contexto{infos.length !== 1 ? 's' : ''} de inteligencia
          </p>
        </div>
      )}
    </div>
  );
}
