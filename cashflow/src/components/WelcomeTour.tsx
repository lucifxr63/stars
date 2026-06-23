import { useState, type ReactNode } from 'react';
import { Wallet, Landmark, FileText, Repeat, Eye, LineChart, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Slide {
  icon: ReactNode;
  title: string;
  body: ReactNode;
}

const SLIDES: Slide[] = [
  {
    icon: <Wallet className="size-6" />,
    title: 'Bienvenido a Cashflow',
    body: 'Tu CFO virtual: proyecta tu Runway y Burn Rate en tiempo real. En un par de minutos sabrás en qué semana podrías quedarte sin caja — y cómo evitarlo.',
  },
  {
    icon: <Landmark className="size-6" />,
    title: '1 · Configura tu caja',
    body: 'Crea tu cuenta bancaria con el saldo de hoy. Es el ancla de toda tu proyección. Luego puedes agregar más cuentas desde la tarjeta "Cuentas".',
  },
  {
    icon: <FileText className="size-6" />,
    title: '2 · Carga tus facturas',
    body: (
      <>
        Registra cuentas <b>por cobrar (A/R)</b> y <b>por pagar (A/P)</b> a mano… o <b>arrastra el PDF</b> y la IA extrae los datos en segundos.
        Solo acepta facturas reales: si subes una cotización, te la bloquea para no ensuciar tu proyección.
      </>
    ),
  },
  {
    icon: <Repeat className="size-6" />,
    title: '3 · Piloto Automático (Fijos)',
    body: (
      <>
        Carga <b>una sola vez</b> tus ingresos fijos (igualas, MRR) y gastos fijos (nómina, arriendo, suscripciones). El motor los proyecta a 90 días
        sin que tengas que registrarlos mes a mes.
      </>
    ),
  },
  {
    icon: <Eye className="size-6" />,
    title: 'Afina tu proyección',
    body: (
      <>
        En <b>Ajustes</b> define tu tasa de impuestos (ej. 19% IVA): Cashflow aparta ese % de cada ingreso para que tu Runway no mienta
        (lo verás en "Caja Restringida"). Y con el <b>ojo 👁</b> en cualquier factura o fijo puedes ocultarlo y simular al instante: <i>"¿y si este cliente no me paga?"</i>.
      </>
    ),
  },
  {
    icon: <LineChart className="size-6" />,
    title: 'Tu proyección, lista',
    body: (
      <>
        El gráfico muestra tu <b>saldo disponible a 90 días</b>, marca tu punto más bajo, y el <b>Resolution Center</b> te avisa de cobros vencidos.
        Cambia entre vista diaria, semanal y mensual. ¡A tomar el control de tu caja!
      </>
    ),
  },
];

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  if (!open) return null;
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-2xl">
        <div className="mb-5 grid size-12 place-items-center rounded-xl bg-primary/15 text-primary">{slide.icon}</div>
        <h2 className="text-xl font-semibold">{slide.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{slide.body}</p>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Paso ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground/50'}`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            Saltar
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setI((n) => n - 1)}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Atrás
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onClose() : setI((n) => n + 1))}>
              {last ? 'Empezar' : 'Siguiente'}
              {!last && <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
