import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface UsageGaugeProps {
  used: number;
  limit: number;
  tierLabel: string;
}

interface GaugeConfig {
  color: string;
  bg: string;
  border: string;
  label: string;
  textColor: string;
}

function getConfig(pct: number): GaugeConfig {
  if (pct >= 1)   return { color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.25)',   label: 'Límite alcanzado', textColor: '#dc2626' };
  if (pct >= 0.8) return { color: '#d97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.25)',   label: 'Casi al límite',   textColor: '#d97706' };
  if (pct >= 0.5) return { color: '#059669', bg: 'rgba(5,150,105,0.08)',   border: 'rgba(5,150,105,0.25)',   label: 'Uso normal',        textColor: '#059669' };
  return           { color: '#059669', bg: 'rgba(5,150,105,0.06)',   border: 'rgba(5,150,105,0.15)',   label: 'En uso',            textColor: '#059669' };
}

// Calcula días restantes hasta el próximo ciclo de 30 días
function daysUntilReset(): number {
  const now = new Date();
  const resetDay = new Date(now);
  resetDay.setDate(now.getDate() + (30 - (now.getDate() % 30)));
  return Math.max(1, Math.ceil((resetDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function UsageGauge({ used, limit, tierLabel }: UsageGaugeProps) {
  const pct    = Math.min(used / Math.max(limit, 1), 1);
  const config = getConfig(pct);

  // Animar desde 0 al valor real en el primer render
  const [displayPct, setDisplayPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDisplayPct(pct), 60);
    return () => clearTimeout(t);
  }, [pct]);

  const radius  = 44;
  const circ    = 2 * Math.PI * radius;
  const arcLen  = circ * 0.75;                   // 270° de arco (tacómetro)
  const progress = arcLen * displayPct;

  const showUpsell  = pct >= 0.8;
  const daysLeft    = daysUntilReset();
  const remaining   = Math.max(0, limit - used);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Gauge SVG */}
      <div className="relative w-28 h-28" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label={`Cuota: ${used} de ${limit} validaciones usadas`}>
        <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: 'rotate(135deg)' }}>
          {/* Track */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circ}`}
            className="dark:[stroke:rgba(255,255,255,0.08)]"
          />
          {/* Progress — animado via CSS transition */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={config.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circ}`}
            style={{
              transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)',
              filter: `drop-shadow(0 0 6px ${config.color}60)`,
            }}
          />
        </svg>

        {/* Centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-2xl font-black leading-none tabular-nums" style={{ color: config.color }}>
            {used}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-[#4A495E] font-medium">
            / {limit}
          </span>
        </div>
      </div>

      {/* Estado + tier */}
      <div
        className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
        style={{ background: config.bg, borderColor: config.border, color: config.textColor }}
      >
        {tierLabel} · {config.label}
      </div>

      {/* Info secundaria */}
      <div className="text-center space-y-0.5">
        {remaining > 0 && pct < 1 ? (
          <p className="text-[10px] text-gray-400 dark:text-[#4A495E]">
            {remaining} restante{remaining !== 1 ? 's' : ''} este mes
          </p>
        ) : null}
        <p className="text-[10px] text-gray-400 dark:text-[#4A495E]">
          Reset en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
        </p>
      </div>

      {/* CTA upsell: aparece al 80% */}
      {showUpsell && (
        <Link
          to="/pricing"
          className="mt-0.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-[#0EB5C6] text-white
                     hover:bg-[#6B5FE6] active:scale-[0.97] transition-all
                     shadow-sm shadow-[#0EB5C6]/30 whitespace-nowrap"
        >
          {pct >= 1 ? 'Desbloquear más →' : 'Mejorar plan →'}
        </Link>
      )}
    </div>
  );
}
