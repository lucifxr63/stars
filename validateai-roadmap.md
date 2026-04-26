# ValidateAI — Plan de Implementación por Fases

> **Contexto:** ValidateAI es una SPA (React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Supabase + Vercel) que guía a emprendedores a validar ideas de negocio con IA mediante un wizard de 6 pasos. Actualmente genera un score (0–100), feedback y plan de MVP usando GPT-4o-mini via Supabase Edge Functions (Deno).
>
> **Objetivo de este plan:** Evolucionar la plataforma desde una validación superficial a una validación con datos reales de mercado (competencia, gaps, TAM/SAM/SOM), localizada por país.

---

## Fase 1 — Enriquecer la Recolección de Datos del Usuario

**Objetivo:** Capturar contexto de mercado del emprendedor para que la IA deje de dar respuestas genéricas y pueda contextualizar por país, etapa y competencia.

**Duración estimada:** 2–3 semanas

### 1.1 — Migración de Base de Datos

Crear una nueva migración SQL en `supabase/migrations/004_market_context.sql` que agregue las siguientes columnas a la tabla `validations`:

```sql
ALTER TABLE validations
  ADD COLUMN target_country       text,           -- País objetivo (ej: "Chile", "México")
  ADD COLUMN target_region        text,           -- Región/ciudad opcional (ej: "Santiago", "CDMX")
  ADD COLUMN pricing_range        text,           -- Rango de precio estimado (ej: "free", "1-10 USD", "10-50 USD", "50-100 USD", "100+ USD")
  ADD COLUMN business_stage       text,           -- Etapa: "idea" | "pre-product" | "early" | "growth"
  ADD COLUMN known_competitors    text[],         -- Competidores que el usuario ya conoce (máx 5)
  ADD COLUMN business_model       text;           -- Modelo de negocio: "b2b" | "b2c" | "b2b2c" | "marketplace"
```

Ejecutar la migración con `supabase db push` o aplicarla directamente en el dashboard de Supabase.

### 1.2 — Actualizar Types de TypeScript

En `src/types/validation.ts`, extender la interfaz de validación para incluir los nuevos campos:

```typescript
// Agregar a la interfaz existente de Validation:
target_country?: string;
target_region?: string;
pricing_range?: string;
business_stage?: 'idea' | 'pre-product' | 'early' | 'growth';
known_competitors?: string[];
business_model?: 'b2b' | 'b2c' | 'b2b2c' | 'marketplace';
```

Crear también un type para las opciones de cada campo:

```typescript
export const PRICING_RANGES = ['free', '1-10 USD', '10-50 USD', '50-100 USD', '100+ USD'] as const;
export const BUSINESS_STAGES = ['idea', 'pre-product', 'early', 'growth'] as const;
export const BUSINESS_MODELS = ['b2b', 'b2c', 'b2b2c', 'marketplace'] as const;

// Lista de países latinoamericanos + España + USA para el selector
export const TARGET_COUNTRIES = [
  'Chile', 'México', 'Argentina', 'Colombia', 'Perú', 'Brasil',
  'Ecuador', 'Uruguay', 'Paraguay', 'Bolivia', 'Venezuela',
  'Costa Rica', 'Panamá', 'Guatemala', 'Rep. Dominicana',
  'España', 'Estados Unidos', 'Otro'
] as const;
```

### 1.3 — Modificar Step 1 del Wizard (StepIdea)

Actualmente `StepIdea` captura: `idea_name`, `idea_description`, `idea_industry`.

**Agregar los siguientes campos al formulario de Step 1**, debajo de los campos existentes, usando los componentes de shadcn/ui:

1. **País objetivo** (`target_country`) — Select/Combobox con la lista de `TARGET_COUNTRIES`. Campo obligatorio.
2. **Región/ciudad** (`target_region`) — Input de texto libre, opcional. Placeholder: "Ej: Santiago, Región Metropolitana".
3. **Modelo de negocio** (`business_model`) — Radio group con las opciones de `BUSINESS_MODELS`. Campo obligatorio.
4. **Etapa del proyecto** (`business_stage`) — Radio group con las opciones de `BUSINESS_STAGES`. Campo obligatorio.
5. **Rango de precio estimado** (`pricing_range`) — Select con las opciones de `PRICING_RANGES`. Campo obligatorio.
6. **Competidores conocidos** (`known_competitors`) — Input con "chips" o tags. El usuario escribe un nombre y presiona Enter para agregarlo. Máximo 5. Campo opcional.

**Validación con Zod:** Agregar los nuevos campos al schema de validación de React Hook Form en este step:

```typescript
const stepIdeaSchema = z.object({
  idea_name: z.string().min(3, 'Mínimo 3 caracteres'),
  idea_description: z.string().min(20, 'Describe tu idea con más detalle'),
  idea_industry: z.string().min(1, 'Selecciona una industria'),
  target_country: z.string().min(1, 'Selecciona un país'),
  target_region: z.string().optional(),
  business_model: z.enum(['b2b', 'b2c', 'b2b2c', 'marketplace']),
  business_stage: z.enum(['idea', 'pre-product', 'early', 'growth']),
  pricing_range: z.string().min(1, 'Selecciona un rango de precio'),
  known_competitors: z.array(z.string()).max(5).optional(),
});
```

**UX:** Organizar visualmente los campos en dos secciones dentro del mismo step:
- Sección 1: "Tu idea" (nombre, descripción, industria) — campos existentes.
- Sección 2: "Contexto de mercado" (país, región, modelo, etapa, precio, competidores) — campos nuevos.

Usar un `Separator` de shadcn entre ambas secciones con un label tipo "Sobre tu mercado".

### 1.4 — Actualizar Zustand Store

En `src/stores/validationStore.ts`, agregar los nuevos campos al state y al método `saveStep` para que se persistan correctamente tanto en localStorage como en Supabase.

### 1.5 — Actualizar `useValidation.saveStep()`

En `src/hooks/useValidation.ts`, asegurarse de que `saveStep()` incluya los nuevos campos cuando guarda el Step 1 en Supabase.

### 1.6 — Actualizar los Prompts de la Edge Function

En `supabase/functions/ai-validate/index.ts`, modificar TODOS los prompts de los 5 tipos (`questions`, `customer_analysis`, `value_prop`, `mvp_generation`, `summary`) para incluir el nuevo contexto de mercado en el prompt:

```
Contexto de mercado:
- País objetivo: ${target_country}
- Región: ${target_region || 'No especificada'}
- Modelo de negocio: ${business_model}
- Etapa: ${business_stage}
- Rango de precio: ${pricing_range}
- Competidores conocidos por el usuario: ${known_competitors?.join(', ') || 'Ninguno'}
```

Esto hará que TODAS las respuestas de la IA estén contextualizadas desde Step 2 en adelante.

### 1.7 — Actualizar Admin Panel

En `src/app/routes/Admin.tsx`, agregar a la tabla de validaciones las nuevas columnas `target_country` y `business_stage` como filtros, para que el admin pueda ver de qué países vienen los usuarios y en qué etapa están.

---

## Fase 2 — Análisis de Competencia y Gap Automático

**Objetivo:** Que la IA genere un análisis competitivo estructurado para cada validación, identificando competidores, gaps de mercado y dolores no resueltos, usando web search cuando sea posible.

**Duración estimada:** 3–4 semanas

**Prerequisito:** Fase 1 completada (se necesita `target_country`, `known_competitors`, etc.)

### 2.1 — Migración de Base de Datos

Crear `supabase/migrations/005_competitive_analysis.sql`:

```sql
ALTER TABLE validations
  ADD COLUMN competitive_analysis jsonb;
  -- Estructura esperada:
  -- {
  --   "competitors": [
  --     {
  --       "name": "string",
  --       "url": "string | null",
  --       "description": "string",
  --       "target_market": "string",
  --       "strengths": ["string"],
  --       "weaknesses": ["string"],
  --       "pricing": "string | null",
  --       "source": "user_provided | ai_identified | web_search"
  --     }
  --   ],
  --   "market_gaps": [
  --     {
  --       "gap": "string",
  --       "opportunity": "string",
  --       "confidence": "high | medium | low"
  --     }
  --   ],
  --   "unmet_pains": ["string"],
  --   "competitive_advantage_suggestion": "string",
  --   "data_sources": ["ai_knowledge" | "web_search" | "user_input"]
  -- }
```

### 2.2 — Migrar Edge Function de OpenAI a Anthropic

**Este es el momento de resolver la deuda técnica roja.** Cambiar la Edge Function `supabase/functions/ai-validate/index.ts` de OpenAI a la API de Anthropic.

**Pasos:**

1. En los Secrets de Supabase, agregar `ANTHROPIC_API_KEY` (se puede mantener `OPENAI_API_KEY` como fallback temporalmente).

2. Reemplazar la llamada a OpenAI por una llamada a la API de Anthropic. La Edge Function corre en Deno, así que usar `fetch` directamente:

```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
    // Para el análisis competitivo, habilitar web search:
    tools: promptType === 'competitive_analysis' ? [
      { type: 'web_search_20250305', name: 'web_search' }
    ] : undefined,
  }),
});
```

3. Adaptar el parsing de la respuesta. La API de Anthropic devuelve `content` como array de bloques:

```typescript
const data = await response.json();
const textContent = data.content
  .filter((block: any) => block.type === 'text')
  .map((block: any) => block.text)
  .join('');
const result = JSON.parse(textContent);
```

4. Actualizar el campo `model` en la tabla `ai_interactions` para que guarde `claude-sonnet-4-20250514`.

5. Actualizar TODOS los prompts existentes para que funcionen con Claude (el formato de respuesta JSON se mantiene, solo ajustar el system prompt si es necesario).

### 2.3 — Crear Nuevo Tipo de Prompt: `competitive_analysis`

En la Edge Function, agregar un nuevo `prompt_type` llamado `competitive_analysis` que se ejecutará entre el Step 3 (Customer) y el Step 4 (Value Prop), o como parte del Step 3.

**Prompt para análisis competitivo (usar con web_search habilitado):**

```
Eres un analista de mercado experto. Analiza la competencia para la siguiente idea de negocio.

IDEA: ${idea_name}
DESCRIPCIÓN: ${idea_description}
INDUSTRIA: ${idea_industry}
PAÍS OBJETIVO: ${target_country}
REGIÓN: ${target_region || 'Nacional'}
MODELO: ${business_model}
COMPETIDORES MENCIONADOS POR EL USUARIO: ${known_competitors?.join(', ') || 'Ninguno'}

INSTRUCCIONES:
1. Identifica 4-6 competidores relevantes en el mercado de ${target_country} (incluyendo los mencionados por el usuario si los hay). Busca competidores locales Y globales que operen en ese mercado.
2. Para cada competidor, proporciona: nombre, URL (si la encuentras), descripción breve, mercado objetivo, 2-3 fortalezas, 2-3 debilidades, y modelo de precios si es público.
3. Identifica 3-5 gaps de mercado: necesidades que ningún competidor resuelve bien.
4. Identifica 2-3 dolores no resueltos específicos del mercado de ${target_country}.
5. Sugiere una ventaja competitiva que esta idea podría explotar.

Indica para cada dato si proviene de búsqueda web, tu conocimiento, o del input del usuario.

Responde SOLO con JSON válido con esta estructura exacta:
{
  "competitors": [...],
  "market_gaps": [...],
  "unmet_pains": [...],
  "competitive_advantage_suggestion": "...",
  "data_sources": [...]
}
```

### 2.4 — Agregar Step Intermedio o Pantalla de Competencia

**Opción recomendada:** No agregar un step nuevo al wizard (mantener 6 pasos) sino ejecutar el análisis competitivo como parte del procesamiento del Step 3 (StepCustomer). Cuando la IA analiza el segmento de cliente, también ejecuta el análisis competitivo en paralelo.

**Alternativa:** Agregar una pantalla de resultados de competencia dentro de `ValidationDetail.tsx` como una tab o sección expandible.

**Implementación en el frontend:**

1. En `src/hooks/useValidation.ts`, cuando se procesa el Step 3, hacer DOS llamadas a la Edge Function en paralelo:
   - `customer_analysis` (existente)
   - `competitive_analysis` (nueva)

```typescript
// En saveStep para step 3:
const [customerResult, competitiveResult] = await Promise.all([
  callAI('customer_analysis', inputData),
  callAI('competitive_analysis', inputData),
]);
```

2. Guardar `competitiveResult` en el campo `competitive_analysis` de la validación.

3. Mostrar el análisis competitivo al usuario. Crear un componente `CompetitiveAnalysis.tsx` en `src/components/shared/` que renderice:
   - Tabla de competidores con nombre, fortalezas, debilidades.
   - Lista de gaps de mercado con nivel de confianza (badge con color).
   - Dolores no resueltos.
   - Sugerencia de ventaja competitiva destacada.

4. Mostrar este componente:
   - En el Step 3, debajo del análisis de cliente, como sección colapsable "Análisis de competencia".
   - En `ValidationDetail.tsx`, como tab dedicada.

### 2.5 — Alimentar Steps Siguientes con Datos de Competencia

Modificar los prompts de Step 4 (value_prop) y Step 5 (mvp_generation) para incluir el análisis competitivo como contexto:

```
ANÁLISIS COMPETITIVO PREVIO:
Competidores principales: ${competitors.map(c => c.name + ': ' + c.description).join('; ')}
Gaps identificados: ${market_gaps.map(g => g.gap).join('; ')}
Dolores no resueltos: ${unmet_pains.join('; ')}
```

Esto hará que la propuesta de valor y el MVP estén informados por la competencia real.

### 2.6 — Indicador de Confianza

Agregar a cada sección del análisis un badge de confianza:
- 🟢 **Alta** — Dato verificado via web search.
- 🟡 **Media** — Basado en conocimiento de la IA.
- 🔴 **Baja** — Estimación, el usuario debería verificar.

El badge se renderiza según el campo `source` de cada competidor y el campo `confidence` de cada gap.

### 2.7 — Actualizar Admin Panel

Agregar a la tab "Validaciones" del admin:
- Nueva columna con count de competidores identificados.
- En la fila expandida, mostrar el JSON de `competitive_analysis` formateado.

En la tab "AI Usage":
- Agregar `competitive_analysis` como nuevo tipo de prompt en los gráficos de uso.

---

## Fase 3 — TAM, SAM, SOM Estimado por País

**Objetivo:** Generar una estimación de tamaño de mercado (TAM → SAM → SOM) contextualizada por país, industria y modelo de negocio, presentada como rangos con fuentes.

**Duración estimada:** 2–3 semanas

**Prerequisito:** Fase 2 completada (se necesita el análisis competitivo para calcular SOM)

### 3.1 — Migración de Base de Datos

Crear `supabase/migrations/006_market_sizing.sql`:

```sql
ALTER TABLE validations
  ADD COLUMN market_sizing jsonb;
  -- Estructura esperada:
  -- {
  --   "tam": {
  --     "value_low": number,       -- en USD
  --     "value_high": number,      -- en USD
  --     "currency": "USD",
  --     "description": "string",   -- Ej: "Mercado global de generación de documentos con IA"
  --     "source_notes": "string",  -- De dónde viene la estimación
  --     "confidence": "high | medium | low"
  --   },
  --   "sam": {
  --     "value_low": number,
  --     "value_high": number,
  --     "currency": "USD",
  --     "description": "string",   -- Ej: "Pymes en Chile que pagan por software documental"
  --     "source_notes": "string",
  --     "confidence": "high | medium | low"
  --   },
  --   "som": {
  --     "value_low": number,
  --     "value_high": number,
  --     "currency": "USD",
  --     "description": "string",   -- Ej: "Captura realista año 1-2 considerando competencia"
  --     "source_notes": "string",
  --     "assumptions": ["string"], -- Ej: ["5% de penetración en primer año", "Churn del 10%"]
  --     "confidence": "high | medium | low"
  --   },
  --   "methodology": "string",     -- Descripción del approach usado (top-down, bottom-up, etc.)
  --   "data_freshness": "string"   -- Ej: "Datos de 2024-2025, estimaciones actualizadas"
  -- }
```

### 3.2 — Actualizar Types de TypeScript

En `src/types/validation.ts`, agregar:

```typescript
export interface MarketSizingTier {
  value_low: number;
  value_high: number;
  currency: string;
  description: string;
  source_notes: string;
  confidence: 'high' | 'medium' | 'low';
  assumptions?: string[];
}

export interface MarketSizing {
  tam: MarketSizingTier;
  sam: MarketSizingTier;
  som: MarketSizingTier;
  methodology: string;
  data_freshness: string;
}
```

### 3.3 — Crear Nuevo Tipo de Prompt: `market_sizing`

En la Edge Function, agregar `market_sizing` como nuevo `prompt_type`. Ejecutar con web_search habilitado para buscar datos de mercado reales.

**Prompt:**

```
Eres un analista de mercado especializado en sizing de mercados para startups. Genera una estimación TAM/SAM/SOM para la siguiente idea de negocio.

IDEA: ${idea_name}
DESCRIPCIÓN: ${idea_description}
INDUSTRIA: ${idea_industry}
PAÍS OBJETIVO: ${target_country}
REGIÓN: ${target_region || 'Nacional'}
MODELO DE NEGOCIO: ${business_model}
RANGO DE PRECIO: ${pricing_range}
ETAPA: ${business_stage}
SEGMENTO DE CLIENTE: ${customer_segment}

COMPETIDORES IDENTIFICADOS:
${competitive_analysis.competitors.map(c => `- ${c.name}: ${c.description}`).join('\n')}

INSTRUCCIONES:
1. TAM (Total Addressable Market): Estima el mercado total global de esta industria/categoría. Busca reportes de mercado recientes (Statista, Grand View Research, etc.).
2. SAM (Serviceable Addressable Market): Filtra por el país objetivo (${target_country}), el modelo de negocio (${business_model}), y el segmento específico (${customer_segment}).
3. SOM (Serviceable Obtainable Market): Estima la porción realista captureable en 1-2 años considerando:
   - Etapa actual (${business_stage})
   - Número de competidores activos
   - Pricing (${pricing_range})
   - Barreras de entrada del mercado
4. Todos los valores en USD. Presenta como RANGOS (low-high), nunca cifras exactas.
5. Para cada tier, indica la fuente (reporte de mercado, dato público, estimación propia) y nivel de confianza.
6. Incluye las asunciones clave del SOM.

Responde SOLO con JSON válido con esta estructura exacta:
{
  "tam": { "value_low": number, "value_high": number, "currency": "USD", "description": "...", "source_notes": "...", "confidence": "high|medium|low" },
  "sam": { "value_low": number, "value_high": number, "currency": "USD", "description": "...", "source_notes": "...", "confidence": "high|medium|low" },
  "som": { "value_low": number, "value_high": number, "currency": "USD", "description": "...", "source_notes": "...", "assumptions": ["..."], "confidence": "high|medium|low" },
  "methodology": "...",
  "data_freshness": "..."
}
```

### 3.4 — Integrar en el Flujo del Wizard

Ejecutar `market_sizing` como parte del procesamiento del Step 5 (StepMVP) o Step 6 (StepSummary), ya que en ese punto se tienen todos los datos necesarios (idea + cliente + competencia + propuesta de valor).

**Recomendación:** Ejecutar junto con el Step 5 (MVP) en paralelo:

```typescript
// En saveStep para step 5:
const [mvpResult, marketResult] = await Promise.all([
  callAI('mvp_generation', inputData),
  callAI('market_sizing', inputData),
]);
```

### 3.5 — Componente Visual: Funnel TAM → SAM → SOM

Crear `src/components/shared/MarketFunnel.tsx` — un componente visual que muestre el funnel de mercado.

**Implementación con Recharts** (ya instalado en el proyecto):

- Usar un `FunnelChart` de Recharts o un gráfico de barras horizontal con 3 barras decrecientes (TAM la más grande, SOM la más pequeña).
- Cada barra muestra el rango (ej: "$2.5B – $3.1B").
- Badge de confianza al lado de cada tier.
- Debajo del gráfico, mostrar:
  - Metodología usada.
  - Assumptions del SOM como lista.
  - Source notes colapsables.

**Alternativa si FunnelChart no está disponible en Recharts v3:** Crear un SVG custom con 3 trapezoides apilados, coloreados con la paleta del tema.

### 3.6 — Mostrar en el Frontend

1. En `StepSummary` (Step 6): Agregar una sección "Tamaño de mercado estimado" con el componente `MarketFunnel`.
2. En `ValidationDetail.tsx`: Agregar como tab o sección después del análisis competitivo.
3. En el export PDF: Incluir el funnel como imagen (renderizar el componente a canvas o generar un gráfico estático).

### 3.7 — Actualizar el Score Final

Modificar el prompt de `summary` (Step 6) para que el score (0–100) tome en cuenta el tamaño de mercado:

```
DATOS DE MERCADO:
TAM: $${tam.value_low}–$${tam.value_high} (${tam.confidence})
SAM: $${sam.value_low}–$${sam.value_high} (${sam.confidence})
SOM: $${som.value_low}–$${som.value_high} (${som.confidence})

Usa estos datos para contextualizar el score. Un SOM grande con competencia baja debería subir el score. Un SOM pequeño con mucha competencia debería bajarlo.
```

---

## Fase 4 — Reporte Final Mejorado y Localización

**Objetivo:** Transformar el reporte final en un documento de validación profesional que integre todos los datos generados, con branding, localización y export PDF de calidad.

**Duración estimada:** 2–3 semanas

**Prerequisito:** Fases 1–3 completadas

### 4.1 — Rediseñar la Pantalla de Resultados (Step 6 — StepSummary)

Reestructurar `StepSummary` para que sea un reporte completo con las siguientes secciones:

1. **Header:** Score gauge (existente) + nombre de la idea + país + industria + fecha.
2. **Resumen ejecutivo:** Feedback de la IA (existente) pero ahora contextualizado con datos de mercado y competencia.
3. **Análisis de mercado:**
   - Funnel TAM/SAM/SOM (componente de Fase 3).
   - Contexto: país, modelo de negocio, pricing.
4. **Mapa competitivo:**
   - Tabla de competidores (componente de Fase 2).
   - Gaps y oportunidades.
5. **Cliente objetivo:**
   - Segmento (existente).
   - Pain points (existente).
   - Dolores no resueltos del mercado (de Fase 2).
6. **Propuesta de valor y diferenciador** (existente).
7. **Plan de MVP:**
   - Tipo de MVP y features priorizadas (existente).
   - Flujo de usuario (existente).
8. **Fortalezas, Áreas de Mejora, Próximos Pasos** (existente) — pero ahora alimentados con datos de competencia y mercado.

**Layout:** Usar un diseño tipo reporte con secciones colapsables. Navegación lateral (sidebar sticky) con links a cada sección para scroll rápido.

### 4.2 — Contextualizar el Score por Mercado

Modificar el prompt de `summary` para que la IA genere un score breakdown:

```
Genera un desglose del score en estas categorías (cada una de 0 a 100):
- problem_score: ¿El problema es real y urgente?
- market_score: ¿El mercado es grande y accesible?
- competition_score: ¿Hay espacio competitivo? (100 = poco competido, 0 = saturado)
- solution_score: ¿La solución es viable y diferenciada?
- execution_score: ¿El plan de MVP es realista para la etapa actual?

El score final es el promedio ponderado:
- problem: 25%
- market: 20%
- competition: 15%
- solution: 25%
- execution: 15%
```

Agregar columna `score_breakdown` (jsonb) a la tabla `validations`:

```sql
ALTER TABLE validations
  ADD COLUMN score_breakdown jsonb;
  -- { "problem": 85, "market": 70, "competition": 90, "solution": 80, "execution": 75 }
```

Crear un componente `ScoreBreakdown.tsx` que muestre un radar chart (Recharts `RadarChart`) con las 5 dimensiones.

### 4.3 — Mejorar Export PDF

Reemplazar la implementación actual de `html2canvas` por una generación de PDF profesional.

**Opción recomendada:** Usar `jsPDF` (ya instalado) pero con generación directa en vez de screenshot con `html2canvas`.

En `src/lib/pdf.ts`, crear una función `generateValidationPDF()` que:

1. Cree un documento con branding:
   - Logo de ValidateAI en header.
   - Colores del tema.
   - Tipografía consistente.
   - Pie de página con "ValidateAI — valida tu idea antes de construirla" + número de página.

2. Incluya todas las secciones del reporte:
   - Portada con nombre de idea, score, fecha, país.
   - Resumen ejecutivo.
   - Análisis de mercado con tabla de TAM/SAM/SOM.
   - Mapa competitivo como tabla.
   - Cliente y propuesta de valor.
   - Plan de MVP con features en tabla.
   - Fortalezas, mejoras, próximos pasos.

3. Renderice los gráficos:
   - Convertir el radar chart (ScoreBreakdown) a imagen con `html2canvas` solo para ese componente específico (no toda la página).
   - O generar los gráficos directamente con las primitivas de jsPDF (líneas, arcos, etc.).

4. Incluya un disclaimer: "Este análisis fue generado con IA y datos estimados. Los datos de mercado son aproximaciones y deben verificarse con investigación adicional."

### 4.4 — Localización de Respuestas

Asegurar que TODOS los prompts de la Edge Function incluyan la instrucción de idioma:

```
IMPORTANTE: Responde siempre en español. Usa moneda local cuando sea relevante (CLP para Chile, MXN para México, etc.) además de USD.
```

Para el análisis competitivo, priorizar competidores locales del país objetivo.

### 4.5 — Pantalla de Compartir

Agregar un botón "Compartir resultados" en `ValidationDetail.tsx` que:

1. Genere una URL pública única para la validación (requiere nueva tabla o campo `share_token` en `validations`).
2. La URL muestra una versión read-only del reporte sin necesidad de login.
3. Agregar RLS policy para permitir lectura pública cuando hay `share_token`.

Migración:

```sql
ALTER TABLE validations
  ADD COLUMN share_token text UNIQUE;

-- Policy: cualquiera puede leer si tiene el share_token
CREATE POLICY "public_shared_validation" ON validations
  FOR SELECT
  USING (share_token IS NOT NULL AND share_token = current_setting('request.headers')::json->>'x-share-token');
```

**Alternativa más simple:** Generar el share_token y crear una ruta `/shared/:token` que haga una query con el token directamente (sin depender de headers custom).

### 4.6 — Actualizar Admin Panel — Métricas de Mercado

Agregar a la tab "Métricas" del admin:
- **Distribución por país** — Pie chart de validaciones por `target_country`.
- **Distribución por etapa** — Bar chart de `business_stage`.
- **Score promedio por categoría** — Radar chart con el promedio de `score_breakdown` de todas las validaciones.
- **Top industrias por país** — Tabla cruzada.

---

## Resumen de Migraciones

| Archivo | Fase | Columnas |
|---------|------|----------|
| `004_market_context.sql` | 1 | `target_country`, `target_region`, `pricing_range`, `business_stage`, `known_competitors`, `business_model` |
| `005_competitive_analysis.sql` | 2 | `competitive_analysis` (jsonb) |
| `006_market_sizing.sql` | 3 | `market_sizing` (jsonb) |
| `007_score_breakdown.sql` | 4 | `score_breakdown` (jsonb), `share_token` (text) |

---

## Resumen de Nuevos Componentes Frontend

| Componente | Fase | Ubicación |
|------------|------|-----------|
| Campos de contexto de mercado en StepIdea | 1 | `src/components/wizard/StepIdea.tsx` |
| `CompetitiveAnalysis.tsx` | 2 | `src/components/shared/CompetitiveAnalysis.tsx` |
| `MarketFunnel.tsx` | 3 | `src/components/shared/MarketFunnel.tsx` |
| `ScoreBreakdown.tsx` (radar chart) | 4 | `src/components/shared/ScoreBreakdown.tsx` |
| Reporte completo en StepSummary | 4 | `src/components/wizard/StepSummary.tsx` |
| PDF profesional | 4 | `src/lib/pdf.ts` |
| Pantalla de share | 4 | `src/app/routes/SharedValidation.tsx` |

---

## Resumen de Nuevos Prompt Types (Edge Function)

| Prompt Type | Fase | Web Search | Se ejecuta en |
|-------------|------|------------|---------------|
| `competitive_analysis` | 2 | ✅ Sí | Step 3 (paralelo con `customer_analysis`) |
| `market_sizing` | 3 | ✅ Sí | Step 5 (paralelo con `mvp_generation`) |
| `summary` (modificado) | 4 | No | Step 6 (ahora genera `score_breakdown`) |

---

## Orden de Ejecución Recomendado

```
Fase 1 (semanas 1-3):
  ├── 1.1 Migración DB
  ├── 1.2 Types TS
  ├── 1.3 Modificar StepIdea
  ├── 1.4 Zustand store
  ├── 1.5 useValidation hook
  ├── 1.6 Prompts Edge Function
  └── 1.7 Admin panel

Fase 2 (semanas 4-7):
  ├── 2.2 Migrar OpenAI → Anthropic  ← HACER PRIMERO
  ├── 2.1 Migración DB
  ├── 2.3 Prompt competitive_analysis
  ├── 2.4 Componente + integración wizard
  ├── 2.5 Alimentar steps siguientes
  ├── 2.6 Indicador de confianza
  └── 2.7 Admin panel

Fase 3 (semanas 8-10):
  ├── 3.1 Migración DB
  ├── 3.2 Types TS
  ├── 3.3 Prompt market_sizing
  ├── 3.4 Integración wizard
  ├── 3.5 Componente MarketFunnel
  ├── 3.6 Mostrar en frontend
  └── 3.7 Actualizar score

Fase 4 (semanas 11-13):
  ├── 4.1 Rediseñar StepSummary
  ├── 4.2 Score breakdown + radar
  ├── 4.3 PDF profesional
  ├── 4.4 Localización
  ├── 4.5 Compartir
  └── 4.6 Admin métricas
```
