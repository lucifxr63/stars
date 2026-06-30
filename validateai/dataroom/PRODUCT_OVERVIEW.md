# Validus — Visión de Producto

> **Estado:** Borrador inicial · 2026-06-29
> Documento descriptivo. No modifica ni define la lógica del producto; documenta lo implementado.

## Descripción funcional

Validus es una aplicación web (SPA) que guía a un usuario por un proceso estructurado de validación de su idea de negocio y produce un **dossier** con score, análisis y entregables exportables. La generación de contenido se apoya en modelos de IA y, según el plan, en datos externos e institucionales.

**Stack (alto nivel):** React 19 + Vite + TypeScript + Tailwind, frontend en Vercel; backend en Supabase (Postgres + Edge Functions en Deno); proveedor de IA principal Anthropic (Claude). *(Detalle técnico en el repositorio y en `validateai/CLAUDE.md`.)*

## Flujo general del usuario

1. **Registro / acceso** — autenticación vía Supabase (incluye Google OAuth).
2. **Onboarding** — captura inicial de contexto del usuario/founder.
3. **Wizard de validación (4 pasos)** — ver abajo.
4. **Generación** — la IA produce el análisis; el progreso se persiste y puede continuar en background.
5. **Dashboard de resultados** — score, secciones del dossier, evidencia y exportación a PDF.

## Wizard de validación (4 pasos)

1. **Idea** — problema y solución en lenguaje natural.
2. **Mercado** — segmento/ICP, tamaño y primeros clientes.
3. **Fundador** — experiencia y founder-market fit.
4. **Generación** — la plataforma arma el dossier.

## Score de validación (5 dimensiones)

El score combina cinco dimensiones: **problema, mercado, competencia, solución y ejecución**. Es el núcleo metodológico del producto: una evaluación estructurada y comparable, **no** una predicción garantizada de éxito.

> Nota: el score es una herramienta de diagnóstico. Refleja la evidencia y los supuestos ingresados, no una certeza sobre el desempeño futuro.

## Entregables

Según el plan del usuario, el dossier puede incluir:

- Score de validación (5 dimensiones)
- Resumen ejecutivo + feedback
- Análisis de problema y mercado (TAM/SAM/SOM)
- Benchmark / análisis de competidores
- Unit economics (CAC, LTV, payback)
- Gobernanza, cap table y fundraising roadmap
- Founder fit y recomendación de equipo
- Due diligence (cruce con fuentes públicas: SII, INAPI, CMF — según disponibilidad)
- Exportación a PDF (estándar e investor-ready)

La disponibilidad por plan se detalla en [BUSINESS_MODEL.md](BUSINESS_MODEL.md).

## Planes / tiers

Cuatro niveles: **Free, Basic, Pro, Premium**. Cada uno define una cuota mensual de validaciones (con un subconjunto de análisis "costosos" que usan búsqueda web / APIs externas) y la profundidad de los entregables. Cuotas y precios en [BUSINESS_MODEL.md](BUSINESS_MODEL.md).

## Casos de uso

- **Founders early-stage:** ordenar antes de construir.
- **Pre-seed / seed:** evidencia para la ronda.
- **Aceleradoras / incubadoras:** diagnóstico estandarizado y comparable.
- **Equipos de innovación:** evaluar oportunidades antes de invertir presupuesto.

## Motor de inteligencia (Bralidus)

Bralidus es el motor GraphRAG con arquitectura orientada a proveer evidencia con procedencia, integrando datos institucionales de Chile **según disponibilidad y configuración**. La sección de evidencia del producto muestra señales de fuentes externas cuando están disponibles, y **etiqueta de forma explícita** cuando una fuente no está disponible o cuando el contenido es demo/simulado (no se presentan datos ficticios como reales).

> Pendiente: confirmar y documentar qué fuentes están **activas en producción** vs. **en consolidación** (varias dependen de credenciales/configuración).

## Limitaciones actuales

- La generación no-premium ya corre en **background** (fire-and-forget + progreso persistente y resumible, con polling en el dashboard); el flujo **premium** sigue siendo **síncrono con timeout de 60s** (terminal en vivo + fallback elegante). La migración del premium a asíncrono real (worker + polling) está planificada — ver [docs/ASYNC_GENERATION_PLAN.md](../docs/ASYNC_GENERATION_PLAN.md). La fiabilidad de generación (éxito/parcial/fallo + duración) ya se mide vía analítica.
- Parte de la integración de datos externos depende de credenciales/configuración; sin ellas, la fuente se muestra como "no disponible" en lugar de inventar datos.
- El **Trust Layer** muestra fuente, supuestos, advertencias y nivel de confianza por sección del dossier (v2): cada sección surfacia los metadatos que la IA produce, con un componente reutilizable `SectionTraceability` y un resumen agregado de fuentes en la Evidence Wall. Pendiente: unificar el estilo entre todas las cards y llevarlo al export PDF.
- Cobertura de tests y analítica de producto en ampliación.

> Pendiente: documentar capturas de pantalla del flujo y del dossier para anexar al data room.

## Roadmap funcional (resumen)

Profundizar el Trust Layer, activar integraciones de datos reales en producción, generación asíncrona y analítica de producto. Detalle temporal en [ROADMAP.md](ROADMAP.md).
