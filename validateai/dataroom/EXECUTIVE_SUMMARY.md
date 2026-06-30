# Validus — Resumen Ejecutivo

> **Estado:** Borrador inicial · 2026-06-29
> **Etapa:** Pre-revenue · MVP funcional en producción

## Qué es Validus

Validus es una plataforma SaaS de **validación de startups asistida por IA**. En un wizard de 4 pasos (idea, mercado, fundador, generación), convierte la descripción de un negocio en un **dossier estructurado nivel-VC**: un score de viabilidad de 5 dimensiones, análisis de mercado, competencia, unit economics, gobernanza y recomendaciones de fundraising, con entregables exportables a PDF.

La diferencia frente a un chatbot genérico: Validus **no es conversación libre**. Aplica una metodología de scoring consistente, separa dato de inferencia y de supuesto, y se apoya en **Bralidus**, un motor GraphRAG con arquitectura orientada a integrar datos institucionales de Chile (Banco Central, CMF, SEIA, INAPI), disponibles según configuración y credenciales.

## Quién lo construye

**Scouttech** (ScoutTech SpA, Chile). Validus es uno de tres productos del ecosistema Scouttech:
- **Validus** — validación de startups (este producto).
- **Denarius** — flujo de caja e inteligencia financiera para PYMEs.
- **Bralidus** — motor de inteligencia (GraphRAG) que potencia a los anteriores.

## Problema que resuelve

Los founders toman decisiones de alto costo (construir, levantar capital, contratar) sobre **supuestos no validados**. La validación rigurosa hoy es cara (consultoría), lenta o inconsistente (plantillas, criterio individual). Los inversionistas y aceleradoras, a su vez, carecen de un **diagnóstico estandarizado y comparable** entre proyectos.

## Usuario objetivo

- **Founders early-stage** — ordenar la idea antes de construir o levantar capital.
- **Startups pre-seed / seed** — estructurar evidencia de mercado, riesgos y unit economics para una ronda.
- **Aceleradoras e incubadoras** — estandarizar diagnósticos y comparar cohortes.
- **Equipos de innovación** — evaluar oportunidades antes de comprometer presupuesto.

## Propuesta de valor

Un **dossier de inversión estructurado en ~10 minutos**, con metodología consistente, evidencia con procedencia y trazabilidad, a una fracción del costo de una consultoría — y comparable entre proyectos.

## Estado actual del producto

- **MVP funcional en producción** (https://validus.scouttech.lat).
- Wizard de 4 pasos, score de 5 dimensiones, dashboard de resultados, exportación PDF.
- ~18 tipos de análisis (prompt types) en la Edge Function `ai-validate`.
- 4 planes (Free/Basic/Pro/Premium) con control de uso por tier ya implementado.
- Privacidad alineada a la **Ley 21.719** (Chile): hashing de RUT en vault, IP truncada, separación de auditoría.
- **Pre-revenue:** sin usuarios pagos a la fecha. El cobro (LemonSqueezy) está temporalmente en pausa y las compras se canalizan a una **waitlist Early Bird**.

> Pendiente: métricas de uso real (usuarios activos, validaciones completadas) — por medir y publicar cuando haya volumen significativo.

## Modelo de negocio

SaaS freemium por tiers (mensual, CLP). El plan gratuito permite explorar; los pagados escalan en cuota mensual y profundidad de análisis (datos macro, unit economics, gobernanza, due diligence, API). Costo variable por reporte profundo **estimado** en ~US$1 *(estimado, a validar con facturación real)* → margen bruto objetivo alto, típico de SaaS de IA. Ver [BUSINESS_MODEL.md](BUSINESS_MODEL.md).

## Diferenciación

- **Metodología, no chat:** score de 5 dimensiones consistente y comparable.
- **Datos institucionales de Chile** vía Bralidus, con procedencia citable cuando las fuentes están disponibles — no solo conocimiento del modelo.
- **Trazabilidad:** distingue dato, inferencia y supuesto; etiqueta lo demo/simulado.
- **Foco LatAm / Chile:** contexto regulatorio y de mercado local (Ley 21.719, INAPI, CMF), no un producto US genérico.

## Riesgos principales

- **Comercial:** pre-revenue; falta validar disposición a pagar y conversión free→pago.
- **Producto/IA:** riesgo de alucinación inherente a LLMs; mitigado con trazabilidad y supervisión humana, no eliminado.
- **Dependencias:** proveedores de IA y datos externos (Anthropic, SerpApi, APIs públicas).
- **Marca:** coherencia interna `validateai` → `validus` pendiente; registro de marca por confirmar.

Detalle completo en [RISKS_AND_LIMITATIONS.md](RISKS_AND_LIMITATIONS.md).

## Próximos hitos (resumen)

- **30 días:** cerrar capa de confianza/legal, completar data room, revisar fuentes de datos.
- **60 días:** primeros pilotos, métricas iniciales, primera versión del Trust Layer.
- **90 días:** integraciones de datos reales en producción, data room ampliado, analítica y preparación de conversaciones institucionales.

Detalle en [ROADMAP.md](ROADMAP.md).
