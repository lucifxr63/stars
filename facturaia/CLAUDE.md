# FacturaIA — CLAUDE.md

## Stack
- React 19 + TypeScript + Vite 8
- Tailwind CSS 4 (`@tailwindcss/postcss`)
- Supabase (Auth, PostgreSQL, Edge Functions, Storage)
- React Router v7
- Zustand (auth store)
- Framer Motion (animaciones)
- Recharts (gráficos admin)
- Sonner (toasts)
- PostHog (analytics)

## Estructura
```
src/
  app/routes/     # Landing, Login, AuthCallback, Dashboard, Admin
  components/
    wizard/       # FacturaWizard (4 pasos)
  hooks/          # useRiskEvaluator, useAnalytics
  lib/            # supabase.ts, database.types.ts, utils.ts
  store/          # authStore.ts (Zustand)
supabase/
  migrations/     # 001-004 SQL (aplicar con `supabase db push`)
  functions/
    sii-risk-evaluator/  # Edge Function Deno + Claude AI
```

## Variables de entorno requeridas
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_POSTHOG_KEY=          # Opcional
VITE_POSTHOG_HOST=         # Opcional
```

## Supabase Secrets (para Edge Function)
```
ANTHROPIC_API_KEY=          # Para claude-haiku-4-5-20251001
SUPABASE_SERVICE_ROLE_KEY=  # Auto-disponible en Edge Functions
```

## Comandos
```bash
npm install
npm run dev
supabase db push            # Aplicar migraciones
supabase functions deploy sii-risk-evaluator
```

## Negocio
- Comisión flat: **1.5%** del monto total de la factura
- Aprobación automática si: pagador en `gran_empresa_ruts` Y Tax Risk Score ≤ 35
- Mercado: PYMEs chilenas con facturas a 30-90 días
- Compliance: Ley Fintec (21.521) + Ley 19.628 (protección datos)
