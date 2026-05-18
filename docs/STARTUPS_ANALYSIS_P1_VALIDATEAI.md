# Análisis Detallado: ValidateAI

## 1. Stack Tecnológico

ValidateAI es una plataforma SaaS moderna, orientada al rendimiento y fuertemente integrada con Inteligencia Artificial.

### Frontend
- **Framework & Build:** React 19 + Vite.
- **Lenguaje:** TypeScript 6.
- **Estilado:** Tailwind CSS v4 con componentes basados en shadcn/ui.
- **Gestión de Estado:** Zustand v5 con persistencia local (`validationStore`, `authStore`).
- **Enrutamiento:** React Router v7.
- **Formularios & Validación:** React Hook Form + Zod.
- **Gráficos & Renderizado Avanzado:** Recharts (para funnel y métricas), Three.js + React Three Fiber + d3-geo (para visualizaciones de mercado).
- **Exportación de Documentos:** `jsPDF` (generación de Dossier y Pitch Deck on-demand).
- **Analíticas:** PostHog (eventos como `trackWizardStep`, `trackDeliverableDownloaded`).

### Backend (BaaS)
- **Infraestructura:** Supabase.
- **Base de Datos:** PostgreSQL con extensión `pgvector` para búsquedas de similitud (caché semántico de IA y RAG) y tabla `economic_knowledge`.
- **Autenticación:** Supabase Auth (Email/Password y Google OAuth con PKCE).
- **Lógica de Servidor (Serverless):** Supabase Edge Functions (Deno).
- **Cloud Hosting:** Vercel (Frontend).

---

## 2. Flujos de Usuario y UI (El Wizard en detalle)

El núcleo del sistema de ValidateAI es un "Wizard" de validación (`/validate`) compuesto por varios pasos (Steps) que recolectan información estructurada para alimentar a la IA.

### Detalle de Pasos del Wizard e Información Adquirida

**Paso 1: `StepIdea` (Tu Idea)**
- **Campos Recolectados:** 
  - `idea_name`: Nombre del proyecto.
  - `idea_description`: Problema y solución en texto libre.
  - `current_solution` (Opcional): Cómo resuelven hoy el problema los usuarios.
  - `idea_industry`: Sector de la industria mediante botones de selección (chips).
- **Propósito:** Definir la base semántica que se utilizará para extraer a los competidores, generar embeddings para el caché en `pgvector` y ubicar el nicho de mercado inicial.

**Paso 2: `StepMarket` (Tu Mercado)**
- **Campos Recolectados:** 
  - `customer_segment` (textarea): A quién le vendes.
  - `target_country` y `target_region`: País (Obligatorio) y ciudad (Opcional) para enfocar el análisis macroeconómico.
  - `business_model`: Selector B2B, B2C, B2B2C o Marketplace.
  - `pricing_range`: Rango de precios estimados del producto.
  - `acquisition_channel` (Opcional): Canal de adquisición inicial (e.g. Outbound LinkedIn, Ads Meta, etc.).
- **Propósito:** Estructurar los inputs financieros que la IA utilizará para calcular el TAM (Total Addressable Market), SAM (Serviceable Available Market), proyectar el *Unit Economics* (LTV:CAC) y generar un *Lean Roadmap* y *Go-To-Market strategy*.

**Paso 3: `StepFounder` (Tú como Founder)**
- **Campos Recolectados:** 
  - `yearsInIndustry` (número): Años de experiencia en el rubro.
  - `hasTechnicalCofounder` (checkbox): Determina si hay músculo técnico interno.
  - `tech_level` (radio): Nivel de madurez (Nada técnico, Algo de código, Somos devs).
  - `personallyFacedProblem` (checkbox): Si el fundador ha vivido el problema que intenta resolver.
- **Propósito:** Evaluar el "Founder Fit". La IA pondera estos factores para dar un diagnóstico de las capacidades de ejecución del equipo (Technical Risk vs Market Risk), y definir si el MVP sugerido debe ser *No-code* o *Custom Code*.

---

## 3. APIs Consumidas y Orquestación de IA

ValidateAI no solo usa modelos generativos de IA, sino que se enriquece consumiendo datos duros de mercado mediante APIs gubernamentales de Chile, orquestados en sus Edge Functions.

### API de Inteligencia Artificial (LLMs)
- **OpenAI (`text-embedding-3-small`):** API consumida para generar vectores semánticos del texto del usuario y buscar similitudes en la base de datos (Cache semántico umbral `0.92`).
- **Anthropic (Claude 3.5 Sonnet):** API principal (`ai-validate`) usada para razonamiento complejo, análisis competitivo web y redacción de los 18 entregables del "Bento Box".

### APIs Macroeconómicas y Gubernamentales

**A. Edge Function: `market-analyze`**
- **APIs Consumidas:** 
  - **INE (Instituto Nacional de Estadísticas):** `https://rapps.ine.cl:9292/predict`
  - **Banco Central de Chile (BCCh):** `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx`
- **Flujo y Fin:** 
  1. Toma la idea y descripción del usuario y hace un POST al INE para predecir el código **CAENES** (Clasificador de Actividades Económicas) asociado.
  2. Con el país y CAENES, consulta al API del BCCh (`GetSeries`) obteniendo series históricas de los últimos 5 años (e.g. IPC General).
  3. **Fin:** Todos estos datos duros y estadísticos se inyectan en un prompt gigantesco que se envía a `gpt-4o-mini`. Esto evita que la IA alucine y garantice que el análisis de tamaño de mercado (TAM/SAM) y las métricas sectoriales estén ancladas a datos reales de la economía chilena actual.

**B. Edge Function: `sync-economic-data`**
- **APIs Consumidas:** 
  - **CMF (Comisión para el Mercado Financiero):** `api.cmfchile.cl`
  - **SII API Gateway:** `app.apigateway.cl`
- **Flujo y Fin:**
  1. Descarga indicadores financieros críticos: Unidades de Fomento (`uf_mes`, `uf_anio`) y `corr_monetaria` anual.
  2. Almacena o actualiza estos datos crudos en formato JSON dentro de la tabla `economic_knowledge` de Supabase.
  3. **Fin:** Sirve como base de datos RAG (Retrieval-Augmented Generation). Cuando la función `ai-validate` genera las "Proyecciones Financieras" o calcula los costos operativos locales, consulta esta tabla y se asegura de hacer los cálculos financieros con el valor exacto de la UF o el IPC al día de la consulta.

---

### Costos Estimados y Tiers
El sistema optimiza gastos apoyándose en el caché de vectores y delegando la clasificación a modelos rápidos (`gpt-4o-mini`) antes de usar a Claude Sonnet.
- **Free Tier:** 5 llamadas/día. (Ideas simples). ~$0.005 USD.
- **Basic Tier:** 20 llamadas/día. (Desbloquea Riesgos).
- **Pro Tier:** 50 llamadas/día. (Unit economics, Founder Fit). ~$0.04 - $0.06 USD.
- **Premium Tier:** 200 llamadas/día. (Web search, Pitch Deck). ~$0.15 - $0.20 USD por reporte.
