# Validus — Metodología de IA

> **Estado:** Borrador inicial · 2026-06-29
> Alineado con la **Política de Uso de IA** del producto (`/ai-policy`, creada en Fase 1).

## Rol de la IA en Validus

La IA es el motor de análisis: estructura, evalúa y resume la información del usuario para producir un score, recomendaciones y entregables. **No** es el decisor. Validus usa la IA para **estructurar evidencia y acelerar decisiones**, no para reemplazar el criterio humano.

Proveedor principal: **Anthropic (Claude)** vía API. El producto enruta ~18 tipos de análisis (prompt types) y, para casos que lo requieren, puede consultar datos externos e institucionales a través del motor **Bralidus** (GraphRAG), **según disponibilidad y configuración** de cada fuente.

## Qué información entrega el usuario

- Descripción de la idea (problema y solución).
- Mercado objetivo (segmento/ICP, tamaño, primeros clientes).
- Perfil del fundador (experiencia, founder-market fit).

La calidad del input determina la calidad del análisis.

## Qué outputs se generan

Score de 5 dimensiones, resumen ejecutivo, análisis de mercado y competencia, unit economics, gobernanza, fundraising, due diligence y exportación a PDF (según plan). Ver [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md).

## Dato, inferencia y supuesto

Validus distingue —y comunica— tres tipos de contenido:

| Tipo | Qué es | Cómo tratarlo |
|------|--------|---------------|
| **Dato** | Lo que el usuario entrega, o lo que proviene de una fuente externa real (ej. señales de mercado, datos institucionales). | Verificable; base del análisis. |
| **Inferencia** | Conclusiones y recomendaciones que el modelo deriva. | Interpretación experta, **no** hecho verificado. |
| **Supuesto** | Condiciones que la IA asume cuando falta información. | Hipótesis a validar antes de actuar. |

## Trazabilidad (cómo se muestra y hacia dónde va)

**Hoy:** la sección de evidencia muestra la procedencia de las señales externas y **etiqueta explícitamente** cuando una fuente no está disponible o cuando el contenido es demo/simulado — en lugar de presentar datos ficticios como reales.

**Trust Layer v1:** Validus ya incorpora una primera capa presentacional de confianza en el dossier: leyenda de interpretación, badges de procedencia, estados de fuente y notas por sección para distinguir entre dato del usuario, fuente externa, inferencia de IA, supuesto, datos demo/no disponibles y contenido que requiere validación humana.

Esta capa no modifica los resultados generados por IA ni representa una certificación. Su objetivo es ayudar al usuario a interpretar el análisis con mayor contexto y reducir el riesgo de tratar una inferencia como hecho verificado.

> Pendiente: profundizar el Trust Layer para mostrar indicadores de confianza de forma más granular por cada sección del dossier, aprovechar campos como `confidence`, `source_notes`, `assumptions`, `data_sources`, `sources_used`, `sources_skipped` y llevar esta trazabilidad también al export PDF.

## Riesgos de alucinación

Los modelos de lenguaje pueden generar afirmaciones imprecisas o "alucinar" información plausible pero incorrecta. Validus aplica controles (estructura de prompts, uso de datos con procedencia, etiquetado de lo no disponible) que **reducen** el riesgo, pero **no lo eliminan**.

## Limitaciones

- El análisis depende de la calidad y veracidad del input del usuario, que no se verifica exhaustivamente.
- Algunos entregables dependen de fuentes externas; sin acceso, la sección se marca como no disponible.
- El score es una evaluación estructurada, no una predicción garantizada.

## Recomendaciones humanas

- Tratar cada resultado como **punto de partida**, no como conclusión final.
- Validar de forma independiente antes de decisiones legales, financieras o de inversión.
- Para esas materias, consultar a un profesional habilitado.

## Principios de uso responsable

1. **Supervisión humana:** el usuario decide; la IA asiste.
2. **No es asesoría profesional:** ningún output constituye asesoría legal, financiera, contable ni de inversión.
3. **Transparencia:** lo demo/simulado se etiqueta; las fuentes se muestran cuando existen.
4. **Sin promesas absolutas:** Validus no garantiza levantamiento de inversión ni éxito comercial.
5. **Privacidad:** las ideas no se comparten con otros usuarios; el uso de datos anonimizados para mejora del modelo es opcional y revocable (ver [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md)).

> Referencia: este documento debe mantenerse coherente con la Política de Uso de IA publicada en el producto (`/ai-policy`).
