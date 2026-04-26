# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # Type-check + production build
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

No test suite exists yet (known gap — see ESTADO_ACTUAL.md).

## Architecture Overview

**ValidateAI** is a React 19 SPA that guides entrepreneurs through a 6-step AI-powered business validation wizard, producing a score (0–100), qualitative feedback, and an MVP plan.

**Production:** https://validateai-mu.vercel.app  
**Stack:** React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Supabase + Vercel

### Data flow

```
User fills wizard step
  → React Hook Form + Zod validation
  → useValidation.saveStep() persists to Supabase `validations` table
  → callAI() invokes Supabase Edge Function `ai-validate`
      → Edge Function verifies JWT, calls Anthropic (default) or OpenAI
      → saves interaction to `ai_interactions` table
      → returns JSON
  → validationStore (Zustand, persisted to localStorage) updates UI
```

### State management

`src/stores/validationStore.ts` holds all wizard state via Zustand with `persist` middleware (key: `validationStore`). The store is the single source of truth for:
- `validationId` — Supabase row ID for the current session
- `currentStep` (1–6)
- Per-step data: `stepIdea`, `stepQuestions`, `stepCustomer`, `stepValueProp`, `stepMVP`
- AI results: `summary`, `validationScore`, `aiFeedback`

Call `store.reset()` to clear a session.

### Key hooks

`src/hooks/useValidation.ts` provides three async functions:
- `createValidation()` — inserts a new row in `validations`, sets `validationId` in store
- `saveStep(stepData)` — upserts partial data into the current validation row
- `completeValidation()` — sets `status: 'completed'` and `completed_at`

### Edge Function (`supabase/functions/ai-validate/`)

Runs on Deno. Controlled by env var `AI_PROVIDER`:
- `'anthropic'` (default) — uses Claude via Anthropic SDK
- `'openai'` — uses GPT-4o-mini

Prompt types: `questions`, `customer_analysis`, `value_prop`, `mvp_generation`, `summary`, `competitive_analysis`, `market_sizing`.  
The last two (`competitive_analysis`, `market_sizing`) **always use Anthropic** regardless of `AI_PROVIDER`.

All responses must be pure JSON; `extractJSON()` strips markdown fences before parsing.

### Auth

Supabase auth with PKCE flow. `ProtectedLayout` (`src/app/layout.tsx`) guards all routes via `onAuthStateChange`. Google OAuth redirect lands on `/auth/callback` → `AuthCallback.tsx` exchanges code, upserts `profiles` row.

### Admin panel

Route `/admin` is restricted to `lucianoalonso2000@gmail.com` (hardcoded check). Uses Recharts for metrics, loads all data without pagination (known limitation).

## Environment Variables

### Frontend (`.env.local` / Vercel)
```
VITE_SUPABASE_URL=https://fcdhcntyvsydnvjwopfe.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### Supabase Edge Function Secrets
```
ANTHROPIC_API_KEY=...   # Primary AI provider
OPENAI_API_KEY=...      # Fallback / alternative provider
AI_PROVIDER=anthropic   # 'anthropic' | 'openai'
```

## Path Aliases

`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).

## Supabase Migrations

Migrations live in `supabase/migrations/`. Apply with `supabase db push` or via the Supabase dashboard. The trigger `handle_new_user` auto-creates a `profiles` row on signup.

## Known Issues

- `idea_name` / `idea_industry` can be null if a user abandons Step 1 before saving
- Admin tables load all rows into memory (no pagination)
- PDF export via `html2canvas` is fragile
- No rate limiting or freemium tier
- Mobile responsive is partial
