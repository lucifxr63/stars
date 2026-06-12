<div align="center">
  <img src="https://via.placeholder.com/150/0F172A/10B981?text=Validus" alt="Validus Logo" width="120" style="border-radius: 20px;" />

  # Validus
  
  **La plataforma SaaS definitiva para validar ideas de negocio con Inteligencia Artificial.**

  [![React](https://img.shields.io/badge/React-19-blue?logo=react&logoColor=white)](https://react.dev)
  [![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-Edge_Functions-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
  [![Claude 3.5 Sonnet](https://img.shields.io/badge/AI-Claude_3.5_Sonnet-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
  [![Vercel](https://img.shields.io/badge/Hosted_on-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

  [ðŸŒ Ver en ProducciÃ³n](https://validus.scouttech.lat) â€¢
  [ðŸ“š DocumentaciÃ³n](#arquitectura-y-flujo-de-datos) â€¢
  [ðŸ› Reportar Bug](#contribuir)
</div>

---

## ðŸ“– Sobre el Proyecto

Validus guÃ­a a emprendedores e inversores a travÃ©s de un **wizard interactivo de 4 pasos**, generando una validaciÃ³n exhaustiva de ideas de negocio en minutos. Al finalizar, el sistema entrega un **Score (0-100)**, feedback cualitativo y hasta **18 entregables avanzados**, incluyendo:
- ðŸ“Š AnÃ¡lisis competitivo impulsado por *Web Search*.
- ðŸ’° Proyecciones financieras (*Unit Economics*).
- ðŸ§‘â€ðŸ¤â€ðŸ§‘ AnÃ¡lisis de *Founder-Market Fit*.
- ðŸ—ºï¸ VisualizaciÃ³n interactiva 3D del mercado regional chileno.

---

## âš¡ CaracterÃ­sticas Principales

- **ðŸ¤– Motor Multi-IA:** Optimizado con **Anthropic Claude Sonnet 4** (Prompt Caching) y fallback a **OpenAI GPT-4o Mini**.
- **ðŸ§  CachÃ© SemÃ¡ntico Inteligente:** Uso de `pgvector` para buscar y reutilizar anÃ¡lisis similares (Threshold: 0.92), reduciendo costos de API.
- **ðŸ“ˆ Datos MacroeconÃ³micos reales:** IntegraciÃ³n con el **Banco Central de Chile** e **INE** para clasificaciones industriales y series econÃ³micas.
- **ðŸŽ¨ UX/UI Premium:** DiseÃ±o enfocado en la usabilidad ("Bento Box" Layout) con **Tailwind CSS v4** y animaciones fluidas con **Framer Motion**.
- **ðŸ“‘ GeneraciÃ³n de Entregables:** ExportaciÃ³n de reportes a PDF on-demand con `jsPDF`.

---

## ðŸ› ï¸ Stack TecnolÃ³gico

<details>
<summary>Haga clic para expandir la lista completa del Stack</summary>

### Frontend
- **Framework:** React 19 + Vite
- **Lenguaje:** TypeScript 6
- **Estilos:** Tailwind CSS v4 + shadcn/ui
- **Estado:** Zustand v5 (con persistencia local)
- **Enrutamiento:** React Router v7
- **Formularios:** React Hook Form + Zod
- **VisualizaciÃ³n 3D:** Three.js + React Three Fiber + d3-geo
- **GrÃ¡ficos:** Recharts

### Backend & Cloud (Supabase)
- **Base de Datos:** PostgreSQL + `pgvector`
- **AutenticaciÃ³n:** Supabase Auth (Email + Google OAuth con PKCE)
- **Serverless:** Edge Functions (Deno) para orquestaciÃ³n de IA y APIs externas.
- **Hosting:** Vercel

</details>

---

## ðŸš€ Inicio RÃ¡pido

### Requisitos Previos
- Node.js (v18+)
- Cuenta en [Supabase](https://supabase.com)
- Claves de API de [Anthropic](https://anthropic.com) y/o [OpenAI](https://openai.com)

### InstalaciÃ³n

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   git clone <repo-url>
   cd validateai
   npm install
   ```

2. **Configurar Variables de Entorno (Frontend):**
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` con tus credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```

3. **Configurar Supabase Secrets (Backend):**
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=tu-clave
   supabase secrets set OPENAI_API_KEY=tu-clave
   supabase secrets set AI_PROVIDER=anthropic # o 'openai'
   supabase secrets set BDE_USER=tu-usuario-bcch
   supabase secrets set BDE_PASS=tu-password-bcch
   ```

4. **Ejecutar en Desarrollo:**
   ```bash
   npm run dev
   ```

---

## ðŸ—ï¸ Arquitectura y Flujo de Datos

```mermaid
graph TD
    A[Usuario Wizard] -->|Zod + RHF| B(Zustand Store)
    B -->|Generar ValidaciÃ³n| C{Edge Function: ai-validate}
    C -->|JWT & Rate Limit| D[Supabase Profiles]
    C -->|BÃºsqueda SemÃ¡ntica| E[(pgvector: cached_analyses)]
    E -->|Cache Miss| F[Claude Sonnet 4 / GPT-4o Mini]
    E -->|Cache Hit| G[Respuesta RÃ¡pida]
    F --> H[(PostgreSQL: validations)]
    G --> H
    H --> I[Dashboard 'Bento Box']
    I -->|On-Demand| J[GeneraciÃ³n PDF / Entregables extra]
```

### ðŸ§  Edge Functions Core

| FunciÃ³n | DescripciÃ³n | LÃ­mites (Rate Limit) |
|---------|-------------|----------------------|
| `ai-validate` | Motor central de IA. Maneja 18 tipos de prompts, RAG y cachÃ©. | SegÃºn el **Tier** del usuario. |
| `market-analyze`| Ingiere datos macro del BCCh e INE para insights. | 10 llamadas / dÃ­a. |
| `anonymize-idea`| Ofusca PII usando Claude Haiku para entrenar modelos. | 5 llamadas / dÃ­a. |

### ðŸ’³ Sistema de Tiers (Niveles de Acceso)

El sistema de roles y rate limits estÃ¡ controlado desde la tabla `profiles`.

- **Free:** Score, desglose, preguntas clave y prÃ³ximos pasos. (5 llamadas/dÃ­a)
- **Basic:** + Segmento de cliente, propuesta de valor, anÃ¡lisis de riesgos. (20 llamadas/dÃ­a)
- **Pro:** + MVP specs, AnÃ¡lisis FODA, Unit Economics, Founder-Market Fit. (50 llamadas/dÃ­a)
- **Premium:** Acceso total (SeÃ±ales de mercado, Competitive Analysis avanzado, kit de documentos). (200 llamadas/dÃ­a)

---

## ðŸ—„ï¸ Esquema de Base de Datos

Las migraciones se gestionan a travÃ©s del CLI de Supabase (`supabase/migrations/`).
*Para sincronizar el esquema local:* `supabase db push`

| Tabla Principal | PropÃ³sito |
|-----------------|-----------|
| `profiles` | ExtensiÃ³n de usuarios autenticados. Controla los `tiers` y consentimientos. |
| `validations` | Almacena los resultados del Wizard. Soporta versiones (pivotes). |
| `ai_interactions` | Logs de telemetrÃ­a, tokens consumidos y modelos usados. |
| `cached_analyses` | Repositorio para el CachÃ© SemÃ¡ntico (`pgvector`). |
| `competitors` | Base documental para el sistema RAG de anÃ¡lisis competitivo. |
| `market_ai_insights`| Resultados cacheados de series macroeconÃ³micas. |

---

## ðŸ›£ï¸ Roadmap & Deuda TÃ©cnica

Para una vista detallada de los prÃ³ximos sprints, revisa el documento [SPRINTS.md](SPRINTS.md).

**Prioridades Inmediatas:**
1. IntegraciÃ³n de **Stripe Checkout** y webhooks para actualizaciÃ³n automÃ¡tica de Tiers.
2. ImplementaciÃ³n de analÃ­ticas de producto con **PostHog**.
3. RefactorizaciÃ³n de la Edge Function `ai-validate` para desacoplar los 18 prompts y mejorar la mantenibilidad.

---

## ðŸ¤ Contribuir

Este es un proyecto cerrado en etapa temprana. Para reportar bugs, solicitar nuevas caracterÃ­sticas o proponer un *pull request*, por favor contacta al lÃ­der tÃ©cnico o crea un Issue documentado en el repositorio.

<div align="center">
  <p>Creado con â¤ï¸ por el equipo de Validus.</p>
</div>
