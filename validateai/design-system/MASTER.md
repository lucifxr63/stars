# VALIDUS — Design System Master
> Fuente única de verdad para Landing Page + App Shell. Generado 2026-05-31.

---

## 1. IDENTIDAD

| Campo | Valor |
|---|---|
| Nombre del producto | **Validus** |
| Dominio | `https://validus.scouttech.lat` |
| Tagline | "Valida tu idea de startup antes de construirla" |
| Mercado | Chile / LatAm — emprendedores B2B/B2C |
| Stack | React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui |
| Theme engine | `next-themes` — `attribute="class"` — `defaultTheme="system"` |

---

## 2. LOGO

**Archivo:** `logo_vector.svg` (338×426px)  
**Forma:** V + flecha descendente + chevron interior  
**Colores originales:**
- Cuerpo V: `#001431` (navy oscuro)
- Flecha central: `#ff2b23` (rojo)
- Corte interno: blanco

**Uso en UI:**
```
Light mode → usar colores originales (#001431 + #ff2b23)
Dark mode  → cuerpo: #FFFFFF | flecha: #7C6FF7 (brand violet)
```

**Dimensiones navbar:** `w-8 h-8` (32×32px) + texto "Validus" en Space Grotesk 600

---

## 3. COLORES — TOKENS

### Brand (invariante)
```
--brand:          #7C6FF7   ← violet principal — NO cambiar jamás
--brand-light:    #A78BFA   ← hover / texto sobre fondos oscuros
--brand-dim:      rgba(124,111,247,0.12)
--brand-glow:     rgba(124,111,247,0.30)
--amber:          #F7C56C
--amber-dim:      rgba(247,197,108,0.12)
--success:        #34D399
--error:          #F87171
--warning:        #FBBF24
--logo-red:       #ff2b23   ← solo para el logo
--logo-navy:      #001431   ← solo para el logo en light mode
```

### Dark Mode (`.dark`)
```
--bg:             #0A0A0F
--surface:        #12121A
--surface-raised: #1A1A26
--border:         rgba(255,255,255,0.06)
--border-subtle:  rgba(255,255,255,0.04)
--text:           #F0EFF8
--text-muted:     #8B8AA0
--text-faint:     #4A495E
```

### Light Mode (sin `.dark`)
```
--bg:             #F8F7FF   ← blanco con tinte violet sutil
--surface:        #FFFFFF
--surface-raised: #F2F0FE   ← violet muy tenue
--border:         rgba(0,0,0,0.07)
--border-subtle:  rgba(0,0,0,0.04)
--text:           #0F0E1A   ← near-black con tinte violet
--text-muted:     #5A5870
--text-faint:     #9896AE
```

---

## 4. TIPOGRAFÍA

### Fuentes cargadas
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
```

### Escala
| Rol | Fuente | Peso | Tamaño | Line-height | Tracking |
|---|---|---|---|---|---|
| H1 Hero | Space Grotesk | 800 | clamp(2.5rem, 5vw, 4.5rem) | 1.05 | -0.02em |
| H2 Section | Space Grotesk | 700 | clamp(1.75rem, 3vw, 2.75rem) | 1.1 | -0.01em |
| H3 Card | Space Grotesk | 600 | 1.125rem | 1.25 | 0 |
| Body | DM Sans | 400 | 1rem | 1.65 | 0 |
| Body sm | DM Sans | 400 | 0.875rem | 1.6 | 0 |
| Caption | DM Sans | 500 | 0.75rem | 1.5 | 0.02em |
| Badge | DM Sans | 600 | 0.7rem | 1 | 0.06em (uppercase) |
| Score/Num | Space Grotesk | 800 | variable | 1 | tabular-nums |

---

## 5. EFECTOS

### `.glass-card` — AMBOS MODOS
```css
/* Light mode (default) */
.glass-card {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(124, 111, 247, 0.12);
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 24px rgba(124, 111, 247, 0.08);
}
/* Dark mode */
.dark .glass-card {
  background: rgba(18, 18, 26, 0.80);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: none;
}
```

### `.grid-pattern` — AMBOS MODOS
```css
/* Light mode */
.grid-pattern {
  background-image:
    linear-gradient(rgba(124,111,247,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124,111,247,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
}
/* Dark mode */
.dark .grid-pattern {
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
}
```

### Gradient text
```css
.gradient-text {
  background: linear-gradient(135deg, #7C6FF7, #A78BFA);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Glow
```css
.glow-brand    { box-shadow: 0 0 40px rgba(124,111,247,0.3), 0 0 80px rgba(124,111,247,0.12); }
.glow-brand-sm { box-shadow: 0 0 20px rgba(124,111,247,0.25); }
```

---

## 6. COMPONENTES — ESPECIFICACIÓN

### `<LandingNav />`
```
sticky top-0 z-50 h-16
DARK:  bg-[#0A0A0F]/80 border-b border-white/[0.06] backdrop-blur-xl
LIGHT: bg-[#F8F7FF]/80 border-b border-black/[0.07] backdrop-blur-xl
Scroll behavior: border-b visible solo cuando scrollY > 20

LEFT:   Logo SVG (logo_vector.svg adaptado) + "Validus" Space Grotesk 600
CENTER: "Características" | "Precios" | "Demo" (smooth scroll / links)
RIGHT:  ThemeToggle + "Iniciar sesión" (ghost) + "Empezar gratis" (brand)

Mobile: Logo + ThemeToggle + hamburger → drawer slide-down
```

### `<HeroSection />`
```
relative overflow-hidden pt-28 sm:pt-36 pb-20 sm:pb-28
Orbs: violet top-center w-[600px] h-[400px] bg-[#7C6FF7]/12 blur-[100px]
      amber top-left w-64 h-64 bg-[#F7C56C]/6 blur-[80px]
Grid: .grid-pattern absoluto en fondo

BADGE:
  inline-flex items-center gap-2 px-3 py-1.5
  bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 rounded-full
  text-[11px] font-semibold text-[#A78BFA] uppercase tracking-wide
  Icono: SVG spark (no emoji)
  Texto: "IA entrenada para startups · Chile & LatAm"
  Punto animado: w-1.5 h-1.5 bg-[#7C6FF7] rounded-full animate-pulse

H1:
  font-heading text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold
  text-gray-900 dark:text-[#F0EFF8] leading-[1.05] tracking-[-0.02em]
  Línea 1: "Valida tu idea de startup"
  Línea 2: <span class="gradient-text">antes de construirla</span>

SUBHEAD:
  text-base sm:text-lg text-[#5A5870] dark:text-[#8B8AA0]
  max-w-xl mx-auto leading-relaxed mb-10
  "Un mentor de IA te guía en 3 pasos para descubrir si tu startup
   tiene potencial real. Análisis completo en 10 minutos."

CTAs (flex-col sm:flex-row gap-3 justify-center):
  PRIMARY "Continuar con Google":
    flex items-center gap-2.5 px-6 py-3.5
    bg-white dark:bg-[#12121A]
    border border-gray-200 dark:border-white/10
    text-gray-900 dark:text-[#F0EFF8] font-semibold text-sm
    rounded-xl shadow-lg hover:shadow-xl transition-all
    SVG Google inline (4 paths oficiales)
  
  SECONDARY "Entrar con email →":
    px-6 py-3.5 bg-[#7C6FF7] text-white font-semibold text-sm
    rounded-xl shadow-lg shadow-[#7C6FF7]/25
    hover:bg-[#6B5EE6] active:scale-[0.98] transition-all

TRUST LINE:
  text-xs text-[#9896AE] dark:text-[#4A495E]
  "Sin tarjeta de crédito · Resultados en 10 minutos · Ley 21.719 compliant"

HERO CARD (floating mockup):
  mt-16 max-w-xs mx-auto
  .glass-card rounded-2xl p-5 animate-float glow-brand-sm
  Contenido: score 78, barras de progreso, quote corto
  Segundo card mini superpuesto (rotado 3deg, detrás): z-0
```

### `<SocialProofBar />`
```
py-10 border-y
DARK:  border-white/[0.06] bg-[#12121A]/40
LIGHT: border-black/[0.05] bg-[#F2F0FE]/50

Contenido:
  Si validations > 0: "+{n} ideas validadas esta semana en Chile"
  Siempre: row de 5 industrias con SVG icon + label
  [Fintech] [EdTech] [Retail] [SaaS B2B] [HealthTech]
```

### `<HowItWorksSection />`
```
py-20 border-t
  DARK:  border-white/[0.06]
  LIGHT: border-black/[0.05]

Header: label "EL PROCESO" + H2 "De la idea al análisis en 3 pasos"

Cards grid md:grid-cols-3 gap-4:
  DARK:  bg-[#12121A] border border-white/[0.06] hover:border-[step-color]/30
  LIGHT: bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-[step-color]/25
  
  Número watermark: text-[5rem] font-black opacity-5 absolute top-2 right-4
  Conector entre cards (desktop): SVG arrow, text-[#4A495E]

Pasos:
  01 - "Tu idea"     - color #7C6FF7 - ~3 min
  02 - "Tu mercado"  - color #34D399 - ~4 min  
  03 - "Tu reporte"  - color #F7C56C - ~3 min
```

### `<FeaturesSection />` — Bento Grid
```
py-24 border-t
  DARK:  border-white/[0.06] bg-[#12121A]
  LIGHT: border-black/[0.05] bg-white

Header: badge + H2 "El análisis más completo" + subhead

Grid md:grid-cols-3 gap-6:
  Card DARK:  bg-[#0A0A0F] border border-white/5 rounded-3xl p-8
  Card LIGHT: bg-[#F8F7FF] border border-gray-100 rounded-3xl p-8 hover:shadow-lg

Features (6):
  [2col] Mercado y Competencia — icono: chart-bar — tags: TAM/SAM/SOM, Radar, Gaps
  [1col] Unit Economics       — icono: currency   — CAC/LTV/Payback
  [1col] Compliance Chileno   — icono: shield      — SII, INAPI, CMF
  [2col] Founder Fit          — icono: users       — tags: Radar, Perfiles, Mentores AI
  [1col] PDF Investor-Ready   — icono: document    
  [1col] Encuestas Mom Test   — icono: chat-bubble  

Tag pills:
  DARK:  bg-[#1A1A24] border border-white/10 text-[#C4C4D4]
  LIGHT: bg-white border border-gray-200 text-gray-600
```

### `<LiveReportSection />`
```
py-20
  DARK:  bg-[#0A0A0F]
  LIGHT: bg-[#F8F7FF]

Container bg:
  DARK:  bg-[#12121A] border border-white/[0.06] rounded-2xl
  LIGHT: bg-white border border-gray-200 rounded-2xl shadow-sm

Tabs activo:
  DARK:  text-[#A78BFA] border-b-2 border-[#7C6FF7] bg-[#7C6FF7]/5
  LIGHT: text-[#7C6FF7] border-b-2 border-[#7C6FF7] bg-[#7C6FF7]/5

Tabs inactivo:
  DARK:  text-[#8B8AA0] hover:text-[#F0EFF8]
  LIGHT: text-[#5A5870] hover:text-[#0F0E1A]
```

### `<StatsSection />`
```
py-16 border-y
  DARK:  border-white/[0.06]
  LIGHT: border-black/[0.05]

Grid grid-cols-2 sm:grid-cols-4 gap-8 text-center:
  "+{n}"   / "Ideas validadas"     / "y contando"
  "10"     / "Minutos"             / "tiempo promedio"
  "10"     / "Dimensiones"         / "de análisis"
  "4"      / "Planes"              / "free hasta premium"
```

### `<TestimonialsSection />`
```
py-20 border-t
  DARK:  border-white/[0.06] bg-[#12121A]
  LIGHT: border-black/[0.05] bg-white

Header: H2 "Lo que dicen los founders"

Grid md:grid-cols-3 gap-6:
  Card DARK:  bg-[#0A0A0F] border border-white/5 rounded-2xl p-6
  Card LIGHT: bg-[#F8F7FF] border border-gray-100 rounded-2xl p-6 shadow-sm

Placeholders:
  1. Valentina M. · Founder · EdTech Santiago
     "Tenía mi idea hace 6 meses y no sabía si tenía sentido.
      Validus me dio un score de 74 y un roadmap concreto en 10 minutos."
     Score badge: 74

  2. Rodrigo C. · Co-founder · FinTech Concepción  
     "El análisis de competidores con datos del CMF fue lo que más
      me sorprendió. Algo que habría tomado semanas lo tuve en horas."
     Score badge: 81

  3. Catalina V. · CEO · HealthTech Valparaíso
     "La sección de Unit Economics me ayudó a convencer a mi primer
      angel investor. El PDF es investor-ready desde el día 1."
     Score badge: 69
```

### `<PricingSection />`
```
py-24 border-t
  DARK:  border-white/[0.06] bg-[#0A0A0F]
  LIGHT: border-black/[0.05] bg-[#F8F7FF]

Header: H2 "Elige tu nivel de profundidad"
Sub: "Comienza gratis. Escala cuando necesites datos duros."
Note: "Todos los planes incluyen Ley 21.719 de Privacidad"

Planes (2 en landing, link a /pricing para ver todos):

FREE — $0/mes
  DARK:  bg-[#12121A] border border-white/5 rounded-3xl p-8
  LIGHT: bg-white border border-gray-200 rounded-3xl p-8

  Features: 1 idea, Score general, Resumen + Feedback IA,
            Competidores básico, Export PDF estándar

PRO — $20.000 CLP/mes  ← RECOMENDADO (highlighted)
  DARK:  bg-[#12121A] border-2 border-[#7C6FF7] rounded-3xl p-8
         shadow-2xl shadow-[#7C6FF7]/10
  LIGHT: bg-white border-2 border-[#7C6FF7] rounded-3xl p-8
         shadow-2xl shadow-[#7C6FF7]/15
  Badge "POPULAR" top-right: bg-[#7C6FF7] text-white rounded-bl-xl px-4 py-1

  Features: Todo Free + ideas ilimitadas, TAM/SAM/SOM,
            Unit Economics, Matriz de Riesgos, Founder Fit,
            PDF multitema investor-ready

PREMIUM — $50.000 CLP/mes
  Solo mencionado como "Ver plan Premium →" link hacia /pricing
  O mostrar como 3er card col-span con blur/lock visual

CTA bajo pricing: "Ver todos los planes →" → /pricing
```

### `<FinalCtaSection />`
```
py-24 text-center px-4

Container:
  DARK:  bg-[#12121A] border border-white/[0.06] rounded-3xl px-8 py-16
  LIGHT: bg-gradient-to-b from-[#F2F0FE] to-white rounded-3xl px-8 py-16
         border border-brand/10

Radial glow detrás: bg-[#7C6FF7]/8 blur-2xl

H2: "¿Tu idea tiene potencial?"
Sub: "Descúbrelo en 10 minutos con un análisis completo impulsado por IA."

CTAs: mismos que Hero (Google + email)

Micro-checks:
  "✓ Sin tarjeta  ✓ Cancela cuando quieras  ✓ Soporte en español"
  text-xs text-[#9896AE]
```

### `<LandingFooter />`
```
border-t py-12
  DARK:  border-white/[0.06] bg-[#0A0A0F]
  LIGHT: border-black/[0.05] bg-[#F8F7FF]

Grid grid-cols-1 sm:grid-cols-3 gap-8:

COL 1: Logo Validus + tagline + compliance badge
  "Valida tu idea de startup antes de construirla"
  Badge: SVG shield-check + "Ley 21.719 Compliance"

COL 2: Producto
  - Características
  - Precios
  - Demo
  - API & Developers

COL 3: Legal
  - Términos de uso
  - Política de privacidad
  - contacto@validus.scouttech.lat

BOTTOM BAR:
  "© 2026 Validus · Hecho en Chile"
  text-xs text-[#4A495E]
```

---

## 7. BRANDING — LOGO EN COMPONENTES

### Navbar (inline SVG adaptado):
```jsx
// Light mode: navy + red original
// Dark mode: white + brand violet
<svg viewBox="0 0 338 426" className="w-8 h-8">
  {/* V cuerpo */}
  <path d="M66 198 H118 L169 292 L220 198 H272 L169 358 Z"
        className="fill-[#001431] dark:fill-white" />
  {/* Corte blanco interno */}
  <path d="M134 252 L152 252 L169 286 L187 252 L205 252 L169 324 Z"
        className="fill-white dark:fill-[#0A0A0F]" />
  {/* Chevron interior */}
  <path d="M155 253 L169 279 L192 253 L200 263 L169 303 L148 263 Z"
        className="fill-[#001431] dark:fill-white" />
  {/* Flecha roja → violet en dark */}
  <path d="M169 68 L193 257 L169 237 L156 254 Z"
        className="fill-[#ff2b23] dark:fill-[#7C6FF7]" />
</svg>
```

---

## 8. PÁGINAS — SCOPE DEL REDESIGN

| Página | Scope | Archivos |
|---|---|---|
| `/` Landing | **Reescribir completo** | `src/app/routes/Landing.tsx` |
| Global CSS tokens | **Editar** | `src/index.css` |
| Header app (auth) | **Editar** light mode | `src/components/layout/Header.tsx` |
| ThemeToggle | **Mejorar** visual | `src/components/shared/ThemeToggle.tsx` |
| App.tsx | **Editar menor** | `src/App.tsx` |

---

## 9. CONVENCIONES PARA STITCH

```
- Stack: React + Tailwind v4 (@theme inline, NO tailwind.config extend)
- Dark mode: @custom-variant dark (&:is(.dark *)) en index.css
- Tailwind v4: usar bg-[#hex] directo, NO dark: prefix (usar .dark selector en CSS)
  EXCEPCIÓN: dark: prefix funciona con next-themes attribute="class"
- Componentes: funcionales React, todo inline Tailwind
- Iconos: SVG inline (heroicons 2.0 outline style, strokeWidth={1.5})
- NO emojis como íconos UI
- Import paths: @/ alias → src/
- Responsive: mobile-first, breakpoints sm: md: lg:
- Animaciones: solo transform/opacity, respetar prefers-reduced-motion
- Fuentes: font-heading (Space Grotesk), font-sans (DM Sans)
```

---

*Design system listo para implementación con Stitch.*
