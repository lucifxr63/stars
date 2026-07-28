import { Zap, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  tier: string;
  usageCount?: number;
  limitCount?: number;
  className?: string;
}

export function AnimusQuotaWidget({ tier, usageCount = 0, limitCount = 100, className = '' }: Props) {
  const navigate = useNavigate();

  const isUnlimited = tier === 'pro' || tier === 'premium' || tier === 'admin';
  const pct = isUnlimited ? 100 : Math.min(100, Math.round((usageCount / (limitCount || 1)) * 100));

  const tierColors: Record<string, { bg: string; text: string; border: string }> = {
    free: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' },
    basic: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    pro: { bg: 'bg-[#0EB5C6]/10', text: 'text-[#0EB5C6]', border: 'border-[#0EB5C6]/20' },
    premium: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
    admin: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  };

  const style = tierColors[tier.toLowerCase()] ?? tierColors.free;

  return (
    <div className={`p-4 rounded-2xl bg-[#12121A] border border-white/10 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#0EB5C6]/10 text-[#0EB5C6]">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              Créditos Animus RaaS
              <span className={`text-[10px] uppercase font-mono px-2 py-0.2 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                {tier}
              </span>
            </p>
            <p className="text-[11px] text-[#C4C4D4]">Motor MoE GraphRAG & Doctrina</p>
          </div>
        </div>

        {!isUnlimited && (
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#0EB5C6] hover:bg-[#0EB5C6]/90 text-black text-xs font-semibold transition-all shadow-sm shadow-[#0EB5C6]/20"
          >
            Upgrade
            <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Barra de Progreso de Consumo */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/60">Consultas mensuales</span>
          <span className="font-mono text-white font-medium">
            {isUnlimited ? 'Ilimitado' : `${usageCount} / ${limitCount}`}
          </span>
        </div>

        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-400' : 'bg-[#0EB5C6]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {isUnlimited && (
        <div className="flex items-center gap-1.5 text-[11px] text-[#2DD4BF] pt-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Acceso total sin restricciones a Animus Intelligence</span>
        </div>
      )}
    </div>
  );
}
