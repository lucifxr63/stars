# Validus — Go-To-Market (inicial)

> **Estado:** Borrador inicial · 2026-06-29
> Plan de adquisición de etapa temprana. Las tácticas son hipótesis a validar; no hay canales con resultados medidos aún.

## Segmentos objetivo (priorización)

1. **Founders early-stage (Chile/LatAm)** — dolor inmediato, ciclo corto, autoservicio (PLG).
2. **Startups pre-seed / seed** — necesitan evidencia para su ronda; mayor disposición a pagar.
3. **Aceleradoras e incubadoras** — canal B2B2C: estandarizan diagnóstico de cohortes (efecto multiplicador).
4. **Equipos de innovación corporativa / programas públicos** — ciclo más largo, ticket mayor.

## Canales posibles

- **Product-led growth (PLG):** plan Free como punto de entrada; conversión a pago por profundidad.
- **Orgánico / SEO-AEO-GEO:** la landing ya incluye metadata estructurada (JSON-LD) y contenido para motores de respuesta/generativos. Apalancar contenido de validación de startups.
- **LinkedIn y X (build in public):** compartir aprendizajes, dossiers de ejemplo y la metodología.
- **Partnerships con aceleradoras/incubadoras:** pilotos con cohortes.
- **Comunidades de founders** (Chile/LatAm): programas de fomento, hubs, eventos.
- **Ads segmentados (Meta/LinkedIn):** adquisición pagada hacia el plan Free, con CAC objetivo acotado.

## Estrategia "build in public"

Compartir el desarrollo, la metodología de scoring y casos de ejemplo (claramente etiquetados como ejemplos) para construir credibilidad y deal flow de usuarios tempranos, sin inventar tracción.

## Aceleradoras / incubadoras

Canal de alto apalancamiento: un acuerdo con una aceleradora expone Validus a una cohorte completa. Propuesta: estandarizar el diagnóstico de proyectos y prepararlos para mentoría/inversión.

> Pendiente: confirmar pilotos. No hay acuerdos firmados a la fecha.

## Pilotos con founders

Reclutar un grupo inicial de founders para validar el producto end-to-end, recoger feedback y producir casos de uso reales (con permiso).

Existe una **base operativa de pilotos** (interna): programa, guion de entrevista de discovery y plantilla de pipeline comercial en [`validateai/ops/`](../ops/PILOT_PROGRAM.md) — con criterios de selección, qué se mide (referenciando la analítica de Fase 8) y cómo convertir piloto → pago cuando el cobro se reactive. Aún **sin pilotos activos ni acuerdos firmados**.

> Pendiente: fijar con el equipo los umbrales de éxito y los números concretos (no inventar). Enriquecer la captura de leads (plan/fuente/segmento en BD) requiere tocar Edge Function/schema — documentado como pendiente en el programa de pilotos.

## Estrategia de contenido

- Guías de validación, frameworks y "cómo lee un VC tu startup".
- Casos de ejemplo del dossier (etiquetados como ejemplos).
- Contenido optimizado para SEO/AEO/GEO (responder preguntas de founders).

## Métricas a monitorear

- **Adquisición:** visitas, signups, CAC por canal.
- **Activación:** % que completa el wizard, tiempo al primer dossier.
- **Conversión:** free→Basic/Pro, paywall hits.
- **Retención:** validaciones recurrentes, cohortes.
- **Referidos / viralidad:** comparticiones de dossier.

> Todas pendientes de medir con volumen real.

## Riesgos de adquisición

- **Educación de mercado:** posicionar Validus frente a "usar ChatGPT gratis".
- **CAC pagado:** riesgo de CAC alto si la conversión free→pago es baja.
- **Dependencia de partnerships:** pilotos por confirmar; sin ellos, el canal B2B2C no arranca.
- **Cobro en pausa:** mientras la pasarela esté dormante, la conversión real a pago no puede medirse (solo waitlist).
