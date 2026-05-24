import { Compass } from 'lucide-react';

interface EmptyStateAIProps {
  title?: string;
  description?: string;
  className?: string;
}

export function EmptyStateAI({
  title = 'Validación Pionera',
  description = 'Tu idea opera en un espacio de mercado emergente que aún no está representado en nuestras fuentes verificadas. Para obtener un análisis más preciso, prueba con otra combinación de industria o modelo de negocio, o procede con entrevistas cualitativas directas.',
  className = '',
}: EmptyStateAIProps) {
  return (
    <div className={`rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex flex-col items-center text-center gap-4 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
        <Compass className="h-6 w-6 text-amber-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-amber-300">{title}</p>
        <p className="text-xs text-gray-400 leading-relaxed max-w-sm">{description}</p>
      </div>
    </div>
  );
}
