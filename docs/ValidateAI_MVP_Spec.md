# ValidateAI — MVP Technical Specification

## Para Claude Code: Guía de implementación priorizada

---

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | React 18 + Vite + TypeScript | Tipado estricto, HMR rápido, tree-shaking |
| Estilos | Tailwind CSS + shadcn/ui | Componentes accesibles, design system consistente |
| Estado | Zustand | Ligero, sin boilerplate, escalable |
| Backend | Supabase (Auth + DB + Edge Functions) | BaaS completo, RLS nativo, realtime |
| AI | Anthropic Claude API (via Edge Function) | Modelo de lenguaje para guiar validación |
| Hosting | Vercel | Deploy automático, Edge Functions, preview deploys |
| Validación | Zod | Schemas compartidos frontend/backend |

---

## Arquitectura del Proyecto

```
validateai/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── routes/               # Páginas principales
│   │       ├── Landing.tsx
│   │       ├── Validate.tsx       # Wizard principal
│   │       └── Results.tsx        # Resumen final
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── wizard/                # Componentes del wizard
│   │   │   ├── StepIdea.tsx
│   │   │   ├── StepQuestions.tsx
│   │   │   ├── StepCustomer.tsx
│   │   │   ├── StepValueProp.tsx
│   │   │   ├── StepMVP.tsx
│   │   │   └── StepSummary.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── ProgressBar.tsx
│   │   └── shared/
│   │       ├── LoadingAI.tsx
│   │       └── ExportPDF.tsx
│   ├── lib/
│   │   ├── supabase.ts            # Cliente Supabase
│   │   ├── anthropic.ts           # Helper para llamar Edge Function
│   │   └── pdf.ts                 # Generación de PDF con jsPDF
│   ├── stores/
│   │   └── validationStore.ts     # Zustand store global
│   ├── types/
│   │   └── validation.ts          # Tipos TypeScript + Zod schemas
│   ├── hooks/
│   │   ├── useValidation.ts
│   │   └── useAI.ts
│   └── utils/
│       ├── prompts.ts             # Prompts para Claude API
│       └── constants.ts
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── functions/
│       └── ai-validate/
│           └── index.ts           # Edge Function para Claude API
├── .env.local
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

---

## Base de Datos — Supabase Schema

Diseño normalizado y escalable desde el inicio. Cada tabla tiene RLS habilitado.

```sql
-- Migration: 001_initial_schema.sql

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLA: profiles (extiende auth.users)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- TABLA: validations (sesiones de validación)
-- ============================================
create table public.validations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'in_progress' check (status in ('in_progress', 'completed', 'archived')),
  current_step int default 1 check (current_step between 1 and 6),
  
  -- Step 1: Idea
  idea_name text,
  idea_description text,
  idea_industry text,
  
  -- Step 2: Preguntas estructuradas (respuestas AI-guided)
  questions_answers jsonb default '[]'::jsonb,
  
  -- Step 3: Cliente objetivo
  customer_segment text,
  customer_pain_points text[],
  customer_context text,
  
  -- Step 4: Propuesta de valor
  value_proposition text,
  differentiator text,
  
  -- Step 5: MVP generado
  mvp_type text check (mvp_type in ('web_app', 'mobile_app', 'service', 'marketplace', 'saas', 'api')),
  mvp_features jsonb default '[]'::jsonb,
  mvp_user_flow text,
  
  -- Step 6: Resumen
  summary_json jsonb,
  ai_feedback text,
  validation_score int check (validation_score between 0 and 100),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.validations enable row level security;

create policy "Users can CRUD own validations"
  on public.validations for all
  using (auth.uid() = user_id);

-- Index para queries frecuentes
create index idx_validations_user on public.validations(user_id);
create index idx_validations_status on public.validations(status);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.validations
  for each row execute function update_updated_at();

-- ============================================
-- TABLA: ai_interactions (log de llamadas AI)
-- ============================================
create table public.ai_interactions (
  id uuid primary key default uuid_generate_v4(),
  validation_id uuid references public.validations(id) on delete cascade,
  step int not null,
  prompt_type text not null,
  input_data jsonb not null,
  output_data jsonb not null,
  tokens_used int,
  model text default 'claude-sonnet-4-20250514',
  created_at timestamptz default now()
);

alter table public.ai_interactions enable row level security;

create policy "Users can view own AI interactions"
  on public.ai_interactions for select
  using (
    exists (
      select 1 from public.validations v
      where v.id = validation_id and v.user_id = auth.uid()
    )
  );
```

---

## Tipos TypeScript + Zod Schemas

```typescript
// src/types/validation.ts
import { z } from 'zod';

// ---- Enums ----
export const IndustryEnum = z.enum([
  'fintech', 'edtech', 'healthtech', 'ecommerce', 'saas',
  'marketplace', 'social', 'logistics', 'foodtech', 'proptech', 'other'
]);

export const MVPTypeEnum = z.enum([
  'web_app', 'mobile_app', 'service', 'marketplace', 'saas', 'api'
]);

export const ValidationStatusEnum = z.enum([
  'in_progress', 'completed', 'archived'
]);

// ---- Step Schemas ----
export const StepIdeaSchema = z.object({
  idea_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  idea_description: z.string().min(20, 'Describe tu idea con al menos 20 caracteres').max(2000),
  idea_industry: IndustryEnum,
});

export const QuestionAnswerSchema = z.object({
  question: z.string(),
  answer: z.string().min(5),
  ai_followup: z.string().optional(),
});

export const StepQuestionsSchema = z.object({
  questions_answers: z.array(QuestionAnswerSchema).min(3).max(8),
});

export const StepCustomerSchema = z.object({
  customer_segment: z.string().min(10).max(500),
  customer_pain_points: z.array(z.string().min(3)).min(1).max(5),
  customer_context: z.string().min(10).max(1000),
});

export const StepValuePropSchema = z.object({
  value_proposition: z.string().min(20).max(1000),
  differentiator: z.string().min(10).max(500),
});

export const MVPFeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  priority: z.enum(['must', 'should', 'could']),
});

export const StepMVPSchema = z.object({
  mvp_type: MVPTypeEnum,
  mvp_features: z.array(MVPFeatureSchema).min(3).max(8),
  mvp_user_flow: z.string().min(20),
});

// ---- Full Validation ----
export const ValidationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: ValidationStatusEnum,
  current_step: z.number().min(1).max(6),
  ...StepIdeaSchema.shape,
  ...StepQuestionsSchema.shape,
  ...StepCustomerSchema.shape,
  ...StepValuePropSchema.shape,
  ...StepMVPSchema.shape,
  summary_json: z.any().nullable(),
  ai_feedback: z.string().nullable(),
  validation_score: z.number().min(0).max(100).nullable(),
});

// ---- Inferred Types ----
export type StepIdea = z.infer<typeof StepIdeaSchema>;
export type StepQuestions = z.infer<typeof StepQuestionsSchema>;
export type StepCustomer = z.infer<typeof StepCustomerSchema>;
export type StepValueProp = z.infer<typeof StepValuePropSchema>;
export type StepMVP = z.infer<typeof StepMVPSchema>;
export type Validation = z.infer<typeof ValidationSchema>;
export type MVPFeature = z.infer<typeof MVPFeatureSchema>;
export type QuestionAnswer = z.infer<typeof QuestionAnswerSchema>;
```

---

## Zustand Store

```typescript
// src/stores/validationStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { StepIdea, StepQuestions, StepCustomer, StepValueProp, StepMVP } from '@/types/validation';

interface ValidationState {
  // Current session
  validationId: string | null;
  currentStep: number;
  isLoading: boolean;
  aiThinking: boolean;

  // Step data
  stepIdea: Partial<StepIdea>;
  stepQuestions: Partial<StepQuestions>;
  stepCustomer: Partial<StepCustomer>;
  stepValueProp: Partial<StepValueProp>;
  stepMVP: Partial<StepMVP>;
  
  // Summary
  summary: Record<string, any> | null;
  validationScore: number | null;
  aiFeedback: string | null;

  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateStepIdea: (data: Partial<StepIdea>) => void;
  updateStepQuestions: (data: Partial<StepQuestions>) => void;
  updateStepCustomer: (data: Partial<StepCustomer>) => void;
  updateStepValueProp: (data: Partial<StepValueProp>) => void;
  updateStepMVP: (data: Partial<StepMVP>) => void;
  setSummary: (summary: Record<string, any>, score: number, feedback: string) => void;
  setAIThinking: (val: boolean) => void;
  setValidationId: (id: string) => void;
  reset: () => void;
}

const initialState = {
  validationId: null,
  currentStep: 1,
  isLoading: false,
  aiThinking: false,
  stepIdea: {},
  stepQuestions: { questions_answers: [] },
  stepCustomer: { customer_pain_points: [] },
  stepValueProp: {},
  stepMVP: { mvp_features: [] },
  summary: null,
  validationScore: null,
  aiFeedback: null,
};

export const useValidationStore = create<ValidationState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        setStep: (step) => set({ currentStep: step }),
        nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 6) })),
        prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) })),
        updateStepIdea: (data) => set((s) => ({ stepIdea: { ...s.stepIdea, ...data } })),
        updateStepQuestions: (data) => set((s) => ({ stepQuestions: { ...s.stepQuestions, ...data } })),
        updateStepCustomer: (data) => set((s) => ({ stepCustomer: { ...s.stepCustomer, ...data } })),
        updateStepValueProp: (data) => set((s) => ({ stepValueProp: { ...s.stepValueProp, ...data } })),
        updateStepMVP: (data) => set((s) => ({ stepMVP: { ...s.stepMVP, ...data } })),
        setSummary: (summary, score, feedback) => set({ summary, validationScore: score, aiFeedback: feedback }),
        setAIThinking: (val) => set({ aiThinking: val }),
        setValidationId: (id) => set({ validationId: id }),
        reset: () => set(initialState),
      }),
      { name: 'validateai-session' }
    )
  )
);
```

---

## Edge Function — AI Validation

```typescript
// supabase/functions/ai-validate/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIRequest {
  validation_id: string;
  step: number;
  prompt_type: 'questions' | 'customer_analysis' | 'value_prop' | 'mvp_generation' | 'summary';
  context: Record<string, any>;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  questions: `Eres un mentor de startups experto en Lean Startup y Design Thinking.
Dado el nombre y descripción de una idea de negocio, genera exactamente 5 preguntas estructuradas 
que ayuden al emprendedor a validar su idea. Las preguntas deben cubrir:
1. Problema real (¿existe el dolor?)
2. Tamaño del mercado (¿a cuánta gente afecta?)
3. Alternativas actuales (¿cómo lo resuelven hoy?)
4. Disposición a pagar (¿pagarían por esto?)
5. Canal de distribución (¿cómo llegas a ellos?)

Responde SOLO en JSON con el formato:
{ "questions": [{ "question": "...", "category": "..." }] }`,

  customer_analysis: `Eres un experto en segmentación de clientes y buyer personas.
Analiza las respuestas del emprendedor y sugiere:
- Un segmento de cliente específico y accionable
- Los 3 pain points principales
- El contexto en que ocurre el problema

Responde SOLO en JSON:
{ "segment": "...", "pain_points": ["...", "...", "..."], "context": "..." }`,

  value_prop: `Eres un estratega de producto. Basándote en el problema, cliente y respuestas previas,
genera una propuesta de valor clara usando el formato:
"Para [segmento] que [problema], [producto] es un [categoría] que [beneficio principal].
A diferencia de [alternativa], nosotros [diferenciador]."

Responde SOLO en JSON:
{ "value_proposition": "...", "differentiator": "..." }`,

  mvp_generation: `Eres un product manager senior. Basándote en toda la información recopilada,
genera un plan de MVP que incluya:
- Tipo de producto recomendado
- 5-6 funcionalidades priorizadas (must/should/could)
- Flujo de usuario principal en texto

Responde SOLO en JSON:
{
  "recommended_type": "web_app|mobile_app|service|marketplace|saas|api",
  "features": [{ "name": "...", "description": "...", "priority": "must|should|could" }],
  "user_flow": "Paso 1: ... → Paso 2: ... → ..."
}`,

  summary: `Eres un evaluador de startups. Analiza toda la validación realizada y genera:
- Un score de 0 a 100 indicando qué tan validada está la idea
- Feedback constructivo con fortalezas y áreas de mejora
- 3 próximos pasos recomendados

Responde SOLO en JSON:
{
  "score": 75,
  "feedback": "...",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "next_steps": ["...", "...", "..."]
}`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { validation_id, step, prompt_type, context } = (await req.json()) as AIRequest;

    // Auth check
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPTS[prompt_type],
        messages: [{
          role: 'user',
          content: JSON.stringify(context),
        }],
      }),
    });

    const aiData = await response.json();
    const aiText = aiData.content[0].text;
    const parsed = JSON.parse(aiText);

    // Log interaction
    await supabase.from('ai_interactions').insert({
      validation_id,
      step,
      prompt_type,
      input_data: context,
      output_data: parsed,
      tokens_used: aiData.usage?.input_tokens + aiData.usage?.output_tokens,
      model: 'claude-sonnet-4-20250514',
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

---

## Hook para AI

```typescript
// src/hooks/useAI.ts
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type PromptType = 'questions' | 'customer_analysis' | 'value_prop' | 'mvp_generation' | 'summary';

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function callAI<T = any>(
    validationId: string,
    step: number,
    promptType: PromptType,
    context: Record<string, any>
  ): Promise<T | null> {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-validate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ validation_id: validationId, step, prompt_type: promptType, context }),
        }
      );

      if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
      return await res.json() as T;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { callAI, loading, error };
}
```

---

## Componentes Principales del Wizard

### Progress Bar

```typescript
// src/components/layout/ProgressBar.tsx
const STEPS = [
  { num: 1, label: 'Tu Idea' },
  { num: 2, label: 'Preguntas' },
  { num: 3, label: 'Cliente' },
  { num: 4, label: 'Valor' },
  { num: 5, label: 'MVP' },
  { num: 6, label: 'Resumen' },
];

export function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto py-6">
      {STEPS.map((step, i) => (
        <div key={step.num} className="flex items-center">
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
            transition-all duration-300
            ${current >= step.num 
              ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30' 
              : 'bg-gray-200 text-gray-500'}
          `}>
            {current > step.num ? '✓' : step.num}
          </div>
          <span className={`ml-2 text-xs hidden sm:block ${
            current >= step.num ? 'text-teal-600 font-medium' : 'text-gray-400'
          }`}>
            {step.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={`w-8 md:w-16 h-0.5 mx-2 transition-colors ${
              current > step.num ? 'bg-teal-500' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
```

### Step 1: Idea Input

```typescript
// src/components/wizard/StepIdea.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StepIdeaSchema, type StepIdea } from '@/types/validation';
import { useValidationStore } from '@/stores/validationStore';

export function StepIdea() {
  const { stepIdea, updateStepIdea, nextStep } = useValidationStore();
  
  const { register, handleSubmit, formState: { errors } } = useForm<StepIdea>({
    resolver: zodResolver(StepIdeaSchema),
    defaultValues: stepIdea,
  });

  const onSubmit = (data: StepIdea) => {
    updateStepIdea(data);
    nextStep();
  };

  const industries = [
    { value: 'fintech', label: 'Fintech' },
    { value: 'edtech', label: 'Educación' },
    { value: 'healthtech', label: 'Salud' },
    { value: 'ecommerce', label: 'E-Commerce' },
    { value: 'saas', label: 'SaaS' },
    { value: 'marketplace', label: 'Marketplace' },
    { value: 'social', label: 'Social' },
    { value: 'logistics', label: 'Logística' },
    { value: 'foodtech', label: 'FoodTech' },
    { value: 'proptech', label: 'PropTech' },
    { value: 'other', label: 'Otro' },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-xl mx-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de tu idea
        </label>
        <input
          {...register('idea_name')}
          placeholder="Ej: FreshBox, MediConnect..."
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 
                     focus:ring-teal-500 focus:border-transparent transition"
        />
        {errors.idea_name && (
          <p className="text-red-500 text-xs mt-1">{errors.idea_name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Describe tu idea
        </label>
        <textarea
          {...register('idea_description')}
          rows={4}
          placeholder="¿Qué problema resuelve? ¿Cómo funciona? ¿Para quién es?"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 
                     focus:ring-teal-500 focus:border-transparent transition resize-none"
        />
        {errors.idea_description && (
          <p className="text-red-500 text-xs mt-1">{errors.idea_description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Industria
        </label>
        <div className="grid grid-cols-3 gap-2">
          {industries.map((ind) => (
            <label key={ind.value} className="cursor-pointer">
              <input type="radio" {...register('idea_industry')} value={ind.value} className="peer hidden" />
              <div className="px-3 py-2 text-center text-sm border rounded-lg 
                            peer-checked:bg-teal-500 peer-checked:text-white peer-checked:border-teal-500
                            hover:border-teal-300 transition">
                {ind.label}
              </div>
            </label>
          ))}
        </div>
        {errors.idea_industry && (
          <p className="text-red-500 text-xs mt-1">{errors.idea_industry.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full py-3 bg-teal-500 text-white font-semibold rounded-xl 
                   hover:bg-teal-600 transition shadow-lg shadow-teal-500/30"
      >
        Siguiente →
      </button>
    </form>
  );
}
```

### Página principal del Wizard

```typescript
// src/app/routes/Validate.tsx
import { useValidationStore } from '@/stores/validationStore';
import { ProgressBar } from '@/components/layout/ProgressBar';
import { StepIdea } from '@/components/wizard/StepIdea';
import { StepQuestions } from '@/components/wizard/StepQuestions';
import { StepCustomer } from '@/components/wizard/StepCustomer';
import { StepValueProp } from '@/components/wizard/StepValueProp';
import { StepMVP } from '@/components/wizard/StepMVP';
import { StepSummary } from '@/components/wizard/StepSummary';

const STEP_COMPONENTS: Record<number, React.FC> = {
  1: StepIdea,
  2: StepQuestions,
  3: StepCustomer,
  4: StepValueProp,
  5: StepMVP,
  6: StepSummary,
};

export function Validate() {
  const { currentStep } = useValidationStore();
  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ProgressBar current={currentStep} />
        <div className="mt-8 bg-white rounded-2xl shadow-sm border p-6 md:p-10">
          <StepComponent />
        </div>
      </div>
    </div>
  );
}
```

---

## Generación de PDF (Resumen)

```typescript
// src/lib/pdf.ts
import jsPDF from 'jspdf';
import type { Validation } from '@/types/validation';

export function generateValidationPDF(data: Partial<Validation> & { summary: any }) {
  const doc = new jsPDF();
  const margin = 20;
  let y = margin;

  // Header
  doc.setFontSize(24);
  doc.setTextColor(2, 195, 154); // teal accent
  doc.text('ValidateAI', margin, y);
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Reporte de Validación · ${new Date().toLocaleDateString('es-CL')}`, margin, y);
  y += 15;

  // Score
  doc.setFontSize(48);
  doc.setTextColor(6, 90, 130);
  doc.text(`${data.summary?.score ?? '—'}/100`, margin, y + 15);
  y += 30;

  // Sections helper
  const addSection = (title: string, content: string) => {
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 46);
    doc.text(title, margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(80);
    const lines = doc.splitTextToSize(content, 170);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 10;
  };

  addSection('Idea', `${data.idea_name} — ${data.idea_description}`);
  addSection('Cliente Objetivo', data.customer_segment ?? '');
  addSection('Propuesta de Valor', data.value_proposition ?? '');
  addSection('Diferenciador', data.differentiator ?? '');
  addSection('Tipo de MVP', data.mvp_type ?? '');
  addSection('Flujo de Usuario', data.mvp_user_flow ?? '');

  if (data.mvp_features?.length) {
    addSection('Funcionalidades del MVP',
      data.mvp_features.map((f: any) => `[${f.priority}] ${f.name}: ${f.description}`).join('\n')
    );
  }

  addSection('Feedback AI', data.summary?.feedback ?? '');

  if (data.summary?.next_steps?.length) {
    addSection('Próximos Pasos',
      data.summary.next_steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')
    );
  }

  doc.save(`ValidateAI_${data.idea_name?.replace(/\s+/g, '_') ?? 'reporte'}.pdf`);
}
```

---

## Variables de Entorno

```bash
# .env.local (Vercel + local dev)

VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Solo en Supabase Edge Functions (secrets)
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

---

## Plan de Implementación Priorizado

Ejecutar en este orden exacto. Cada fase es deployable de forma independiente.

### FASE 1 — Infraestructura (día 1)

```
1. npx create-vite validateai --template react-ts
2. Instalar dependencias:
   - tailwindcss @tailwindcss/forms
   - @supabase/supabase-js
   - zustand
   - zod @hookform/resolvers react-hook-form
   - react-router-dom
   - jspdf
   - lucide-react
   - npx shadcn@latest init
3. Configurar Supabase project (dashboard)
4. Ejecutar migration SQL
5. Configurar Vercel project + env vars
6. Deploy inicial (landing placeholder)
```

### FASE 2 — Auth + Layout (día 1-2)

```
1. Implementar Supabase Auth (Google + Email)
2. Layout base: Header, Footer, rutas protegidas
3. Landing page con CTA "Validar mi idea"
4. Redirect post-login a /validate
```

### FASE 3 — Wizard Steps 1-4 (día 2-3)

```
1. StepIdea con formulario + validación Zod
2. Edge Function ai-validate con prompt "questions"
3. StepQuestions: muestra preguntas AI, recoge respuestas
4. Edge Function prompt "customer_analysis"
5. StepCustomer: muestra sugerencia AI, permite editar
6. Edge Function prompt "value_prop"
7. StepValueProp: muestra propuesta, permite refinar
8. Persistir cada step en Supabase (auto-save)
```

### FASE 4 — MVP Generation + Summary (día 3-4)

```
1. Edge Function prompt "mvp_generation"
2. StepMVP: muestra features con prioridad, tipo de producto
3. Edge Function prompt "summary"
4. StepSummary: score visual, feedback, próximos pasos
5. Botón "Descargar PDF" con jsPDF
6. Marcar validación como completed
```

### FASE 5 — Polish + Deploy (día 4-5)

```
1. Animaciones de transición entre steps (framer-motion)
2. Loading states con skeleton + mensajes contextuales
3. Responsive design mobile-first
4. Error boundaries + toast notifications
5. SEO meta tags en landing
6. Deploy final a Vercel
```

---

## Comandos Clave para Claude Code

```bash
# Iniciar proyecto
npx create-vite validateai --template react-ts
cd validateai && npm install

# Dependencias core
npm install @supabase/supabase-js zustand zod react-hook-form @hookform/resolvers react-router-dom jspdf lucide-react

# Tailwind
npm install -D tailwindcss @tailwindcss/forms autoprefixer postcss

# shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button input textarea card badge dialog toast

# Supabase CLI (para Edge Functions)
npm install -g supabase
supabase init
supabase functions new ai-validate
supabase db push

# Deploy
vercel --prod
```

---

## Notas de Escalabilidad

Estas decisiones están tomadas desde el inicio para no tener que refactorizar después:

- **RLS en todas las tablas** → multi-tenant desde día 1.
- **ai_interactions como tabla separada** → permite analytics de uso, costos, y debugging sin tocar validations.
- **Zod schemas compartidos** → la misma validación corre en frontend y se puede reusar en Edge Functions.
- **Zustand con persist** → el usuario no pierde progreso si cierra el tab accidentalmente.
- **Edge Functions (no API routes en Vercel)** → la API key de Anthropic nunca sale de Supabase, más seguro.
- **JSONB para datos flexibles** (questions_answers, mvp_features, summary) → permite evolucionar el schema sin migraciones destructivas.
- **Índices en user_id y status** → queries rápidas incluso con miles de validaciones.
