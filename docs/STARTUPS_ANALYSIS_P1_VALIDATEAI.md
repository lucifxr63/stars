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

## 2. Flujos de Usuario y UI (El Wizard en Código de Producción)

Tras la revisión técnica del componente `Validate.tsx` y sus subcomponentes, se identifican 3 flujos de validación estrictamente lineales (no conversacionales):

### Flujo Detailed (Análisis Completo)
Es el flujo estándar para usuarios *Free* y *Basic*.
- **Paso 1: `StepIdea`:** El usuario rellena un formulario clásico con el Nombre de la idea, Descripción de la solución, y selecciona la Industria mediante etiquetas.
- **Paso 2: `StepMarket`:** Define el segmento de mercado, el país objetivo (obligatorio), el modelo de negocio (ej. B2B, B2C) y el canal de adquisición inicial.
- **Paso 3: `StepFounder`:** Ingresa sus años de experiencia en la industria, su nivel técnico, y si ha vivido personalmente el problema.
- **Paso 4: `StepGenerating`:** Pantalla de carga asíncrona. Aquí, la UI envía el contexto completo a las funciones *edge*, y se lanzan en paralelo múltiples tareas de análisis de mercado, competencia y viabilidad (mostrando una barra de progreso).

### Flujo Premium (Due Diligence)
Activado cuando el usuario tiene la suscripción *Pro* o *Premium*. 
- **Paso 1: `StepUpload`:** El usuario arrastra un documento PDF (Pitch Deck) o JSON. Una función en segundo plano (`parse-project`) extrae silenciosamente la estructura del negocio.
- **Paso 2: `StepIdea`:** La UI redirige al usuario para confirmar el Nombre y la Industria (datos mínimos obligatorios para el LLM).
- **Paso 3: `StepGenerating` (Premium Terminal):** Se despliega una interfaz estilo "terminal hacker" detallando cómo la IA se conecta a fuentes de datos y escanea señales de mercado (ej. Reddit, web) en tiempo real, para luego redirigir a los resultados.

### Flujo Quick (Análisis Rápido)
Un flujo veloz que omite pasos manuales asumiendo datos.
- **Paso 1: `StepIdea`:** Se rellena solo la idea básica e industria.
- **Paso 2: `StepGenerating`:** La IA primero *infiere* el mercado, cliente objetivo y modelo de negocio (llamando a la función `ai-validate` con el prompt `customer_analysis`) y luego procede a generar el reporte completo basándose en esos supuestos, sin hacer preguntas al usuario.

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
