# Plan de implementación — ValidateAI Sprint
## Selector de flow + correcciones críticas

> Basado en la auditoría completa del 2026-04-27.
> Todo el trabajo va dentro de `validateai/`.
> Implementar en el orden indicado — hay dependencias entre tareas.

---

## CONTEXTO DEL ESTADO ACTUAL

El wizard actual tiene **4 steps reales**:
- Step 1 `StepIdea.tsx` → idea_name, idea_description, idea_industry
- Step 2 `StepMarket.tsx` → customer_segment, target_country, target_region, business_model, pricing_range
- Step 3 `StepFounder.tsx` → yearsInIndustry, hasTechnicalCofounder, personallyFacedProblem
- Step 4 `StepGenerating.tsx` → llama IA en paralelo (summary + market_sizing + competitive_analysis) → redirige a /results/:id

El store Zustand (`validationStore`) ya tiene `validationId`, `currentStep`, `stepIdea`, `stepMarket`, `stepFounder` como campos principales. Los campos `riskAnalysis`, `unitEconomics`, `founderFit`, `marketSignals` del store **nunca se usan** — StepGenerating guarda directo en DB.

**NO existe ningún selector de flow actualmente.** No hay flag, campo en DB, ni lógica de skip en el código.

---

## BLOQUE 1 — Correcciones críticas (hacer primero)

### 1.1 — Ruta /pricing rota 🔴

`LockedSection.tsx` tiene un link a `/pricing` que no existe en `App.tsx`. Todos los usuarios tier `free` ven un botón roto.

**Crear `src/app/routes/Pricing.tsx`:**

```tsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function Pricing() {
  const navigate = useNavigate()

  const plans = [
    {
      name: 'Free',
      price: 'Gratis',
      features: ['3 validaciones/mes', 'Score de viabilidad', 'Análisis básico'],
      cta: 'Tu plan actual',
      disabled: true,
    },
    {
      name: 'Basic',
      price: '$9.990 CLP/mes',
      features: ['10 validaciones/mes', 'Análisis competitivo', 'Market sizing', 'PDF export'],
      cta: 'Próximamente',
      disabled: true,
    },
    {
      name: 'Pro',
      price: '$24.990 CLP/mes',
      features: ['Ilimitadas', 'Todo Basic +', 'Entregables completos', 'Estudio de mercado Chile', 'Mentores'],
      cta: 'Próximamente',
      disabled: true,
    },
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0EFF8]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-[#8B8AA0] hover:text-[#F0EFF8] mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">Planes ValidateAI</h1>
          <p className="text-[#8B8AA0]">Próximamente. Por ahora todos los planes están en acceso anticipado gratuito.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="border border-white/8 rounded-2xl p-6 flex flex-col"
            >
              <h2 className="text-lg font-semibold mb-1">{plan.name}</h2>
              <p className="text-2xl font-bold mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-[#8B8AA0] flex items-center gap-2">
                    <span className="text-[#7C6FF7]">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={plan.disabled}
                className="w-full py-2 rounded-xl bg-[#7C6FF7]/20 text-[#7C6FF7] text-sm font-medium
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-[#8B8AA0] mt-8">
          ¿Tienes preguntas? Escríbenos a{' '}
          <a href="mailto:lucianoalonso2000@gmail.com" className="text-[#7C6FF7] hover:underline">
            lucianoalonso2000@gmail.com
          </a>
        </p>
      </div>
    </div>
  )
}
```

**Agregar ruta en `App.tsx`** (fuera del ProtectedLayout, accesible sin login):

```tsx
import Pricing from './app/routes/Pricing'

// En <Routes>, sin protección:
<Route path="/pricing" element={<Pricing />} />
```

---

### 1.2 — Conectar anonymize-idea al frontend 🔴

La Edge Function existe y funciona, pero `useTrainingData.ts` solo hace `UPDATE profiles SET training_consent = true` sin llamar a la función.

**En `src/hooks/useTrainingData.ts`** (o el archivo donde se gestiona el toggle de consentimiento), agregar la invocación después del UPDATE:

```typescript
import { supabase } from '@/lib/supabase'

// Después de hacer UPDATE training_consent = true en profiles:
const enableTrainingConsent = async (validationId: string) => {
  // 1. Actualizar el perfil
  await supabase
    .from('profiles')
    .update({ training_consent: true, training_consent_at: new Date().toISOString() })
    .eq('id', userId)

  // 2. Anonimizar la validación más reciente completada
  if (validationId) {
    await supabase.functions.invoke('anonymize-idea', {
      body: { validation_id: validationId },
    })
  }
}
```

Buscar en el codebase dónde se llama `training_consent` y agregar esta lógica ahí.

---

### 1.3 — Actualizar modelo en anonymize-idea 🟢

`supabase/functions/anonymize-idea/index.ts` usa `claude-3-haiku-20240307` (modelo en deprecación).

Reemplazar:
```typescript
// Antes
model: 'claude-3-haiku-20240307'

// Después
model: 'claude-haiku-4-5-20251001'
```

---

### 1.4 — Mover shadcn de dependencies a devDependencies 🟢

En `package.json`:

```json
// Remover de "dependencies":
"shadcn": "^4.4.0"

// Agregar en "devDependencies":
"shadcn": "^4.4.0"
```

---

### 1.5 — Eliminar componentes huérfanos 🟢

Eliminar estos archivos que nadie importa:
- `src/components/shared/LoadingAI.tsx`
- `src/components/shared/SkeletonCard.tsx`

**NO eliminar** `ErrorBoundary.tsx` — conectarlo en su lugar:

**En `src/App.tsx`**, envolver el árbol de rutas:

```tsx
import ErrorBoundary from './components/shared/ErrorBoundary'

// Dentro del return:
<ErrorBoundary>
  <Router>
    <Routes>
      {/* ... todas las rutas ... */}
    </Routes>
  </Router>
</ErrorBoundary>
```

---

## BLOQUE 2 — Selector de flow de validación

### 2.1 — Migración SQL

Crear `supabase/migrations/20260427_validation_mode.sql`:

```sql
ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS validation_mode text DEFAULT 'detailed'
  CHECK (validation_mode IN ('quick', 'detailed'));

COMMENT ON COLUMN public.validations.validation_mode IS
  'quick = solo Step 1, IA infiere el resto | detailed = wizard completo (3 steps + generación)';
```

Aplicar:
```bash
supabase db push
```

---

### 2.2 — Actualizar el store Zustand

En `src/store/validationStore.ts` (o el archivo donde está definido el store), agregar:

```typescript
// En el tipo de estado (interface ValidationState o similar):
validationMode: 'quick' | 'detailed'

// En initialState / el objeto de estado inicial:
validationMode: 'detailed',

// En las acciones (dentro de set/create):
setValidationMode: (mode: 'quick' | 'detailed') =>
  set({ validationMode: mode }),

// En la acción reset (para limpiar entre validaciones):
// Asegurarse de que reset() también resetea validationMode:
reset: () => set({ ...initialState }),
```

Exportar `setValidationMode` junto a las otras acciones.

---

### 2.3 — Componente FlowSelector

Crear `src/components/wizard/FlowSelector.tsx`:

```tsx
interface FlowSelectorProps {
  value: 'quick' | 'detailed'
  onChange: (mode: 'quick' | 'detailed') => void
}

const OPTIONS = [
  {
    id: 'quick' as const,
    icon: '⚡',
    title: 'Análisis rápido',
    time: '5 min',
    desc: 'Solo describe tu idea. La IA infiere el resto.',
    bullets: ['1 formulario corto', 'Resultado inmediato', 'Score + análisis esencial'],
  },
  {
    id: 'detailed' as const,
    icon: '🔍',
    title: 'Análisis completo',
    time: '10 min',
    desc: 'Más contexto, más profundidad en el resultado.',
    bullets: ['3 pasos guiados', 'Perfil de mercado y fundador', 'Análisis founder fit incluido'],
  },
]

export function FlowSelector({ value, onChange }: FlowSelectorProps) {
  return (
    <div className="mb-8">
      <p className="text-sm text-[#8B8AA0] mb-3">¿Cómo quieres validar tu idea?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all duration-200
              ${value === opt.id
                ? 'border-[#7C6FF7] bg-[#7C6FF7]/10'
                : 'border-white/8 hover:border-white/20 bg-white/2'
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{opt.icon}</span>
              <span className="text-xs text-[#8B8AA0] bg-white/5 px-2 py-0.5 rounded-full">
                {opt.time}
              </span>
            </div>
            <p className="text-sm font-semibold text-[#F0EFF8] mb-1">{opt.title}</p>
            <p className="text-xs text-[#8B8AA0] mb-3">{opt.desc}</p>
            <ul className="space-y-1">
              {opt.bullets.map((b) => (
                <li key={b} className="text-xs text-[#8B8AA0] flex items-center gap-1.5">
                  <span className={value === opt.id ? 'text-[#7C6FF7]' : 'text-[#8B8AA0]'}>
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  )
}
```

---

### 2.4 — Integrar FlowSelector en StepIdea

En `src/components/wizard/StepIdea.tsx`, hacer estos cambios:

**1. Agregar import:**
```tsx
import { FlowSelector } from './FlowSelector'
import { useValidationStore } from '@/store/validationStore' // ajustar path
```

**2. En el componente, leer y setear el modo:**
```tsx
const { validationMode, setValidationMode } = useValidationStore()
```

**3. En el JSX, insertar el selector ANTES del formulario:**
```tsx
// Antes del <form> o del primer <div> del formulario:
<FlowSelector
  value={validationMode}
  onChange={setValidationMode}
/>

{/* A continuación, el formulario existente sin cambios */}
```

**4. En el `onSubmit` o la función que avanza al siguiente step:**
```tsx
const handleNext = (data: StepIdeaData) => {
  updateStepIdea(data)
  if (validationMode === 'quick') {
    setStep(4)   // saltar Steps 2 y 3, ir directo a generación
  } else {
    nextStep()   // comportamiento actual
  }
}
```

---

### 2.5 — Adaptar StepGenerating para el flow rápido

En `src/components/wizard/StepGenerating.tsx`, el flow rápido necesita inferir con IA los datos de Step 2 y 3 antes de llamar a `summary`.

Agregar esta lógica al inicio de la función de generación (antes de las llamadas actuales):

```typescript
import { useValidationStore } from '@/store/validationStore'

// Al inicio del componente:
const { validationMode, stepIdea, stepMarket, stepFounder } = useValidationStore()

// En la función de generación (donde se construye el context para ai-validate):
const buildContext = async () => {
  // Si es flow detallado, usar los datos del store (comportamiento actual)
  if (validationMode === 'detailed') {
    return {
      stepIdea,
      stepMarket,
      stepFounder,
    }
  }

  // Si es flow rápido, inferir stepMarket con IA
  const inferRes = await supabase.functions.invoke('ai-validate', {
    body: {
      prompt_type: 'customer_analysis',
      context: { stepIdea },
    },
  })

  // Construir un stepMarket mínimo con el resultado inferido
  const inferred = inferRes.data
  return {
    stepIdea,
    stepMarket: {
      customer_segment: inferred?.customer_segment ?? '',
      target_country: 'Chile',
      target_region: '',
      business_model: inferred?.business_model ?? '',
      pricing_range: '',
    },
    stepFounder: null, // sin datos de fundador en flow rápido
  }
}
```

**En el INSERT/UPDATE a DB en StepGenerating**, agregar el campo nuevo:

```typescript
// En el objeto que se manda a supabase.from('validations').upsert(...)
validation_mode: validationMode,
```

---

### 2.6 — Mostrar el modo en ValidationDetail y Results

En `src/app/routes/Results.tsx`, en la card de cada validación, mostrar un badge pequeño con el modo:

```tsx
// Agregar a la query de validaciones:
// .select('..., validation_mode')

// En el JSX de la card:
{v.validation_mode === 'quick' && (
  <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded-full">
    ⚡ Rápido
  </span>
)}
```

---

## BLOQUE 3 — Unificar diseño visual del wizard 🟢

`StepMarket.tsx` y `StepFounder.tsx` usan clases de tema claro (`bg-white`, `border-gray-200`, `text-gray-700`) inconsistentes con el tema oscuro del resto del wizard.

**En `StepMarket.tsx` y `StepFounder.tsx`**, reemplazar las clases de color:

| Antes (tema claro) | Después (tema oscuro) |
|---|---|
| `bg-white` | `bg-[#0A0A0F]` |
| `border-gray-200` | `border-white/8` |
| `text-gray-700` | `text-[#F0EFF8]` |
| `text-gray-500` | `text-[#8B8AA0]` |
| `text-gray-900` | `text-[#F0EFF8]` |
| `bg-gray-50` | `bg-white/3` |
| `focus:ring-blue-500` | `focus:ring-[#7C6FF7]` |
| `focus:border-blue-500` | `focus:border-[#7C6FF7]` |
| `text-blue-600` | `text-[#7C6FF7]` |
| `bg-blue-600` | `bg-[#7C6FF7]` |

---

## BLOQUE 4 — Migración de steps al DB (persistencia incremental) 🟡

Actualmente los Steps 1–3 solo persisten en Zustand (localStorage). Si el usuario cierra el browser a mitad del wizard, se recupera por Zustand pero no desde DB.

**En `StepIdea.tsx`**, al hacer submit (antes de llamar a `nextStep`), hacer un upsert:

```typescript
const saveStep1ToDB = async (data: StepIdeaData) => {
  const { validationId } = useValidationStore.getState()

  if (validationId) {
    // Actualizar validación existente
    await supabase
      .from('validations')
      .update({
        idea_name: data.idea_name,
        idea_description: data.idea_description,
        idea_industry: data.idea_industry,
        current_step: 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validationId)
  } else {
    // Crear nueva validación en DB con status in_progress
    const { data: newVal } = await supabase
      .from('validations')
      .insert({
        user_id: userId, // obtener del auth context
        idea_name: data.idea_name,
        idea_description: data.idea_description,
        idea_industry: data.idea_industry,
        status: 'in_progress',
        current_step: 2,
        validation_mode: validationMode,
      })
      .select('id')
      .single()

    if (newVal) setValidationId(newVal.id)
  }
}
```

Hacer lo mismo en `StepMarket.tsx` (guardar `customer_segment`, `target_country`, etc. y `current_step: 3`) y `StepFounder.tsx` (`current_step: 4`).

---

## Checklist de implementación

```
BLOQUE 1 — Críticos
[ ] 1.1  Crear src/app/routes/Pricing.tsx
[ ] 1.1  Agregar ruta /pricing en App.tsx (sin protección)
[ ] 1.2  Conectar anonymize-idea desde useTrainingData.ts
[ ] 1.3  Actualizar modelo en anonymize-idea/index.ts → claude-haiku-4-5-20251001
[ ] 1.4  Mover shadcn a devDependencies en package.json
[ ] 1.5  Eliminar LoadingAI.tsx y SkeletonCard.tsx
[ ] 1.5  Conectar ErrorBoundary en App.tsx

BLOQUE 2 — Flow selector
[ ] 2.1  Crear y aplicar migración 20260427_validation_mode.sql
[ ] 2.2  Agregar validationMode + setValidationMode al store Zustand
[ ] 2.3  Crear src/components/wizard/FlowSelector.tsx
[ ] 2.4  Integrar FlowSelector en StepIdea.tsx (antes del form)
[ ] 2.4  Agregar lógica de skip en StepIdea.tsx onSubmit
[ ] 2.5  Adaptar StepGenerating.tsx para flow rápido (customer_analysis inference)
[ ] 2.5  Agregar validation_mode en el INSERT/UPDATE de StepGenerating
[ ] 2.6  Agregar badge de modo en Results.tsx

BLOQUE 3 — Visual
[ ] 3.1  Unificar tema oscuro en StepMarket.tsx
[ ] 3.2  Unificar tema oscuro en StepFounder.tsx

BLOQUE 4 — Persistencia (opcional en este sprint)
[ ] 4.1  Guardar Step 1 en DB al avanzar (con upsert)
[ ] 4.2  Guardar Step 2 en DB al avanzar
[ ] 4.3  Guardar Step 3 en DB al avanzar
```

---

## Notas para Claude Code

- **El flow rápido salta a `setStep(4)` directamente**, no usa `nextStep()`. `setStep` debe ser una acción del store — verificar que exista o crearla si solo existe `nextStep`.
- **`customer_analysis`** ya existe como prompt_type en `ai-validate` — no crear uno nuevo.
- En el flow rápido, `stepFounder` quedará `null`. El prompt de `summary` en ai-validate debe manejar founder context nulo sin crashear — revisar el prompt y agregar un fallback `"No disponible"` si es necesario.
- La columna `current_step CHECK (1–6)` en DB tiene un check incorrecto — debería ser (1–4). Corregirlo en la misma migración del Bloque 2:
  ```sql
  ALTER TABLE public.validations DROP CONSTRAINT IF EXISTS validations_current_step_check;
  ALTER TABLE public.validations ADD CONSTRAINT validations_current_step_check CHECK (current_step BETWEEN 1 AND 4);
  ```
- **No tocar** `ai-validate/index.ts` a menos que sea para el fallback de founder context nulo.
- **No tocar** `market-analyze/index.ts` — está deployado y funcionando.
- La ruta `/pricing` va **fuera del ProtectedLayout** — es accesible sin login.
