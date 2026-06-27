# Cashflow — Brief de diseño para Stitch (rediseño dark + light)

> Modo de trabajo: **rediseño más libre**. Stitch puede proponer una dirección
> visual nueva (layout, jerarquía, superficies, tipografía, densidad), siempre que
> respete los **anclajes innegociables** de la sección 1. Diseñar **ambos temas**
> (dark y light). Tú generas en Stitch; yo implemento en React 19 + Tailwind v4.

---

## 0. Bloque condensado (copy-paste en Stitch)

```
Redesign the UI of "Cashflow", a fintech SaaS for Chilean PYMEs and startups to
control cash flow ("how much cash do I have today, and when do I run out?").
You have creative freedom over layout, hierarchy, surfaces, type and density.
Design BOTH a dark theme and a light theme of every screen.

NON-NEGOTIABLE:
- Spanish UI (es-CL). Currency CLP: $4.820.000 (dots as thousands, no decimals);
  compact $4,8M / $120K. Dates es-CL.
- Color SEMANTICS must hold in both themes: green = positive cash / success,
  red = negative / overdue / danger, amber = restricted cash (taxes), a cooler
  secondary accent = "simulation / tech" state.
- Strong number hierarchy, accessible contrast (WCAG AA), clear focus states,
  respect reduced motion.
- Same product data/jobs per screen (see seeds).

PREFERRED (open to your proposals):
- Brand anchor color emerald ~#10b981; secondary violet ~#8b5cf6. You may refine
  shades per theme for contrast, or propose an alternative within fintech taste.
- Modern, confident, data-dense-but-airy fintech feel. Cards, KPI tiles,
  area/line charts, tables, inline forms, pill badges, segmented toggles.
- Type: clean grotesk/geometric sans (current is IBM Plex Sans — you may suggest).

DELIVER: dark + light variants, with the palette you chose stated explicitly.
```

---

## 1. Anclajes innegociables (no cambian en el rediseño)

1. **Propósito y datos.** Es Cashflow: caja en tiempo real, proyección, runway,
   burn, caja restringida por impuestos, facturas (AR/AP), movimientos, recurrentes
   y el lente SaaS (aportes/gastos/ingresos multimoneda). El rediseño reorganiza,
   no inventa otro producto.
2. **Locale es-CL.** UI en español de Chile. CLP sin decimales `$4.820.000`;
   compacto `$4,8M` / `$120K`. Fechas `es-CL`.
3. **Semántica de color** (debe leerse igual en dark y light):
   verde = positivo/éxito · rojo = negativo/vencido/riesgo · ámbar = caja
   restringida (impuestos) · acento frío secundario = simulación / capa "tech".
4. **Accesibilidad.** Contraste WCAG AA en ambos temas, foco visible, estados
   `aria-busy`/`role="alert"`, respeto a `prefers-reduced-motion`.
5. **Dos temas.** Cada pantalla en dark y light.

## 2. Abierto a reinvención (Stitch decide / propone)

Layout y grilla · jerarquía y densidad · estilo de superficies (glass, flat,
soft-shadow, bento…) · radios y espaciado · estilo de tablas y formularios ·
microinteracciones · tipografía (familia y escala) · forma exacta de los KPI,
charts y badges. Anímate a mejorar, no a copiar lo actual.

## 3. Paleta — punto de partida (Stitch puede afinar por tema)

El producto vivo es dark-only; abajo va la base dark y una **propuesta light**
derivada. Stitch debe **declarar la paleta final** que use en cada tema. Los
colores semánticos suelen necesitar un tono más oscuro en light para AA.

| Rol | Dark (actual) | Light (propuesto) | Notas |
|-----|---------------|-------------------|-------|
| background | `#0b1120` | `#f8fafc` | Lienzo |
| card | `#0f172a` | `#ffffff` | Superficie elevada |
| border / muted | `#1e293b` | `#e2e8f0` | Bordes, separadores |
| foreground | `#f8fafc` | `#0f172a` | Texto principal |
| muted-foreground | `#94a3b8` | `#64748b` | Texto secundario, ejes |
| primary (verde) | `#10b981` | `#059669` | Verde más oscuro en light para texto/CTA |
| accent (violeta) | `#8b5cf6` | `#7c3aed` | Secundario / simulación |
| danger (rojo) | `#f43f5e` | `#e11d48` | Negativo / vencido |
| amber | `#fbbf24` | `#d97706` | Caja restringida / impuestos |

Tintas suaves por opacidad del mismo color (`bg-primary/15`, `border-primary/40`).
En light, las tintas van más sutiles (p. ej. `/10`).

## 4. Tipografía

Actual: **IBM Plex Sans**. Abierto a propuesta (grotesk/geométrica limpia, buena
en cifras — tabular figures un plus). Mantener jerarquía numérica fuerte: KPIs con
valor grande y label pequeño muted; headings de sección claros.

## 5. Inventario funcional (qué debe existir, no cómo se ve)

KPI tiles · chart de proyección de caja (serie temporal; debe distinguir saldo
positivo vs. negativo cruzando el cero, y marcar el mínimo proyectado) · tablas con
acción de eliminar y empty states · formularios inline (crear factura/movimiento/
recurrente/revenue/expense/aporte) · badges/deltas (+12,4%) · toggle segmentado
(granularidad Diaria/Semanal/Mensual) · banners de alerta y de "simulación activa" ·
toasts. Stitch decide la forma visual de cada uno.

## 6. Iconografía

Línea fina, set tipo **lucide** (16–20px). Vocabulario en uso: Wallet, TrendingUp/
Down, Timer, Flame, Landmark, Settings, Building2, ArrowUpRight/DownRight,
ShieldCheck, Zap. Coherentes entre sí; estilo abierto pero evitar íconos rellenos
pesados.

## 7. Datos y locale (recordatorio para mockups realistas)

CLP `$4.820.000` · compacto `$4,8M`/`$120K` · ingresos verde con `+`, egresos rojo
con `-` · fechas `es-CL` · textos en español de Chile. Usar cifras plausibles de
una PYME (caja en millones, facturas cientos de miles).

## 8. Hacer / Evitar

**Hacer:** jerarquía numérica fuerte, whitespace deliberado, color con intención
semántica idéntica en ambos temas, una identidad coherente entre pantallas,
contraste AA, foco visible.

**Evitar:** romper la semántica de color entre temas, gradientes arcoíris, tablas
con bordes completos tipo Excel, más de un acento compitiendo por foco en una vista,
sacrificar legibilidad de cifras por estética, light theme que sea solo "dark
invertido" sin cuidar contraste.

## 9. Semillas de prompt por pantalla (jobs + datos, no layout)

> Encadena cada semilla **después** del bloque de la sección 0. Pide explícitamente
> variante dark y light.

- **Landing** (pública) — "Marketing landing for Cashflow: hero with value prop
  (real-time cash flow for PYMEs, no spreadsheets), primary CTA 'Empieza gratis' +
  secondary 'Ver demo', a believable product preview (balance + a couple of
  transactions, income green / expense red), 3 value props (real-time liquidity,
  income/expense tracking, isolated & secure data), final CTA. Footer."
- **Login** — "Minimal auth screen: brand mark, 'Entra a Cashflow', single
  'Continuar con Google' action, legal microcopy. Calm and trustworthy."
- **Dashboard** (núcleo) — "Cash control workspace. Show: 5 KPIs (Caja actual,
  Burn mensual, Runway, Saldo mínimo proyectado, Caja restringida/impuestos), a
  cash-projection time chart that distinguishes positive vs negative balance and
  marks the lowest point, an accounts summary, overdue invoices ('centro de
  resolución'), recurring income/expenses, creation forms and lists of invoices &
  movements. A 'simulation active' state when the user hides events to forecast
  what-if. Propose a great layout for this density."
- **SaaS (/saas)** — "Internal SaaS finance lens: monthly analytics (metrics +
  breakdown), forms for Revenue (multi-currency USD→CLP with gateway commission,
  net CLP is the KPI), Expense (net/VAT/total, funded by company or partner), and
  partner contributions. A revenue detail table: Fecha, Plan, Bruto USD, Bruto CLP,
  Comisión, Neto CLP, with delete + empty state."

---

_Base derivada del código vivo (index.css, button.tsx, CashflowChart, utils, las 4
pantallas). En light, los tokens de la sección 3 son propuesta inicial; se afinan al
implementar según el contraste real._
