interface ScoreGaugeProps {
  score: number;
}

const getScoreConfig = (score: number) => {
  if (score >= 70) return {
    color: '#059669', bg: '#d1fae5', border: '#a7f3d0',
    label: 'Bien validada', emoji: '🎉',
  };
  if (score >= 40) return {
    color: '#d97706', bg: '#fef3c7', border: '#fde68a',
    label: 'Validación parcial', emoji: '📈',
  };
  return {
    color: '#dc2626', bg: '#fee2e2', border: '#fecaca',
    label: 'Necesita trabajo', emoji: '💪',
  };
};

export function ScoreGauge({ score }: ScoreGaugeProps) {
  const config = getScoreConfig(score);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const gap = circumference - progress;

  return (
    <div className="flex flex-col items-center gap-3 shrink-0">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="14" />
          {/* Progress */}
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={config.color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${gap}`}
            style={{ transition: 'stroke-dasharray 1.2s ease-out' }}
          />
        </svg>
        {/* Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black leading-none" style={{ color: config.color }}>
            {score}
          </span>
          <span className="text-xs text-gray-400 font-medium mt-0.5">/ 100</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2"
        style={{ background: config.bg, borderColor: config.border, color: config.color }}>
        <span>{config.emoji}</span>
        {config.label}
      </div>
    </div>
  );
}
