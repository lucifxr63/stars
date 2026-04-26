const MESSAGES = [
  'Analizando tu idea...',
  'Consultando con el mentor AI...',
  'Generando preguntas de validación...',
  'Procesando contexto del mercado...',
  'Casi listo...',
];

export function LoadingAI({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-500 animate-pulse">
        {message ?? MESSAGES[Math.floor(Math.random() * MESSAGES.length)]}
      </p>
    </div>
  );
}
