import { Link } from 'react-router-dom';
import {
  Wallet, TrendingUp, ShieldCheck, Zap, Gauge,
  ArrowUpRight, ArrowDownRight, ArrowRight, PlayCircle, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

const features = [
  {
    icon: Wallet,
    tone: 'accent' as const,
    title: 'Ingresos y egresos',
    desc: 'Registra y clasifica cada movimiento. Olvídate de la conciliación manual y mantén tu saldo al día sin esfuerzo.',
  },
  {
    icon: Gauge,
    tone: 'primary' as const,
    title: 'Liquidez en tiempo real',
    desc: 'Consultas en milisegundos. Visualiza tu flujo proyectado y decide con datos actualizados al segundo, no de la semana pasada.',
    decoration: Zap,
  },
  {
    icon: ShieldCheck,
    tone: 'muted' as const,
    title: 'Datos aislados y seguros',
    desc: 'Aislamiento estricto por negocio con políticas RLS (Row Level Security). Tus números son solo tuyos, sin fugas entre cuentas.',
  },
];

const toneTile: Record<'primary' | 'accent' | 'muted', string> = {
  primary: 'bg-primary/15 text-primary border-primary/30',
  accent: 'bg-accent/15 text-accent border-accent/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

const glowBtn =
  'rounded-full shadow-[0_0_20px_color-mix(in_oklab,var(--color-primary)_35%,transparent)] hover:shadow-[0_0_30px_color-mix(in_oklab,var(--color-primary)_55%,transparent)]';

export function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Nav flotante (pill glass) */}
      <header className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-5xl items-center justify-between rounded-full border border-border bg-card/70 px-5 py-3 shadow-2xl backdrop-blur-xl">
        <span className="flex items-center gap-2.5 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          <span className="font-display text-xl font-bold">Denarius</span>
        </span>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#beneficios" className="transition-colors hover:text-foreground">Beneficios</a>
          <a href="#seguridad" className="transition-colors hover:text-foreground">Seguridad</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className="rounded-full" />
          <Link to="/login" className="hidden sm:block">
            <Button size="sm" variant="ghost">Iniciar sesión</Button>
          </Link>
          <Link to="/login">
            <Button size="sm" className={glowBtn}>Empieza gratis</Button>
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pb-20 pt-32">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-24 -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[150px]"
          />
          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
            <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur">
              <span className="size-2 animate-pulse rounded-full bg-primary" />
              Para PYMEs y startups en LatAm
            </span>
            <h1 className="mb-6 text-balance font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              El flujo de caja de tu negocio, <span className="text-primary">claro y al instante.</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
              Controla ingresos, egresos y liquidez sin planillas. Denarius te da una foto en tiempo real
              de cuánta caja tienes, hoy.
            </p>
            <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" className={`group w-full sm:w-auto ${glowBtn}`}>
                  Empieza gratis
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="group w-full rounded-full sm:w-auto">
                  Ver demo
                  <PlayCircle className="size-4 transition-transform group-hover:rotate-12" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Tarjeta de muestra (glass) */}
          <div className="relative z-10 mt-20 w-full max-w-3xl">
            <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-2xl backdrop-blur-xl transition-transform duration-500 hover:scale-[1.01] md:p-8">
              <div className="mb-8 flex items-start justify-between border-b border-border pb-6">
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">Saldo del mes</p>
                  <p className="font-display text-4xl font-bold tracking-tight md:text-5xl">$4.820.000</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                  <TrendingUp className="size-3.5" aria-hidden="true" /> +12,4%
                </span>
              </div>
              <ul className="space-y-2">
                <PreviewRow
                  icon={<ArrowUpRight className="size-5" aria-hidden="true" />}
                  tone="primary"
                  title="Pago cliente — Factura 0212"
                  meta="Hoy, 14:30 hrs"
                  amount="+$1.250.000"
                />
                <PreviewRow
                  icon={<ArrowDownRight className="size-5" aria-hidden="true" />}
                  tone="danger"
                  title="Arriendo oficina"
                  meta="Ayer, 09:15 hrs"
                  amount="-$680.000"
                />
              </ul>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="beneficios" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, tone, title, desc, decoration: Deco }) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-8 backdrop-blur transition-transform duration-300 hover:-translate-y-1"
              >
                {Deco && (
                  <Deco className="pointer-events-none absolute -right-4 -top-4 size-28 text-primary/10" aria-hidden="true" />
                )}
                <span className={`relative grid size-12 place-items-center rounded-xl border ${toneTile[tone]}`}>
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="relative mt-6 font-display text-xl font-bold">{title}</h3>
                <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section id="seguridad" className="relative z-10 px-6 py-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl">
            <div className="absolute inset-0 rounded-3xl border border-border bg-gradient-to-br from-primary/20 via-card to-accent/20" />
            <div className="relative flex flex-col items-center p-12 text-center backdrop-blur-sm md:p-20">
              <h2 className="mb-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
                Toma el control de tu caja hoy
              </h2>
              <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground">
                Crea tu cuenta en segundos con Google. Sin tarjeta de crédito, sin compromisos ocultos.
              </p>
              <Link to="/login">
                <Button size="lg" className={`text-lg ${glowBtn}`}>
                  Empieza gratis
                  <ArrowRight className="size-5" aria-hidden="true" />
                </Button>
              </Link>
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="size-4" aria-hidden="true" /> Seguridad nivel bancario · aislamiento por negocio (RLS)
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 flex w-full flex-col items-center justify-between gap-4 border-t border-border px-8 py-12 md:flex-row">
        <span className="font-display font-bold text-muted-foreground">Denarius</span>
        <p className="text-center text-xs text-muted-foreground md:text-left">
          © {new Date().getFullYear()} Denarius. Producto hermano de Validus.
        </p>
        <nav className="flex gap-6 text-xs text-muted-foreground">
          <a href="#" className="transition-colors hover:text-primary">Privacidad</a>
          <a href="#" className="transition-colors hover:text-primary">Términos</a>
          <a href="#" className="transition-colors hover:text-primary">Soporte</a>
        </nav>
      </footer>
    </div>
  );
}

function PreviewRow({
  icon, tone, title, meta, amount,
}: { icon: React.ReactNode; tone: 'primary' | 'danger'; title: string; meta: string; amount: string }) {
  const tile = tone === 'primary' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-danger/10 text-danger border-danger/20';
  const amt = tone === 'primary' ? 'text-primary' : 'text-danger';
  return (
    <li className="flex items-center justify-between rounded-xl border border-transparent p-4 transition-colors hover:border-border hover:bg-muted/50">
      <span className="flex items-center gap-4">
        <span className={`grid size-10 place-items-center rounded-full border ${tile}`}>{icon}</span>
        <span>
          <span className="block font-medium">{title}</span>
          <span className="block text-sm text-muted-foreground">{meta}</span>
        </span>
      </span>
      <span className={`text-lg font-bold ${amt}`}>{amount}</span>
    </li>
  );
}
