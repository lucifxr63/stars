import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, ShieldCheck, Zap, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: TrendingUp,
    title: 'Ingresos y egresos',
    desc: 'Registra cada movimiento y clasifícalo por categoría. Tu saldo, siempre al día.',
  },
  {
    icon: Zap,
    title: 'Liquidez en tiempo real',
    desc: 'Consultas que responden en milisegundos. Sabe cuánta caja tienes ahora, no la semana pasada.',
  },
  {
    icon: ShieldCheck,
    title: 'Datos aislados y seguros',
    desc: 'Aislamiento estricto por negocio (RLS). Tus números son solo tuyos, sin fugas entre cuentas.',
  },
];

export function Landing() {
  return (
    <div className="min-h-screen">
      {/* Nav flotante */}
      <header className="fixed inset-x-4 top-4 z-30 mx-auto flex max-w-6xl items-center justify-between rounded-xl border border-border bg-card/60 px-5 py-3 backdrop-blur-xl">
        <span className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          Cashflow
        </span>
        <Link to="/login">
          <Button size="sm" variant="ghost">
            Iniciar sesión
          </Button>
        </Link>
      </header>

      {/* Hero */}
      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-40">
          {/* Glow de fondo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-24 -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]"
          />
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-primary" />
              Para PYMEs y startups en LatAm
            </span>
            <h1 className="mt-6 text-balance text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              El flujo de caja de tu negocio, <span className="text-primary">claro y al instante</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
              Controla ingresos, egresos y liquidez sin planillas. Cashflow te da una foto en tiempo real
              de cuánta caja tienes, hoy.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Empieza gratis
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Ver demo
                </Button>
              </Link>
            </div>
          </div>

          {/* Tarjeta de muestra (glass) */}
          <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-border bg-card/70 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs text-muted-foreground">Saldo del mes</p>
                <p className="mt-1 text-2xl font-semibold">$4.820.000</p>
              </div>
              <span className="rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">+12,4%</span>
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-md bg-primary/15 text-primary">
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </span>
                  Pago cliente — Factura 0212
                </span>
                <span className="font-medium text-primary">+$1.250.000</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-md bg-danger/15 text-danger">
                    <ArrowDownRight className="size-4" aria-hidden="true" />
                  </span>
                  Arriendo oficina
                </span>
                <span className="font-medium text-danger">-$680.000</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 py-20">
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition-colors duration-200 hover:border-primary/40"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="px-4 pb-24">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-gradient-to-br from-primary/15 to-accent/10 p-10 text-center backdrop-blur-xl">
            <h2 className="text-2xl font-bold sm:text-3xl">Toma el control de tu caja hoy</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Crea tu cuenta en segundos con Google. Sin tarjeta de crédito.
            </p>
            <Link to="/login" className="mt-6 inline-block">
              <Button size="lg">
                Empieza gratis
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Cashflow. Producto hermano de Validus.
      </footer>
    </div>
  );
}
