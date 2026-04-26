# ValidateAI — Documento Maestro de Producto
> Stack: React + TypeScript + Vite · Supabase · Anthropic API · jsPDF (lazy load)
> Entregar a Claude Code fase por fase. No implementar fases en paralelo.
> Última actualización: 25 abril 2026

---

## Índice

1. [Visión del producto](#1-visión-del-producto)
2. [Estado actual](#2-estado-actual)
3. [Fase 0 — Fundamentos del MVP](#3-fase-0--fundamentos-del-mvp)
4. [Fase 1 — Análisis mejorado](#4-fase-1--análisis-mejorado)
5. [Fase 2 — Entregables post-validación](#5-fase-2--entregables-post-validación)
6. [Fase 3 — Diferenciación local](#6-fase-3--diferenciación-local)
7. [Fase 4 — Optimización técnica](#7-fase-4--optimización-técnica)
8. [Fase 5 — Infraestructura e inteligencia](#8-fase-5--infraestructura-e-inteligencia)
9. [Fase 6 — Moat y retención](#9-fase-6--moat-y-retención)
10. [Sistema de diseño PDF](#10-sistema-de-diseño-pdf)
11. [Notas generales para Claude Code](#11-notas-generales-para-claude-code)

---

## 1. Visión del producto

**ValidateAI** es la única plataforma de validación de ideas de negocio diseñada específicamente para el ecosistema emprendedor chileno. Combina IA especializada con datos locales reales (CORFO, INE, Banco Central, SII) para entregar en minutos lo que un consultor cobraría $500.000 CLP.

**Propuesta de valor central:**
> Por menos de $30.000 CLP, el emprendedor chileno obtiene un análisis completo de su idea con contexto regional real, hoja de ruta regulatoria actualizada, fondos aplicables ahora y un plan de validación concreto para las próximas 48 horas.

**Diferenciadores clave frente a competidores globales (Preuve, DimeADozen, FounderPal):**
- Análisis en español con datos del ecosistema chileno
- Precios en CLP accesibles para etapa temprana
- Contexto regional por las 16 regiones de Chile
- Regulación SII 2026 integrada
- Fondos CORFO/Start-Up Chile aplicables automáticamente
- Entregables accionables post-análisis (no solo un reporte)

**Segmento objetivo:**
Emprendedores de 22–35 años en Chile, etapa temprana, presupuesto limitado ($10K–30K CLP), alta exposición a contenido digital. Estudiantes universitarios, profesionales con proyectos paralelos y freelancers que buscan escalar.

**Modelo de negocio:**
- Free: Score + Breakdown + 2 preguntas (lead magnet)
- Básico ($9.990 CLP/reporte): Análisis completo sin competencia ni TAM
- Pro ($14.990 CLP/mes): Todo + análisis competitivo + entregables post-validación
- Premium ($29.990 CLP/mes): Todo + contexto regional + señales en tiempo real + fondos

---

## 2. Estado actual

### Lo que existe hoy

```
ValidateAI (estado actual)
├── Formulario de ingreso de idea (problema, solución, público objetivo)
├── Generación de análisis via Anthropic API (claude-sonnet-4-20250514)
├── 11 secciones de reporte:
│   ├── Portada
│   ├── Score general (0–100)
│   ├── Breakdown por dimensión (5 categorías)
│   ├── Preguntas de validación (Q&A)
│   ├── Cliente objetivo
│   ├── Propuesta de valor
│   ├── Plan de MVP sugerido
│   ├── Análisis FODA
│   ├── Próximos pasos
│   ├── TAM / SAM / SOM estimado
│   └── Análisis competitivo
├── Exportación PDF via jsPDF (lazy load, dibujo programático)
├── Supabase para datos de usuario
└── Autenticación básica
```

### Gaps críticos identificados

| Dimensión | Estado | Gap |
|---|---|---|
| Problema | ✅ Sólido (85/100) | Ampliar fuera de Santiago |
| Mercado | ✅ Definido (75/100) | Validar con datos INE regionales |
| Competencia | ✅ Mapeada (80/100) | Precios en vivo faltan |
| Solución | ⚠️ Parcial (70/100) | Diferenciación vs ChatGPT |
| Ejecución | ⚠️ En progreso (55/100) | Primeros 20–30 usuarios reales |
| Pricing | ✅ Validado (72/100) | Tier freemium necesario |
| Distribución | ⚠️ Planificada (65/100) | Ningún canal activo aún |
| Riesgos | ❌ No incluido | Agregar en Fase 1 |
| Unit Economics | ❌ No incluido | Agregar en Fase 1 |
| Contexto regional | ❌ Ausente | Mayor diferenciador posible |
| Regulatorio | ❌ Ausente | ROI #1 de la lista |
| Fondos CORFO | ❌ Ausente | Próximos pasos accionables |
| PDF / Diseño | ❌ Poco profesional | Percepción de valor baja |
| Tokens / Costo | ❌ Sin optimizar | Fase 4 del roadmap |
| Founder-market fit | 🔵 Planificado | Agregar en Fase 2 |

**Score actual del proyecto: 7.4/10**
**Potencial con gaps cerrados: 9.2/10**

---

## 3. Fase 0 — Fundamentos del MVP

> **Objetivo:** Antes de agregar features, asegurar que la experiencia base convierte y retiene.
> **Tiempo estimado:** 1 semana
> **Prioridad:** BLOQUEANTE — no avanzar a Fase 1 sin completar esto.

---

### 0.1 Onboarding con reporte de ejemplo

**Qué hacer:**
El primer contacto del usuario con ValidateAI debe mostrar un reporte de ejemplo pre-generado (idea ficticia pero convincente, ej: "App de delivery de remedios en Santiago") antes de pedirle que ingrese la suya. El usuario ve exactamente qué recibirá antes de comprometerse.

**Implementación:**
- Crear un objeto `EXAMPLE_REPORT` hardcodeado con datos realistas en `src/data/exampleReport.ts`
- Mostrar este reporte en la landing con un banner "Ejemplo de análisis real"
- Botón CTA: "Analiza tu idea ahora" que lleva al formulario
- El reporte de ejemplo debe tener todos los campos del reporte real, incluyendo score, breakdown, FODA y próximos pasos

**Validación:** Usuario que llega frío a la landing puede ver el valor del producto sin registrarse.

---

### 0.2 Formulario de 3 pasos con progreso

**Qué hacer:**
Rediseñar el formulario de ingreso de idea en 3 pasos con barra de progreso visible. Máximo 3 campos por paso.

```
Paso 1: La idea
  - ¿Qué problema resuelves? (textarea, max 300 chars)
  - ¿Cuál es tu solución? (textarea, max 300 chars)

Paso 2: El mercado
  - ¿A quién le vendes? (texto libre)
  - ¿En qué región o ciudad? (select con las 16 regiones de Chile)
  - ¿Cuánto cobrarías? (input con opciones: gratis, <$10K CLP, $10K–50K, $50K–200K, >$200K)

Paso 3: El fundador (opcional, mejora el análisis)
  - ¿Años de experiencia en esta industria? (0 / 1–3 / 3–5 / 5+)
  - ¿Tienes co-fundador técnico? (sí / no / buscando)
  - ¿Has vivido este problema personalmente? (sí / no)
```

**Tipo de datos a actualizar:**
```typescript
interface IdeaInput {
  problem: string
  solution: string
  targetAudience: string
  region: ChileanRegion // enum de 16 regiones
  priceRange: PriceRange
  founderContext?: {
    yearsInIndustry: '0' | '1-3' | '3-5' | '5+'
    hasTechnicalCofounder: boolean | null
    livedTheProblem: boolean
  }
}
```

**Validación:** El formulario debe completarse en menos de 3 minutos. Medir tasa de completación.

---

### 0.3 Generación con streaming visible por secciones

**Qué hacer:**
Mientras la IA analiza, mostrar cada sección aparecer en tiempo real en lugar de un spinner de carga. El usuario ve el análisis construirse sección por sección.

**Implementación:**
```typescript
// El prompt debe instruir al modelo a usar delimitadores de sección
// Parsear el stream y mostrar cada sección al ir llegando

const SECTION_DELIMITERS = {
  score: '##SCORE##',
  breakdown: '##BREAKDOWN##',
  questions: '##QUESTIONS##',
  // ... etc
}

// Componente de progreso
const sections = [
  { id: 'score', label: 'Calculando score...', icon: '📊' },
  { id: 'market', label: 'Analizando mercado...', icon: '🎯' },
  { id: 'competition', label: 'Mapeando competencia...', icon: '⚔️' },
  { id: 'risks', label: 'Evaluando riesgos...', icon: '⚠️' },
  { id: 'roadmap', label: 'Generando plan...', icon: '🗺️' },
]
```

**Validación:** La espera de 30–45 segundos debe sentirse como valor entregándose, no como carga.

---

### 0.4 Tier freemium con límite claro

**Qué hacer:**
Implementar lógica de tiers desde el inicio. El tier gratuito debe entregar valor real pero dejar claro qué hay detrás del paywall.

```typescript
const TIER_SECTIONS = {
  free: ['score', 'breakdown', 'questions_2'], // solo 2 preguntas
  basic: ['score', 'breakdown', 'questions', 'client', 'value_prop', 'next_steps', 'risks'],
  pro: ['score', 'breakdown', 'questions', 'client', 'value_prop', 'mvp', 'swot',
        'next_steps', 'risks', 'unit_economics', 'founder_fit', 'regulatory'],
  premium: 'all' // todas + contexto regional + señales tiempo real + fondos CORFO
}
```

**UI del paywall:**
- Secciones bloqueadas se muestran como cards con blur suave y candado
- Al hacer hover: tooltip con "Incluido en plan Pro — Ver precios"
- No ocultar las secciones, solo difuminarlas para mostrar qué existe

**Validación:** El tier free debe generar al menos 1 upgrade por cada 10 análisis gratuitos.

---

### 0.5 Dashboard de ideas del usuario

**Qué hacer:**
Historial de todas las ideas validadas con su score, fecha y estado. Convierte una herramienta de uso único en una plataforma de trabajo continuo.

**Schema en Supabase:**
```sql
alter table validations add column status text default 'active'
  check (status in ('active', 'pivoted', 'launched', 'discarded'));
alter table validations add column pivot_reason text;
alter table validations add column parent_id uuid references validations(id);
alter table validations add column version int default 1;
```

**UI mínimo:**
- Lista de ideas con: nombre, score (número + color), fecha, status chip
- Botón "Pivotar" que abre un modal para ingresar la razón y crear nueva versión
- Botón "Marcar como lanzada" / "Descartar"
- Click en una idea abre el reporte completo

**Validación:** Un usuario con 2+ ideas en el dashboard es un usuario retenido.

---

### 0.6 Compartir reporte como link público

**Qué hacer:**
Generar una URL pública del reporte que el emprendedor puede compartir. Cada link compartido es distribución orgánica gratuita.

**Implementación:**
```sql
alter table validations add column is_public boolean default false;
alter table validations add column public_slug text unique;
-- Generar slug: nanoid(10)
```

```typescript
// Ruta pública: /report/:slug
// Mostrar reporte completo del tier del usuario, sin opciones de edición
// Footer: "Generado con ValidateAI · valida tu idea en validateai.cl"
// CTA: "Analiza tu idea gratis"
```

**Validación:** Medir cuántos nuevos registros vienen de links compartidos.

---

## 4. Fase 1 — Análisis mejorado

> **Objetivo:** Agregar las secciones de análisis que más impactan la decisión del emprendedor.
> **Tiempo estimado:** 2 semanas
> **Prerequisito:** Fase 0 completa y con al menos 20 usuarios reales.

---

### 1.1 Análisis de riesgos — nueva sección

**Qué hacer:**
Agregar una sección de riesgos con score compuesto en 4 dimensiones. Es la métrica que más cambia decisiones y la más solicitada.

**Tipo de datos:**
```typescript
interface RiskAnalysis {
  overallScore: number // 0–100, donde 100 = máximo riesgo
  dimensions: {
    market: RiskDimension    // ¿existe demanda real o percibida?
    technical: RiskDimension // ¿qué tan difícil es construir esto?
    regulatory: RiskDimension // ¿hay fricciones legales?
    timing: RiskDimension    // ¿es el momento correcto?
  }
  mitigations: string[] // 3–5 acciones concretas para reducir riesgos
}

interface RiskDimension {
  score: number
  label: 'Alto' | 'Medio' | 'Bajo'
  description: string
  keyFactors: string[]
}
```

**Instrucciones para el prompt:**
```
## Análisis de Riesgos

Evalúa 4 dimensiones de riesgo (0–100, donde 100 = máximo riesgo):

RIESGO DE MERCADO: ¿La demanda es real o percibida?
- Alto (>70): problema no validado, mercado no probado
- Medio (40–70): señales mixtas, mercado emergente
- Bajo (<40): problema validado con datos reales

RIESGO TÉCNICO: ¿Qué tan compleja es la implementación?
- Alto: tecnología no probada, sin equipo técnico, dependencias críticas
- Medio: complejidad manejable con recursos adecuados
- Bajo: tecnología estándar, solución bien entendida

RIESGO REGULATORIO: ¿Hay fricciones legales en Chile?
- Alto: fintech (CMF), salud (ISP/Minsal), datos personales (Ley 21.719), alimentos (Seremi)
- Medio: regulación estándar manejable
- Bajo: industria sin regulación especial

RIESGO DE TIMING: ¿Es el momento correcto?
- Alto: mercado demasiado temprano o ya saturado
- Medio: timing aceptable con ajustes
- Bajo: ventana de oportunidad clara ahora

Para cada dimensión: score numérico, label, descripción 2–3 oraciones, 2–3 factores clave.
Incluye 3–5 mitigaciones concretas y accionables.
```

**En el PDF:** Sección entre FODA y Próximos Pasos. Header rojo (#DC2626). 4 cards en grid 2×2 con mini-barras de riesgo. Score general como círculo coloreado (verde <40, amarillo 40–70, rojo >70).

---

### 1.2 Unit economics estimados — nueva sección

**Tipo de datos:**
```typescript
interface UnitEconomics {
  cac: { min: number; max: number }           // Costo adquisición cliente
  ltv: { min: number; max: number }           // Lifetime value
  ltvCacRatio: { value: number; assessment: 'viable' | 'warning' | 'critical' }
  paybackMonths: { min: number; max: number } // Meses para recuperar CAC
  breakEvenUsers: number                      // Usuarios para cubrir costos mínimos
  monthlyChurnEstimate: number                // % churn mensual estimado
  currency: 'CLP'
  assumptions: string[]
}
```

**Reglas del prompt:**
- LTV/CAC >5x = viable (verde), 3–5x = warning (amarillo), <3x = crítico (rojo)
- Usar siempre CLP para ideas con mercado chileno
- Incluir supuestos explícitos
- Si no hay suficiente información, indicar rangos amplios con nota de incertidumbre

**En el PDF:** Sección nueva después de Análisis de Riesgos. Header azul (#2563EB). 4 metric cards en fila: CAC, LTV, Ratio LTV/CAC (coloreado), Break-even. Bloque de supuestos en texto secundario.

---

### 1.3 Founder-market fit — nueva sección

**Qué hacer:**
Evaluar qué tan bien posicionado está el fundador para ejecutar esta idea. Diferenciador clave que ningún competidor tiene.

**Datos del formulario (paso 3, ya capturados en 0.2):**
```typescript
interface FounderFitScore {
  overall: number // 0–100
  dimensions: {
    problemKnowledge: number  // ¿vivió el problema?
    industryExperience: number // años en la industria
    technicalAccess: number   // co-fundador técnico o habilidades propias
    networkInMarket: number   // red de contactos en el mercado objetivo
    trackRecord: number       // experiencia emprendedora previa
  }
  gaps: string[]              // qué le falta al fundador
  recommendations: string[]   // cómo cerrar los gaps
}
```

**En el PDF:** Score circular propio. Barras horizontales por dimensión. 2–3 recomendaciones concretas para cerrar gaps.

---

### 1.4 Score de momento óptimo para lanzar

**Qué hacer:**
Indicador de timing con 4 estados posibles como cierre del reporte.

```typescript
type TimingStatus = 
  | 'launch_now'        // lanza esta semana
  | 'validate_first'    // valida estos 2 supuestos antes
  | 'wait_3_6_months'   // espera por esta razón específica
  | 'wrong_timing'      // el mercado no está listo, considera en 12–18 meses

interface TimingScore {
  status: TimingStatus
  rationale: string    // justificación basada en los datos del análisis
  conditions: string[] // qué debe pasar para que el timing mejore
}
```

**En el PDF:** Bloque final destacado antes del footer. Color dinámico según estado: verde (launch_now), azul (validate_first), amarillo (wait), rojo (wrong_timing).

---

## 5. Fase 2 — Entregables post-validación

> **Objetivo:** Después de generar el reporte, entregar herramientas concretas de acción inmediata.
> **Tiempo estimado:** 2 semanas
> **Prerequisito:** Fase 1 completa. Estos entregables son el mayor diferenciador del producto.

Cada entregable es un segundo llamado al API usando los datos del análisis ya generado. Costo marginal bajo, valor percibido muy alto.

---

### 2.1 Kit de validación en 48 horas

**Qué es:**
Plan de acción inmediato con 3 experimentos concretos para validar la hipótesis principal sin construir nada. Acciones manuales: a quién hablar, qué preguntar, cómo medir.

**Prompt adicional:**
```
Usando el análisis generado, crea un plan de validación de 48 horas con:
- El supuesto más riesgoso que hay que validar primero
- 3 experimentos concretos (mínimo viable cada uno)
- Para cada experimento: qué hacer exactamente, dónde hacerlo, qué métrica mide el éxito
- Criterio de éxito/fracaso claro para cada experimento
- Si el supuesto principal resulta falso, qué hacer después

Ejemplos de experimentos según el tipo de idea:
- B2C digital: publicar descripción en grupo de Facebook/Reddit y medir comentarios en 24h
- B2B: enviar 20 mensajes de LinkedIn a potenciales clientes y medir respuestas
- Marketplace: hacer el proceso manualmente para 3 usuarios reales antes de construir
- Hardware/físico: mostrar un mockup/foto a 10 personas del segmento objetivo y pedir pre-orden
```

**UI:** Tab "Plan 48h" en la vista del reporte. Se genera bajo demanda, no automáticamente.

---

### 2.2 Generador de landing page

**Qué es:**
Copy completo de una landing page de validación lista para copiar a Carrd, Notion o Webflow.

**Estructura generada:**
```typescript
interface LandingPageCopy {
  headline: string          // propuesta de valor en <10 palabras
  subheadline: string       // expansión en 1–2 oraciones
  benefits: string[]        // 3 bullets de beneficio (no características)
  socialProof: string       // texto de prueba social sugerido (ej: "para X personas como tú")
  cta: string               // texto del botón principal
  faq: { question: string; answer: string }[] // 3 preguntas frecuentes
  seoTitle: string          // título para SEO
  seoDescription: string    // meta description
}
```

**UI:** Tab "Landing Page" en la vista del reporte. Botón "Copiar todo" para cada sección. Nota: "Pega esto en Carrd.co o Notion para tener tu página lista en 30 minutos."

**Solo disponible si score > 60** para evitar que el usuario construya sobre una idea claramente inviable.

---

### 2.3 Script de entrevista de usuario

**Qué es:**
8 preguntas abiertas para entrevistar a clientes potenciales, adaptadas al segmento identificado en el análisis.

**Estructura generada:**
```typescript
interface UserInterviewScript {
  context: string           // cómo presentarse al inicio
  warmupQuestions: string[] // 2 preguntas de calentamiento
  coreQuestions: string[]   // 5 preguntas sobre el dolor real
  closingQuestion: string   // 1 pregunta sobre disposición a pagar
  howToFindInterviewees: string[] // 3 formas de conseguir las primeras 5 entrevistas
  thingsToAvoid: string[]   // 3 errores comunes al entrevistar
  successMetric: string     // cómo saber si la entrevista fue exitosa
}
```

**UI:** Tab "Entrevistas" en la vista del reporte. Formato imprimible / copiable.

---

### 2.4 Análisis de viabilidad técnica del MVP

**Qué es:**
Clasificar la idea en 3 niveles de complejidad técnica con recomendaciones específicas de herramientas.

```typescript
type TechLevel = 'no_code' | 'low_code' | 'full_dev'

interface TechViabilityAnalysis {
  level: TechLevel
  rationale: string
  recommendedTools: {
    name: string
    url: string
    cost: string
    timeToMVP: string
    useFor: string
  }[]
  estimatedCostCLP: { min: number; max: number }
  estimatedTimeWeeks: { min: number; max: number }
  minimumFeatures: string[] // qué es ABSOLUTAMENTE necesario para validar
  whatToSkip: string[]      // qué NO construir aún
}
```

**Niveles:**
- `no_code`: Typeform + Notion + WhatsApp pueden validar esto
- `low_code`: Bubble, Glide, Webflow o Softr son suficientes
- `full_dev`: Requiere backend propio, APIs o lógica compleja

**UI:** Tab "Plan técnico" en la vista del reporte.

---

### 2.5 Mapa de primeros 100 clientes

**Qué es:**
Estrategia concreta de dónde están los primeros 100 clientes y cómo llegarles sin presupuesto.

```typescript
interface FirstCustomersMap {
  channels: {
    channel: string         // ej: "Grupo de Facebook: Emprendedores Chile"
    url?: string
    estimatedReach: number
    approach: string        // cómo presentarse
    messageTemplate: string // template de mensaje/post
  }[]
  b2bApproach?: {           // solo si es B2B
    linkedinFilters: string
    associations: string[]  // gremios o asociaciones relevantes
    events: string[]        // ferias o eventos del sector
  }
  regionalNote?: string     // si hay comunidades específicas en la región del usuario
  weeklyGoal: string        // meta concreta para los primeros 7 días
}
```

---

### 2.6 Comparador de modelos de revenue

**Qué es:**
3–4 modelos de monetización posibles para la misma idea evaluados contra el mercado chileno.

```typescript
interface RevenueModelComparison {
  models: {
    name: string            // suscripción, pago por uso, freemium, marketplace, B2B SaaS
    suitability: number     // 0–100, qué tan bien aplica a esta idea
    timeToFirstRevenue: string
    cacImpact: 'low' | 'medium' | 'high'
    churnRisk: 'low' | 'medium' | 'high'
    scaleability: 'low' | 'medium' | 'high'
    pros: string[]
    cons: string[]
    chileanExamples: string[] // startups chilenas con este modelo
  }[]
  recommendation: string    // cuál y por qué para esta idea específica
}
```

---

### 2.7 Checklist de riesgos antes de invertir

**Qué es:**
Los 5 supuestos más riesgosos en orden de criticidad, con experimento barato para validar cada uno.

```typescript
interface RiskChecklist {
  items: {
    rank: number
    assumption: string      // el supuesto en cuestión
    riskIfFalse: string     // qué pasa si este supuesto es falso
    experiment: string      // cómo validarlo en <1 semana
    cost: string            // costo estimado del experimento
    successCriteria: string // qué resultado confirma el supuesto
  }[]
  criticalPath: string      // si el supuesto #1 es falso, los otros no importan
}
```

---

### 2.8 Carta de presentación para mentores e incubadoras

**Qué es:**
Texto listo para postular a Start-Up Chile, acercarse a incubadoras o pedir reunión con mentores.

```typescript
interface PresentationLetter {
  emailSubject: string
  body: string              // 2 párrafos: problema+solución y estado actual+ask
  linkedinMessage: string   // versión corta para LinkedIn (300 chars)
  elevatorPitch: string     // versión oral de 30 segundos
  startupChilePitch: string // versión adaptada al formulario de Start-Up Chile Build
}
```

---

## 6. Fase 3 — Diferenciación local

> **Objetivo:** Agregar los datos que ningún competidor global puede tener.
> **Tiempo estimado:** 3 semanas
> **Prerequisito:** Fase 2 funcionando y al menos 50 usuarios activos.

---

### 3.1 Hoja de ruta regulatoria automática

**Contexto:** Desde el 2 de enero de 2026, nueva normativa SII obliga a inicio de actividades para operar en marketplaces, usar medios de pago electrónicos o postular a créditos. 200.000 emprendedores afectados.

**Qué hacer:**
Generar un checklist regulatorio específico según industria y región.

```typescript
interface RegulatoryRoadmap {
  businessStructure: {
    recommended: 'SpA' | 'EIRL' | 'SRL' | 'SA'
    rationale: string
    estimatedCostCLP: number
    timelineDays: number
    link: string // tuempresaenundia.cl
  }
  siiRequirements: {
    needsInicioActividades: boolean
    activityCodes: string[]     // códigos de actividad económica SII relevantes
    taxRegime: string           // régimen tributario recomendado
    vatObligated: boolean
  }
  municipalPermits: {
    needed: boolean
    type: string                // patente comercial, patente profesional, etc.
    estimatedCostCLP: number
  }
  sectorSpecificPermits: {
    needed: boolean
    permits: {
      name: string
      issuedBy: string          // CMF, ISP, Seremi de Salud, etc.
      timeline: string
      complexity: 'low' | 'medium' | 'high'
    }[]
  }
  dataProtection: {
    applies: boolean            // si maneja datos personales
    lawReference: string        // Ley 21.719
    actions: string[]
  }
  steps: {
    order: number
    action: string
    where: string
    estimatedDays: number
    cost: string
    link?: string
  }[]
}
```

**Industrias con riesgo regulatorio alto (detectar automáticamente):**
- Fintech → CMF, Ley de Bancos
- Salud → ISP, Minsal, FONASA
- Alimentos → Seremi de Salud, SAG
- Educación → Mineduc, SENCE
- Transporte → MTT
- Datos personales → Ley 21.719 (cualquier app que almacene datos de usuarios)

---

### 3.2 Contexto regional con datos reales

**Fuentes a integrar:**
- Banco Central: PIB regional por sector (trimestral)
- INE: número de empresas y empleo por región e industria
- CORFO: focos de inversión por macrozona

**Estructura de datos en Supabase:**
```sql
create table regional_data (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  industry text not null,
  gdp_contribution_percentage numeric,
  number_of_companies int,
  employment_thousands numeric,
  is_anchor_industry boolean default false,
  b2b_opportunity text,
  data_source text,
  updated_at timestamptz default now()
);
```

**Industrias ancla por macrozona (seed inicial):**

| Región | Industrias ancla | Oportunidad B2B |
|---|---|---|
| Antofagasta | Minería cobre/litio | Logística, agua, seguridad industrial |
| Coquimbo | Minería, vitivinícola | Agritech, exportación |
| Valparaíso | Puerto, logística, servicios | Trazabilidad, comercio exterior |
| RM | Todo | Fintech, SaaS, salud digital |
| Maule | Vitivinícola, forestal | Agritech, exportación agrícola |
| Biobío | Forestal, pesca, industria | Manufactura, trazabilidad |
| Araucanía | Forestal, agro, turismo | Agritech, sustentabilidad, e-commerce rural |
| Los Lagos | Acuicultura, turismo | Trazabilidad alimentaria, gestión |
| Aysén | Pesca, turismo | Logística remota, turismo digital |
| Magallanes | Petróleo, turismo | Energía, ecoturismo |

**Análisis de fit idea-región:**
Cuando la idea no hace match con las industrias ancla de la región ingresada, generar una alerta con sugerencia de mercado alternativo.

---

### 3.3 Sección de fondos CORFO aplicables

**Qué hacer:**
Al final del reporte, mostrar automáticamente los instrumentos de financiamiento aplicables según etapa y región.

**Base de datos estática (actualizar trimestralmente):**
```typescript
const CORFO_INSTRUMENTS = [
  {
    name: 'Start-Up Chile · Build',
    stage: ['idea', 'validating'],
    amountCLP: 15_000_000,
    durationMonths: 4,
    equityFree: true,
    url: 'https://startupchile.org',
    requirements: ['proyecto tecnológico', 'equipo con al menos 1 persona'],
    nextCallEstimate: 'segundo semestre 2026'
  },
  {
    name: 'Start-Up Chile · Ignite',
    stage: ['mvp', 'traction'],
    amountCLP: 30_000_000,
    durationMonths: 6,
    equityFree: true,
    url: 'https://startupchile.org',
    requirements: ['MVP funcional', 'primeros usuarios o ventas']
  },
  {
    name: 'Start-Up Chile · Growth',
    stage: ['scaling'],
    amountCLP: 75_000_000,
    durationMonths: 8,
    equityFree: true,
    url: 'https://startupchile.org',
    requirements: ['empresa constituida', 'revenue recurrente']
  },
  {
    name: 'CORFO · Programa Inicia',
    stage: ['idea', 'validating'],
    amountCLP: 5_000_000,
    durationMonths: 3,
    equityFree: true,
    url: 'https://corfo.cl',
    requirements: ['emprendedor natural o jurídico', 'primera empresa'],
    windowType: 'ventanilla abierta'
  }
]
```

**Lógica de matching:**
```typescript
const getApplicableFunds = (stage: IdeaStage, region: string) => {
  return CORFO_INSTRUMENTS
    .filter(f => f.stage.includes(stage))
    .slice(0, 3) // máximo 3 resultados
}
```

---

### 3.4 Detector de señales de mercado en tiempo real

**Qué hacer:**
Usar la web search tool de Anthropic para buscar 3 cosas justo después de generar el análisis principal.

```typescript
// Ejecutar en paralelo al análisis principal usando Promise.allSettled

const searchSignals = async (idea: StructuredIdea) => {
  const searches = [
    `competidores "${idea.market}" Chile lanzamiento 2025 2026`,
    `noticias "${idea.problem}" Chile emprendimiento startup`,
    `fondos convocatoria "${idea.industry}" CORFO Chile 2026`
  ]
  // Usar web_search_20250305 tool
}

interface MarketSignals {
  newCompetitors: { name: string; description: string; launchedAt: string }[]
  relevantNews: { title: string; impact: 'positive' | 'negative' | 'neutral'; summary: string }[]
  openFunds: { name: string; deadline: string; amount: string }[]
  hasSignals: boolean // si no hay nada relevante, no mostrar la sección
}
```

**Solo disponible en tier Premium** por costo adicional de web search.

---

## 7. Fase 4 — Optimización técnica

> **Objetivo:** Reducir costo de tokens y mejorar performance sin cambiar UX.
> **Tiempo estimado:** 1 semana
> **Prerequisito:** Puede hacerse en paralelo con Fase 1, pero no antes de Fase 0.

---

### 4.1 Prompt caching

```typescript
// Separar system prompt en parte estática (cacheable) y dinámica (no cacheable)

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4000,
  system: [
    {
      type: 'text',
      text: STATIC_SYSTEM_PROMPT, // > 1024 tokens para que el cache sea efectivo
      cache_control: { type: 'ephemeral' }
    },
    {
      type: 'text',
      text: buildDynamicContext(ideaData, sections, regionalData)
    }
  ],
  messages: [{ role: 'user', content: userMessage }]
})

// Verificar en desarrollo: usage.cache_read_input_tokens > 0 en segunda llamada
```

**Ahorro esperado:** 60–80% en tokens de input. El system prompt se cobra al 10% del precio normal.

---

### 4.2 Haiku como pre-pasada

```typescript
const preprocessIdea = async (rawInput: string): Promise<StructuredIdea> => {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: `Eres un extractor de datos JSON. Responde SOLO con JSON válido, sin texto adicional.`,
    messages: [{
      role: 'user',
      content: `Estructura esta idea de negocio en JSON:
${rawInput}

Formato exacto:
{
  "problem": "string",
  "solution": "string", 
  "targetAudience": "string",
  "market": "string",
  "industry": "string",
  "revenueModel": "string",
  "stage": "idea|validating|mvp|launched",
  "geography": "string",
  "isRegulated": boolean,
  "regulatedSectors": ["fintech"|"health"|"food"|"education"|"transport"|"data"]
}`
    }]
  })
  return JSON.parse(response.content[0].text)
}
```

---

### 4.3 AbortController en streaming

```typescript
const abortControllerRef = useRef<AbortController | null>(null)

const startAnalysis = async () => {
  abortControllerRef.current?.abort()
  abortControllerRef.current = new AbortController()

  try {
    const stream = await anthropic.messages.stream(params, {
      signal: abortControllerRef.current.signal
    })
    for await (const chunk of stream) { /* procesar */ }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    throw err
  }
}

useEffect(() => () => abortControllerRef.current?.abort(), [])
```

---

### 4.4 Generación lazy por secciones y tier

```typescript
// Solo generar las secciones del tier del usuario
const sections = getUserSections(user.tier)
const dynamicContext = buildDynamicContext(ideaData, sections)

// El prompt instruye al modelo a generar ÚNICAMENTE las secciones listadas
// Ahorro: tier free genera ~40% menos tokens que tier premium
```

---

## 8. Fase 5 — Infraestructura e inteligencia

> **Objetivo:** Construir la infraestructura de datos que crea el moat.
> **Tiempo estimado:** 3–4 semanas
> **Prerequisito:** 100+ usuarios activos y revenue constante.

---

### 5.1 RAG de competidores con pgvector

```sql
create extension if not exists vector;

create table competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  description text,
  market text,
  pricing text,
  strengths text[],
  weaknesses text[],
  industries text[],
  geography text[],
  embedding vector(1536),
  updated_at timestamptz default now()
);

create index on competitors using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function search_competitors(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (id uuid, name text, similarity float)
language sql stable as $$
  select id, name, 1 - (embedding <=> query_embedding) as similarity
  from competitors
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

**Seed inicial:** Los 6 competidores ya identificados (Preuve, DimeADozen, FounderPal, ValidatorAI, IdeaProof, Start-Up Chile) + los que se vayan descubriendo.

---

### 5.2 Caché de análisis similares

```sql
create table cached_analyses (
  id uuid primary key default gen_random_uuid(),
  idea_embedding vector(1536),
  industry text,
  geography text,
  analysis_data jsonb,
  usage_count int default 1,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days'
);
```

**Lógica:** Si una idea nueva tiene similitud > 0.92 con un análisis existente, reutilizar con nota "Basado en análisis de ideas similares". Umbral alto para garantizar calidad.

---

### 5.3 Email de seguimiento a los 7 días

```typescript
// Trigger: 7 días después de created_at en validations
// Herramienta: Resend o similar integrado con Supabase Edge Functions

const followUpEmail = {
  subject: '¿Cómo va tu idea de [nombre]?',
  body: `
    Hace 7 días validaste tu idea en ValidateAI.
    ¿Qué pasó después?
    
    [Seguí adelante] [Pivotamos] [La descartamos]
    
    Tu respuesta nos ayuda a mejorar el análisis para ti y otros emprendedores.
  `
}
// Los datos de respuesta alimentan el dataset propio
```

---

## 9. Fase 6 — Moat y retención

> **Objetivo:** Construir ventajas competitivas que los competidores no puedan replicar.
> **Tiempo estimado:** Ongoing (3–6 meses)
> **Prerequisito:** Fase 5 funcionando con datos acumulándose.

---

### 6.1 Dataset propio de validaciones chilenas

Cada análisis anonimizado se convierte en datos de entrenamiento únicos. En 6–12 meses, con suficientes datos, permite:
- RAG sobre ideas exitosas/fallidas reales como evidencia en los análisis
- Benchmarks por industria basados en datos propios
- Fine-tuning futuro de un modelo especializado en emprendimiento chileno

**Pipeline de anonimización:** Antes de guardar, pasar por Haiku para eliminar datos personales identificables (nombres, emails, URLs específicas) y quedarse solo con la estructura semántica.

---

### 6.2 Matching con mentores del ecosistema

Después de generar el reporte, recomendar 2–3 mentores cuya expertise hace match con la industria y los gaps del founder-market fit. Integración con Cal.com para agendar directamente desde el reporte.

---

### 6.3 Iteraciones de idea con historial de versiones

Comparación side-by-side de scores entre versiones. Cuando el usuario pivota, el nuevo análisis incluye contexto de por qué pivotó y si el pivote mejora las dimensiones débiles anteriores.

---

## 10. Sistema de diseño PDF

> Ver archivo separado: `prompt_generateValidationPDF.md`
> Aplicar en cualquier momento, independiente de las fases de features.

**Resumen de las reglas más importantes:**

```typescript
// Paleta principal
const COLORS = {
  BRAND_DARK: '#0F1923',
  ACCENT_BLUE: '#2563EB',
  ACCENT_TEAL: '#0D9488',
  ACCENT_AMBER: '#D97706',
  ACCENT_RED: '#DC2626',
  ACCENT_GREEN: '#16A34A',
  WHITE: '#FFFFFF',
  GRAY_50: '#F8FAFC',
  GRAY_400: '#94A3B8',
  GRAY_600: '#475569',
  GRAY_800: '#1E293B',
}

// Funciones helper obligatorias
drawSectionHeader(doc, y, title, accentColor)
drawAccentCard(doc, x, y, w, h, accentColor)
drawChip(doc, x, y, text, bgColor, textColor)
drawProgressBar(doc, x, y, value)
checkPage(doc, y, neededHeight)
drawFooter(doc, pageNum, totalPages)
```

---

## 11. Notas generales para Claude Code

### Reglas de implementación

1. **Nunca romper el flujo existente.** Cada feature es aditiva. Si falla, el sistema funciona sin ella.
2. **Tipos primero.** Definir los tipos TypeScript antes de implementar la lógica.
3. **Una fase a la vez.** No empezar Fase N+1 hasta que Fase N esté probada.
4. **Tests mínimos.** Cada feature nueva necesita al menos un test del happy path.
5. **Variables de entorno.** Todas las keys nuevas van en `.env.local` y en el schema de validación de env vars.

### Modelo a usar siempre

```typescript
// Análisis principal y entregables post-validación
model: 'claude-sonnet-4-20250514'

// Pre-pasada de estructuración y anonimización
model: 'claude-haiku-4-5-20251001'

// max_tokens para análisis completo
max_tokens: 4000

// max_tokens para entregables individuales (landing, script, etc.)
max_tokens: 1000
```

### Orden de prioridad si hay que elegir

Si el tiempo es limitado, implementar en este orden exacto:

```
0.1 Onboarding con ejemplo     → activa usuarios fríos
0.3 Streaming visible          → percepción de valor
0.4 Tier freemium              → conversión
1.1 Análisis de riesgos        → calidad del reporte
3.3 Fondos CORFO               → diferenciador, 1 día de trabajo
0.2 Formulario 3 pasos         → activación
2.1 Kit 48 horas               → acción post-análisis
3.1 Hoja de ruta regulatoria   → diferenciador único en Chile
2.2 Landing page generada      → entregable tangible
4.1 Prompt caching             → optimización de costo
```

### Estructura de archivos sugerida

```
src/
├── prompts/
│   ├── systemPrompt.ts          # System prompt estático (cacheable)
│   ├── analysisPrompt.ts        # Instrucciones de análisis por sección
│   └── deliverablePrompts.ts    # Prompts para entregables post-validación
├── services/
│   ├── anthropic.ts             # Cliente API con caching y abort
│   ├── preprocessor.ts          # Haiku pre-pasada
│   ├── competitorRetrieval.ts   # RAG de competidores (Fase 5)
│   └── marketSignals.ts         # Web search signals (Fase 3)
├── data/
│   ├── corfoInstruments.ts      # Fondos CORFO estáticos
│   ├── regionalData.ts          # Industrias ancla por región
│   ├── regulatoryChecks.ts      # Permisos por industria
│   └── exampleReport.ts         # Reporte de ejemplo para onboarding
├── types/
│   ├── analysis.ts              # Tipos del análisis principal
│   ├── deliverables.ts          # Tipos de entregables post-validación
│   └── regional.ts              # Tipos de datos regionales
└── utils/
    ├── pdf/
    │   ├── generateValidationPDF.ts
    │   └── pdfHelpers.ts        # drawSectionHeader, drawChip, etc.
    └── tiers.ts                 # Lógica de secciones por tier
```

---

*Documento generado el 25 de abril de 2026 · ValidateAI · Confidencial*
