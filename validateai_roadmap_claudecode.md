# ValidateAI — Instrucciones de implementación por fases

> Stack: React + TypeScript + Vite · Supabase · Anthropic API · jsPDF (lazy load)
> Entregar estas instrucciones a Claude Code fase por fase, no todas juntas.

---

## FASE 1 — Inmediato (esta semana)

### 1.1 Prompt caching

**Objetivo:** Reducir costo de tokens de input hasta 90% en el system prompt fijo.

**Contexto técnico:**
- La Anthropic API soporta `cache_control: { type: "ephemeral" }` en bloques del system prompt
- El caché dura 5 minutos y se renueva con cada uso
- Solo se cobra el 10% del precio normal en tokens cacheados
- Requiere usar el formato de `system` como array de bloques, no string plano

**Instrucciones:**

1. Localiza el archivo donde se construye la llamada a la API de Anthropic (probablemente un servicio o hook, ej: `src/services/anthropic.ts` o similar).

2. Identifica el system prompt. Sepáralo en dos partes:
   - **Parte estática** (instrucciones de análisis, metodología, contexto del ecosistema chileno, formato de respuesta) → esta parte se cachea
   - **Parte dinámica** (datos específicos del usuario, idea ingresada) → esta NO se cachea

3. Modifica la llamada para usar el formato de bloques:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4000,
  system: [
    {
      type: 'text',
      text: STATIC_SYSTEM_PROMPT, // instrucciones fijas largas
      cache_control: { type: 'ephemeral' }
    },
    {
      type: 'text',
      text: buildDynamicContext(userData) // datos del usuario, sin cachear
    }
  ],
  messages: [
    { role: 'user', content: userMessage }
  ]
})
```

4. Extrae `STATIC_SYSTEM_PROMPT` como constante en un archivo separado `src/prompts/systemPrompt.ts`. Debe tener mínimo 1024 tokens para que el caching sea efectivo (Anthropic no cachea bloques menores).

5. Agrega logs en desarrollo para verificar `usage.cache_read_input_tokens` y `usage.cache_creation_input_tokens` en la respuesta.

**Validación:** En la segunda llamada al API, `cache_read_input_tokens` debe ser > 0.

---

### 1.2 AbortController en streaming

**Objetivo:** Cancelar la generación si el usuario navega fuera o cancela manualmente, evitando pagar tokens no usados.

**Instrucciones:**

1. Localiza el hook o función que maneja la llamada al API con streaming (ej: `useValidation.ts` o similar).

2. Agrega un `AbortController` vinculado al ciclo de vida del componente:

```typescript
const abortControllerRef = useRef<AbortController | null>(null)

const startAnalysis = async () => {
  // Cancela cualquier análisis previo
  abortControllerRef.current?.abort()
  abortControllerRef.current = new AbortController()

  try {
    const stream = await anthropic.messages.stream(
      { /* params */ },
      { signal: abortControllerRef.current.signal }
    )
    // procesar stream...
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.log('Análisis cancelado por el usuario')
      return
    }
    throw err
  }
}

// Cleanup al desmontar el componente
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort()
  }
}, [])
```

3. Agrega un botón "Cancelar" visible mientras `isLoading === true` que llame a `abortControllerRef.current?.abort()`.

4. Al cancelar, limpia el estado parcial del análisis para no mostrar un reporte incompleto.

**Validación:** Iniciar un análisis, hacer clic en cancelar antes de que termine, verificar en los logs de red que la request se corta.

---

### 1.3 Análisis de riesgos — nueva sección

**Objetivo:** Agregar una sección de riesgos al reporte con score compuesto en 4 dimensiones.

**Instrucciones:**

**A. Actualizar el tipo `PDFData` / `ValidationDetail`**

Agrega la siguiente estructura al tipo de datos del reporte:

```typescript
interface RiskAnalysis {
  overallRiskScore: number // 0-100, donde 100 = máximo riesgo
  dimensions: {
    market: {
      score: number // 0-100
      label: string // ej: "Alto", "Medio", "Bajo"
      description: string
      keyFactors: string[]
    }
    technical: {
      score: number
      label: string
      description: string
      keyFactors: string[]
    }
    regulatory: {
      score: number
      label: string
      description: string
      keyFactors: string[]
    }
    timing: {
      score: number
      label: string
      description: string
      keyFactors: string[]
    }
  }
  mitigations: string[] // 3-5 acciones concretas para reducir riesgos
}
```

**B. Actualizar el prompt de análisis**

Agrega esta sección al system prompt estático:

```
## Sección: Análisis de Riesgos

Genera un análisis de riesgos estructurado con estas 4 dimensiones:

1. RIESGO DE MERCADO (0-100): ¿Existe demanda real comprobada o es un problema percibido?
   - Score alto (>70): problema no validado, mercado no probado, demanda incierta
   - Score medio (40-70): señales mixtas, mercado emergente
   - Score bajo (<40): problema validado, mercado probado con datos

2. RIESGO TÉCNICO (0-100): ¿Qué tan compleja es la implementación técnica?
   - Score alto: requiere tecnología no probada, equipo técnico no disponible, dependencias críticas
   - Score medio: complejidad manejable con recursos adecuados
   - Score bajo: tecnología estándar, solución bien entendida

3. RIESGO REGULATORIO (0-100): ¿Existen fricciones legales o regulatorias?
   - Score alto: fintech, salud, datos personales sensibles, mercados regulados
   - Score medio: regulación estándar, compliance manejable
   - Score bajo: industria sin regulación especial

4. RIESGO DE TIMING (0-100): ¿Es el momento correcto para este mercado?
   - Score alto: mercado demasiado temprano o ya saturado
   - Score medio: timing aceptable con ajustes
   - Score bajo: ventana de oportunidad clara ahora

Para cada dimensión incluye: score numérico, label (Alto/Medio/Bajo), descripción de 2-3 oraciones, y 2-3 factores clave.
Incluye también 3-5 mitigaciones concretas y accionables para los riesgos más críticos.
```

**C. Agregar la sección al PDF**

En `generateValidationPDF`, agrega una sección nueva entre FODA y Próximos Pasos:

- Header de sección con acento `#DC2626` (rojo)
- Score general de riesgo: círculo con número, coloreado según valor (verde <40, amarillo 40-70, rojo >70)
- 4 cards en grid 2×2, una por dimensión, cada una con:
  - Mini barra de riesgo (relleno de derecha a izquierda, color según score)
  - Nombre de dimensión + label
  - Descripción
  - Factores clave como bullets
- Bloque de mitigaciones al final con bullets numerados y acento verde

**Validación:** El reporte PDF generado debe incluir la nueva sección entre FODA y Próximos Pasos con datos reales del análisis.

---

## FASE 2 — Corto plazo (próximas 2 semanas)

### 2.1 Unit economics estimados

**Objetivo:** Agregar estimaciones de CAC, LTV, ratio LTV/CAC y break-even al reporte.

**Instrucciones:**

**A. Nuevo tipo de datos:**

```typescript
interface UnitEconomics {
  cac: { min: number; max: number; currency: 'CLP' | 'USD' }
  ltv: { min: number; max: number; currency: 'CLP' | 'USD' }
  ltvCacRatio: { value: number; assessment: 'viable' | 'warning' | 'critical' }
  paybackMonths: { min: number; max: number }
  breakEvenUsers: number
  monthlyChurnEstimate: number // porcentaje
  assumptions: string[] // supuestos clave de los cálculos
}
```

**B. Añadir al prompt:**

```
## Sección: Unit Economics

Estima los unit economics básicos para el modelo de negocio descrito.
Usa rangos (min-max) cuando la incertidumbre sea alta.
Basa los cálculos en el pricing indicado y el mercado objetivo.
Siempre en la moneda del mercado objetivo (CLP si es Chile).

- CAC (Costo de Adquisición de Cliente): costo estimado para conseguir 1 cliente de pago
- LTV (Lifetime Value): ingreso total esperado por cliente durante su vida útil
- Ratio LTV/CAC: debe ser >3x para ser viable, >5x es saludable
- Payback period: meses para recuperar el CAC
- Break-even: número de usuarios de pago necesarios para cubrir costos operativos mínimos
- Churn mensual estimado: porcentaje de usuarios que cancela cada mes (crítico para SaaS)

Incluye los supuestos clave que usaste para llegar a estos números.
```

**C. Sección en PDF:**

- Header con acento `#2563EB`
- 4 metric cards en fila: CAC, LTV, Ratio LTV/CAC, Break-even
  - Ratio LTV/CAC: coloreado según valor (verde >5x, amarillo 3-5x, rojo <3x)
- Churn mensual con indicador de riesgo
- Bloque de supuestos en texto secundario al final

---

### 2.2 Founder-market fit

**Objetivo:** Evaluar qué tan bien posicionado está el fundador para ejecutar esta idea específica.

**Instrucciones:**

**A. Nuevas preguntas en el formulario de input:**

Agrega estas preguntas opcionales al formulario (marcadas como "mejora tu análisis"):

```typescript
interface FounderContext {
  yearsInIndustry: number // años de experiencia en la industria del problema
  hasBuiltBefore: boolean // ¿ha lanzado un producto/negocio antes?
  hasTechnicalCofounder: boolean // ¿tiene co-fundador técnico?
  personallyFacedProblem: boolean // ¿ha vivido el problema que resuelve?
  networkInTargetMarket: 'none' | 'some' | 'strong' // red de contactos en el mercado objetivo
}
```

**B. Añadir al prompt:**

```
## Sección: Founder-Market Fit

Evalúa qué tan bien posicionado está el fundador para ejecutar esta idea específica.
Score de 0-100 donde 100 = fit perfecto.

Dimensiones a evaluar:
- Conocimiento del problema (¿lo ha vivido en carne propia?)
- Experiencia en la industria
- Capacidad técnica o acceso a ella (co-fundador técnico)
- Red de contactos en el mercado objetivo
- Track record emprendedor previo

Sé honesto. Un score bajo no mata la idea, pero sí señala riesgos de ejecución importantes.
Incluye recomendaciones específicas para cerrar los gaps del fundador.
```

**C. Sección en PDF:**

- Score circular como el score general pero con color propio
- Radar chart aproximado con las 5 dimensiones (puede ser barras horizontales en jsPDF)
- 2-3 recomendaciones concretas para cerrar gaps

---

### 2.3 Generación lazy por sección (tiers)

**Objetivo:** Generar solo las secciones del tier del usuario, reducir tokens y crear upsell natural.

**Instrucciones:**

**A. Definir tiers y secciones:**

```typescript
const TIER_SECTIONS = {
  free: ['score', 'breakdown', 'questions', 'nextSteps'],
  basic: ['score', 'breakdown', 'questions', 'client', 'valueProposition', 'nextSteps', 'risks'],
  pro: ['score', 'breakdown', 'questions', 'client', 'valueProposition', 'mvp', 'swot', 'nextSteps', 'risks', 'unitEconomics', 'founderFit'],
  premium: 'all' // todas las secciones incluyendo TAM/SAM/SOM y análisis competitivo
} as const
```

**B. Modificar el prompt para recibir secciones:**

El system prompt debe recibir como parámetro dinámico (parte no cacheada) qué secciones generar:

```typescript
const buildDynamicContext = (userData: UserData, sections: string[]) => `
Genera ÚNICAMENTE las siguientes secciones del reporte: ${sections.join(', ')}.
No incluyas ninguna otra sección aunque sea relevante.

Datos de la idea:
${JSON.stringify(userData)}
`
```

**C. UI de upsell:**

- En el reporte, las secciones bloqueadas se muestran como cards difuminadas con un botón "Desbloquear con plan Pro"
- Al hacer hover sobre una sección bloqueada, mostrar un tooltip con qué información contendría

**D. Lógica de llamada:**

```typescript
const getUserSections = (tier: string): string[] => {
  if (tier === 'premium') return ALL_SECTIONS
  return TIER_SECTIONS[tier as keyof typeof TIER_SECTIONS] as string[]
}

const sections = getUserSections(user.tier)
const analysis = await generateAnalysis(ideaData, sections)
```

---

### 2.4 Haiku como pre-pasada

**Objetivo:** Usar `claude-haiku-4-5-20251001` para estructurar y limpiar el input antes de mandarlo a Sonnet.

**Instrucciones:**

**A. Crear función de pre-procesamiento:**

```typescript
const preprocessIdea = async (rawInput: string): Promise<StructuredIdea> => {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: `Eres un extractor de datos. Tu única tarea es estructurar la idea de negocio en JSON.
Responde SOLO con JSON válido, sin texto adicional.`,
    messages: [{
      role: 'user',
      content: `Extrae y estructura esta idea de negocio:

${rawInput}

Responde en este formato JSON exacto:
{
  "problem": "problema que resuelve (1-2 oraciones)",
  "solution": "solución propuesta (1-2 oraciones)",
  "targetAudience": "público objetivo específico",
  "market": "mercado/industria",
  "revenueModel": "cómo genera dinero",
  "stage": "idea|validating|mvp|launched",
  "geography": "mercado geográfico"
}`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text) as StructuredIdea
}
```

**B. Integrar en el flujo principal:**

```typescript
const generateValidationReport = async (rawInput: string, userTier: string) => {
  // Pasada 1: Haiku estructura el input (barato)
  const structuredIdea = await preprocessIdea(rawInput)

  // Pasada 2: Sonnet analiza con input limpio y estructurado (calidad)
  const sections = getUserSections(userTier)
  const analysis = await generateAnalysis(structuredIdea, sections)

  return analysis
}
```

**Validación:** El costo total de ambas llamadas debe ser menor que la llamada única original a Sonnet con el texto raw.

---

## FASE 3 — Mediano plazo (1-2 meses)

### 3.1 RAG de competidores con pgvector

**Objetivo:** Base vectorial de competidores en Supabase para recuperar solo los relevantes según la idea analizada.

**Instrucciones:**

**A. Setup en Supabase:**

Ejecuta en el SQL Editor de Supabase:

```sql
-- Habilitar extensión
create extension if not exists vector;

-- Tabla de competidores
create table competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  description text,
  market text,
  pricing text,
  strengths text[],
  weaknesses text[],
  industries text[], -- ej: ['saas', 'validacion', 'emprendimiento']
  geography text[], -- ej: ['global', 'latam', 'chile']
  embedding vector(1536), -- dimensión para text-embedding-3-small de OpenAI
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índice para búsqueda vectorial
create index on competitors using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Función de búsqueda semántica
create or replace function search_competitors(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid, name text, url text, description text,
  market text, pricing text, strengths text[],
  weaknesses text[], similarity float
)
language sql stable
as $$
  select
    id, name, url, description, market, pricing,
    strengths, weaknesses,
    1 - (embedding <=> query_embedding) as similarity
  from competitors
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

**B. Script de seed de competidores conocidos:**

Crea `scripts/seedCompetitors.ts`. Ingesta los competidores del reporte actual (Preuve AI, DimeADozen, FounderPal, ValidatorAI, IdeaProof) más los que vayas descubriendo. Para cada uno, genera el embedding con la API de OpenAI o Anthropic y guárdalo.

**C. Servicio de recuperación en el cliente:**

```typescript
// src/services/competitorRetrieval.ts
export const retrieveRelevantCompetitors = async (idea: StructuredIdea) => {
  // 1. Generar embedding de la idea
  const queryText = `${idea.problem} ${idea.solution} ${idea.market} ${idea.targetAudience}`
  const embedding = await generateEmbedding(queryText)

  // 2. Buscar competidores similares en Supabase
  const { data: competitors } = await supabase.rpc('search_competitors', {
    query_embedding: embedding,
    match_threshold: 0.65,
    match_count: 6
  })

  return competitors
}
```

**D. Integrar en el flujo de análisis:**

En la pasada de Sonnet, inyectar los competidores recuperados como contexto dinámico (no cacheado) en vez de tener todos los competidores en el system prompt.

---

### 3.2 Señales de mercado externas

**Objetivo:** Enriquecer el análisis con datos externos de tendencias e inversión.

**Instrucciones:**

**A. Habilitar web search tool en la llamada:**

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4000,
  tools: [
    {
      type: 'web_search_20250305',
      name: 'web_search'
    }
  ],
  system: [...systemPromptBlocks],
  messages: [{
    role: 'user',
    content: `Analiza esta idea y busca señales de mercado actuales:
    - Tendencia de búsqueda del problema en los últimos 12 meses
    - Startups o rondas de inversión recientes en este espacio
    - Noticias relevantes que afecten el timing
    
    Idea: ${JSON.stringify(structuredIdea)}`
  }]
})
```

**B. Nuevo tipo de datos:**

```typescript
interface MarketSignals {
  trendDirection: 'growing' | 'stable' | 'declining'
  trendDescription: string
  recentFunding: { company: string; amount: string; date: string }[]
  timingAssessment: 'too_early' | 'optimal' | 'late' | 'uncertain'
  timingRationale: string
  relevantNews: { title: string; impact: 'positive' | 'negative' | 'neutral' }[]
}
```

**C. Nota de implementación:** Esta feature tiene costo adicional por búsqueda web. Considera limitarla al tier premium o a un número máximo de búsquedas por reporte.

---

### 3.3 Caché de reportes similares en Supabase

**Objetivo:** Reutilizar análisis de ideas similares para reducir llamadas al API.

**Instrucciones:**

**A. Tabla de reportes cacheados:**

```sql
create table cached_analyses (
  id uuid primary key default gen_random_uuid(),
  idea_embedding vector(1536),
  idea_hash text, -- hash del input normalizado
  industry text,
  geography text,
  analysis_data jsonb, -- el reporte completo
  usage_count int default 1,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days'
);

create index on cached_analyses using ivfflat (idea_embedding vector_cosine_ops)
  with (lists = 50);
```

**B. Lógica de caché:**

```typescript
const getCachedAnalysis = async (idea: StructuredIdea, threshold = 0.92) => {
  const embedding = await generateEmbedding(JSON.stringify(idea))

  const { data } = await supabase.rpc('search_cached_analyses', {
    query_embedding: embedding,
    match_threshold: threshold, // umbral alto: solo reutilizar si es muy similar
    match_count: 1
  })

  return data?.[0] ?? null
}

// En el flujo principal:
const cached = await getCachedAnalysis(structuredIdea)
if (cached && cached.similarity > 0.92) {
  // Reutilizar con nota de que es un análisis similar
  return { ...cached.analysis_data, fromCache: true, similarity: cached.similarity }
}

// Si no hay caché, generar y guardar
const analysis = await generateAnalysis(structuredIdea, sections)
await saveCachedAnalysis(structuredIdea, analysis)
return analysis
```

**C. Nota UX:** Cuando se sirve un análisis cacheado, mostrar un indicador sutil "Basado en análisis de ideas similares" para mantener transparencia con el usuario.

---

## FASE 4 — Largo plazo (3-6 meses)

### 4.1 Seguimiento post-validación

**Objetivo:** Conectar al emprendedor con mentores chilenos después del reporte, diferenciador clave frente a competidores.

**Instrucciones:**

**A. Tabla de mentores:**

```sql
create table mentors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bio text,
  expertise text[], -- industrias/áreas
  linkedin_url text,
  availability text, -- 'available' | 'waitlist' | 'unavailable'
  session_price_clp int,
  languages text[] default array['es'],
  embedding vector(1536) -- para matching semántico con ideas
);
```

**B. Matching mentor-idea:**

Después de generar el reporte, recomendar 2-3 mentores cuya expertise hace match con la industria y los gaps del fundador identificados en el Founder-Market Fit score.

**C. Integración con cal.com o similar:**

Cada mentor tiene un link de Calendly/Cal.com. El reporte incluye una sección final "Próximo paso recomendado" con los mentores sugeridos y botón directo a agendar.

---

### 4.2 Iteraciones de idea (historial de versiones)

**Objetivo:** Permitir al usuario pivotar su idea y comparar versiones del análisis, justificando suscripción mensual.

**Instrucciones:**

**A. Modelo de datos:**

```sql
-- Agregar a la tabla de validaciones existente
alter table validations add column parent_id uuid references validations(id);
alter table validations add column version int default 1;
alter table validations add column pivot_reason text;
```

**B. UI de comparación:**

- Vista "Historial" que muestra todas las versiones de una idea en timeline
- Comparación side-by-side de scores entre versiones
- Indicador de mejora/empeoramiento por dimensión entre la versión anterior y la actual

**C. Prompt para análisis de pivote:**

Cuando existe una versión anterior, incluir en el contexto:
```
Esta es la versión N de la idea. La versión anterior tenía estos scores: [scores].
El usuario pivotó porque: [pivot_reason].
Evalúa específicamente si el pivote mejora las dimensiones débiles anteriores.
```

---

### 4.3 Dataset propio de validaciones (moat a largo plazo)

**Objetivo:** Construir el corpus de datos más valioso — validaciones reales del ecosistema chileno.

**Instrucciones:**

**A. Política de datos (implementar desde el inicio):**

Al crear una cuenta, el usuario acepta (opcionalmente, con incentivo) que su análisis anonimizado contribuya al dataset de ValidateAI. Esto debe estar en los términos de servicio.

**B. Tabla de datos de entrenamiento:**

```sql
create table training_data (
  id uuid primary key default gen_random_uuid(),
  industry text,
  geography text,
  idea_summary text, -- anonimizado, sin datos personales
  scores jsonb, -- scores del análisis
  outcome text, -- 'launched' | 'pivoted' | 'abandoned' (seguimiento futuro)
  created_at timestamptz default now()
);
```

**C. Pipeline de anonimización:**

Antes de guardar, pasar por Haiku para eliminar información personal identificable (nombres, emails, URLs específicas, nombres de empresas) y quedarse solo con la estructura semántica de la idea.

**D. Uso futuro:**

Este dataset permite en 6-12 meses:
- Fine-tuning de un modelo especializado en validación para el ecosistema chileno
- RAG sobre ideas exitosas/fallidas reales como evidencia en los análisis
- Benchmarks por industria basados en datos propios ("las ideas de fintech en Chile tienen un churn promedio de X%")

---

## Notas generales para Claude Code

- **Nunca romper el flujo existente.** Cada feature se implementa de forma aditiva. Si algo falla, el sistema debe funcionar sin esa feature.
- **Variables de entorno:** Todas las keys nuevas van en `.env.local` y en el schema de validación de env vars si existe.
- **Tipos primero:** Definir los tipos TypeScript antes de implementar la lógica. Esto evita errores en cascada.
- **Una fase a la vez:** No implementar la Fase 2 antes de que la Fase 1 esté probada en producción.
- **Tests mínimos:** Cada feature nueva debe tener al menos un test de integración que verifique el happy path.
