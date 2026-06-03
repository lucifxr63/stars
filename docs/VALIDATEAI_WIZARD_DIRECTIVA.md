# ValidateAI — Análisis Estructural del Wizard de Validación
### Documento para Mesa Directiva
**Fecha:** 01 de Junio 2026  
**Versión:** v1.0  
**Producto:** ValidateAI — Plataforma de validación de startups  
**URL producción:** https://validus.scouttech.lat

---

## 1. RESUMEN EJECUTIVO

ValidateAI es una plataforma SaaS que guía a emprendedores a través de un wizard de 3–4 pasos para evaluar la viabilidad de su startup mediante IA. El producto procesa la descripción de la idea, el contexto de mercado y el perfil del fundador, y genera un score 0–100 con análisis profundos en hasta 15 dimensiones.

**Stack tecnológico:** React 19 + Supabase (PostgreSQL + Edge Functions Deno) + Anthropic Claude (Haiku / Sonnet) + Vercel

**Modelo de negocio:** SaaS por suscripción — 4 tiers (Free / Basic / Pro / Premium) con análisis progresivamente más profundos según el plan.

**Estado actual:** MVP funcional en producción. Sin usuarios pagos activos todavía. Objetivo inmediato: primeros 10 clientes pagos.

---

## 2. FLUJO WIZARD — VISIÓN GENERAL

El wizard tiene **3 modalidades** que se adaptan al tier del usuario:

| Modalidad | Pasos | Tier | Descripción |
|-----------|-------|------|-------------|
| **Detallado** | 4 pasos | Free / Basic / Pro | Idea → Mercado → Fundador → Generación |
| **Rápido** | 2 pasos | (override manual) | Idea → Generación |
| **Premium** | 3 pasos | Premium | Subir PDF → Idea → Generación |

El usuario puede elegir entre "Análisis Rápido" (5 min) y "Análisis Completo" (10 min) directamente en el primer paso.

---

## 3. DETALLE POR PASO

### PASO 1 — IDEA

**Propósito:** Capturar la esencia del problema y la solución propuesta.

| Campo | Descripción | Obligatorio |
|-------|-------------|-------------|
| Nombre de la idea | Nombre corto (2–100 caracteres) | Sí |
| Descripción de la idea | Problema + solución + público objetivo (mínimo 100 caracteres, máximo 2.000). Incluye indicador visual de calidad mientras el usuario escribe. | Sí |
| Solución actual | Cómo resuelven hoy el problema los clientes (ej: "Usan Excel y WhatsApp") | No |
| Industria | Selección entre 11 categorías: Fintech, EdTech, HealthTech, E-commerce, SaaS, Marketplace, Social, Logistics, FoodTech, PropTech, Otro | Sí |

**Nota de UX:** La descripción tiene un indicador de calidad en tiempo real que cambia de color según la profundidad del texto. Esto guía al usuario a entregar más contexto sin bloquearlo.

---

### PASO 2 — MERCADO *(solo modalidad Detallado)*

**Propósito:** Caracterizar el mercado objetivo y el modelo de negocio.

| Campo | Descripción | Obligatorio |
|-------|-------------|-------------|
| Perfil de cliente ideal (ICP) | Industria + tamaño de empresa + cargo/rol objetivo (40–500 caracteres) | Sí |
| País objetivo | Selección entre 18 países latinoamericanos + España + EE.UU. | Sí |
| Región específica | Ciudad o región (ej: "Santiago", "CDMX") | No |
| Modelo de negocio | B2B / B2C / B2B2C / Marketplace | Sí |
| Rango de precio | Free / 1–10 USD / 10–50 USD / 50–100 USD / 100+ USD | Sí |
| Canal de adquisición | LinkedIn outbound, Ads Meta, Comunidades, Referidos, Alianzas, SEO, Eventos, Otro | No |

**Alerta automática:** si el usuario selecciona B2B + precio gratis, el sistema muestra una advertencia sobre la sostenibilidad del modelo (sin bloquear el avance).

---

### PASO 3 — FUNDADOR *(solo modalidad Detallado)*

**Propósito:** Evaluar la idoneidad del fundador para el problema que quiere resolver.

| Campo | Descripción | Obligatorio |
|-------|-------------|-------------|
| Años de experiencia en la industria | Número 0–50 | Sí |
| ¿Tiene co-founder técnico? | Checkbox | Sí |
| Nivel técnico del equipo | No técnico (No-Code) / Algo de código (MVP básico) / Equipo técnico completo | Sí |
| ¿Ha vivido el problema personalmente? | Checkbox | Sí |

**Dato importante:** este paso alimenta directamente el análisis de "Founder-Market Fit", una de las 15 dimensiones evaluadas.

---

### PASO 4 — GENERACIÓN *(todos los flujos)*

**Propósito:** Ejecutar los análisis de IA y presentar los resultados.

El sistema lanza en paralelo hasta 3 análisis según el tier del usuario:

| Análisis | Tier mínimo | Tiempo estimado | Costo IA aprox. |
|----------|-------------|-----------------|-----------------|
| Evaluación de viabilidad (Score 0–100) | Free | 8–15 seg | $0.002 USD |
| Análisis de competencia | Basic | 15–30 seg | $0.05–0.20 USD |
| Tamaño de mercado (TAM/SAM/SOM) | Pro | 15–30 seg | $0.05–0.20 USD |

Cada análisis tiene estado visual: en espera → procesando → completado / error parcial.

**Experiencia premium:** muestra una terminal animada simulando consultas en tiempo real a fuentes externas (Reddit, Google Trends, síntesis IA). Actualmente con datos simulados; integración real está en el roadmap.

---

## 4. SCORING — CÓMO SE CALCULA EL PUNTAJE

### Fórmula del Score Final (0–100)

```
Score = (Problema × 25%) + (Mercado × 20%) + (Competencia × 15%) + (Solución × 25%) + (Ejecución × 15%)
```

### Las 5 Dimensiones

| Dimensión | Peso | Qué evalúa |
|-----------|------|-----------|
| **Problema** | 25% | ¿El problema es real, frecuente y urgente? ¿Hay evidencia empírica? |
| **Mercado** | 20% | ¿El mercado es grande y accesible, o es proyectado sin validar? |
| **Competencia** | 15% | ¿Hay espacio diferenciado? (100 = nicho claro; 0 = saturado sin diferenciación) |
| **Solución** | 25% | ¿La solución es 10x mejor o apenas marginal? |
| **Ejecución** | 15% | ¿El MVP es realista? ¿El equipo tiene capacidad para ejecutarlo? |

### Interpretación del Score

| Rango | Nivel | Significado |
|-------|-------|-------------|
| 0 – 40 | Crítico | Riesgos altos — validar antes de invertir cualquier recurso |
| 41 – 60 | Mejora necesaria | Potencial, pero con gaps significativos que resolver |
| 61 – 80 | Viable | Buena base — listo para construir un MVP |
| 81 – 100 | Excelente | Oportunidad de inversión clara |

**Postura del sistema:** El motor de IA adopta el rol de "socio de fondo VC implacable", no de coach motivacional. Penaliza fuertemente la ausencia de validación empírica, el sesgo de confirmación y los mercados proyectados sin evidencia.

---

## 5. CATÁLOGO DE ANÁLISIS DISPONIBLES (26 TIPOS)

Más allá de los 3 análisis generados automáticamente, el usuario puede solicitar análisis adicionales on-demand desde la pantalla de resultados:

### Análisis Disponibles por Tier

| Análisis | Free | Basic | Pro | Premium |
|----------|------|-------|-----|---------|
| Score + desglose 5 dimensiones | ✓ | ✓ | ✓ | ✓ |
| 5 preguntas de Customer Discovery (Mom Test) | ✓ | ✓ | ✓ | ✓ |
| Próximos pasos recomendados | ✓ | ✓ | ✓ | ✓ |
| Perfil de cliente ideal (ICP) | — | ✓ | ✓ | ✓ |
| Propuesta de valor diferenciada | — | ✓ | ✓ | ✓ |
| Análisis de competencia (4–6 competidores reales) | — | ✓ | ✓ | ✓ |
| Plan de MVP (5–6 features priorizadas) | — | — | ✓ | ✓ |
| Análisis SWOT | — | — | ✓ | ✓ |
| Análisis de riesgos (4 dimensiones) | — | — | ✓ | ✓ |
| Unit Economics (CAC / LTV / Payback / Churn) | — | — | ✓ | ✓ |
| Founder-Market Fit score | — | — | ✓ | ✓ |
| Tamaño de mercado (TAM / SAM / SOM) | — | — | ✓ | ✓ |
| Señales de mercado (tendencias + funding reciente) | — | — | ✓ | ✓ |
| Kit de validación en 48 horas | — | — | ✓ | ✓ |
| Guión de entrevistas a clientes | — | — | ✓ | ✓ |
| Plan GTM — primeros 100 clientes | — | — | ✓ | ✓ |
| Modelos de ingreso alternativos | — | — | ✓ | ✓ |
| Checklist de riesgos legales (regulatorio chileno) | — | — | ✓ | ✓ |
| Carta de pitch para inversores | — | — | ✓ | ✓ |
| Gobernanza legal (SpA, vesting, Ley 21.719) | — | — | ✓ | ✓ |
| Fundraising roadmap (SAFE, fondos LatAm, Corfo) | — | — | ✓ | ✓ |
| Playbook de validación (JTBD + viability score) | — | — | ✓ | ✓ |
| Contenido para pitch deck (8 slides) | — | — | ✓ | ✓ |
| Plan de ejecución por sprints (lean roadmap) | — | — | ✓ | ✓ |
| Proyección financiera 12 meses | — | — | ✓ | ✓ |
| Roadmap de constitución y cumplimiento legal | — | — | ✓ | ✓ |

---

## 6. MODELO DE TIERS Y LÍMITES DE USO

### Límites Mensuales por Tier

| Tier | Análisis totales / mes | Análisis premium (mercado, competencia) / mes | Modelo IA |
|------|----------------------|---------------------------------------------|----------|
| **Free** | 3 | 0 (bloqueado) | Claude Haiku (menor costo) |
| **Basic** | 15 | 5 | Claude Sonnet |
| **Pro** | 50 | 50 | Claude Sonnet |
| **Premium** | 999 | 999 | Claude Sonnet |

Los análisis de competencia y tamaño de mercado consumen búsqueda web en tiempo real ($0.05–0.20 USD/consulta), de ahí la restricción en tiers bajos.

### Enforcement del Rate Limiting

El control existe en **dos capas independientes**:
1. **Cliente (frontend):** `useUserTier.ts` bloquea la UI antes de hacer la llamada
2. **Servidor (Edge Function):** `ai-validate` verifica JWT + tier + conteo mensual antes de ejecutar cualquier análisis

---

## 7. ARQUITECTURA DE DATOS

### Tabla principal: `validations`

Cada fila representa una sesión de validación completa:

```
id, user_id, status, validation_mode
idea_name, idea_description, idea_industry, current_solution
customer_segment, target_country, target_region
business_model, pricing_range, acquisition_channel
founder_context (JSON), tech_level
summary_json (resultado IA), validation_score (0–100)
generation_progress (JSON por task)
completed_at
```

### Tabla de interacciones: `ai_interactions`

Registra cada llamada a IA con: usuario, validación, tipo de prompt, datos de entrada, datos de salida, tokens usados, modelo, timestamp.

Permite auditoría completa de costos, calidad y uso por usuario.

---

## 8. SISTEMA DE CACHÉ (3 NIVELES)

Para optimizar costos y velocidad de respuesta:

| Nivel | Mecanismo | Propósito |
|-------|-----------|-----------|
| **localStorage** | Sesión del wizard en el navegador | El usuario puede cerrar y retomar sin perder datos |
| **Caché semántico (BD)** | Tabla `cached_analyses` — similarity > 92% | Si dos ideas similares ya fueron analizadas, reutiliza el resultado sin llamar a la IA |
| **Prompt caching (Anthropic)** | `cache_control: ephemeral` en system prompts | Reduce costos de tokens en ~70% en los system prompts que se repiten |

---

## 9. BENCHMARKS SECTORIALES INTEGRADOS

El sistema tiene benchmarks hardcodeados para 10 industrias, usados en el análisis de Unit Economics:

| Industria | CAC típico (USD) | LTV típico (USD) | Churn mensual | Margen bruto |
|-----------|-----------------|-----------------|---------------|-------------|
| SaaS B2B | $200 – $800 | $1.500 – $6.000 | 1–4% | 75% |
| Fintech | Variable | Variable | Variable | Variable |
| EdTech | Benchmarks activos | — | — | — |
| HealthTech | Benchmarks activos | — | — | — |
| E-commerce | Benchmarks activos | — | — | — |
| Marketplace | Benchmarks activos | — | — | — |

*Fuente de referencia: ChartMogul 2024 para SaaS. Datos similares para otras industrias.*

---

## 10. TELEMETRÍA Y MÉTRICAS DE PRODUCTO

El sistema registra los siguientes eventos de comportamiento:

| Evento | Qué mide |
|--------|----------|
| `wizard_step_completed` | Completación por paso, modalidad y tier |
| `wizard_abandoned` | Abandono con step, razón y tier |
| `micro_feedback` | Cómo validaban ideas antes de usar la plataforma |
| `validation_completed` | Validación exitosa con score, industria y tier |

**Anti-abandono implementado:** si el usuario intenta cerrar la pestaña, presionar "atrás" o scrollear bruscamente hacia arriba, aparece un dialog que captura la razón del abandono.

---

## 11. GAPS IDENTIFICADOS Y OPORTUNIDADES DE MEJORA

### Gaps Críticos (impacto directo en calidad del producto)

| Gap | Descripción | Impacto |
|-----|-------------|---------|
| **Datos de mercado simulados** | El tier Premium muestra datos de Reddit y Google Trends ficticios | Erosiona la propuesta de valor del tier más caro |
| **Paso Fundador muy corto** | Solo 4 campos — no captura equipo, roles previos ni tracción existente | El `founder_fit` score tiene poco contexto para ser preciso |
| **`acquisition_channel` sin uso** | Se captura pero no se inyecta en ningún prompt de IA | Oportunidad perdida de personalizar GTM y estrategia de clientes |
| **`current_solution` subutilizado** | Se captura pero casi no se usa en `competitive_analysis` | El análisis de incumbentes podría ser mucho más preciso |

### Oportunidades de Mejora UX

| Área | Situación actual | Propuesta |
|------|-----------------|-----------|
| **Flujo rápido (quick)** | Solo genera `summary` — calidad muy baja sin contexto de mercado | Forzar al menos 1 campo de ICP antes de generar |
| **Preview del score** | El score solo se ve al final | Mostrar mini-preview del breakdown estimado al terminar el Paso 3 para generar anticipación |
| **Recuperación de abandono** | El exit-intent solo trackea, no recupera | Capturar email antes del cierre y enviar "continúa tu análisis" por email |
| **Indicador de progreso en mobile** | No hay barra de progreso sticky en pantallas pequeñas | "Paso 2 de 4" visible en todo momento |
| **Región específica** | Campo libre sin mapear a regiones chilenas | Mapear a las 16 regiones de Chile para activar datos de BCCh en el análisis de mercado |

### Oportunidades de Negocio

| Oportunidad | Descripción | Esfuerzo |
|------------|-------------|---------|
| **Stripe + pagos reales** | El checkout está parcialmente implementado. Sin usuarios pagos no hay revenue. | Alto — prioridad 1 |
| **Emails transaccionales** | Edge function `followup-email` existe pero sin cron activo. El correo de recuperación a los 7 días puede mejorar conversión. | Medio |
| **Data Room PDF** | Exportar todos los análisis en un PDF investor-ready. Diferenciador vs. competencia. | Alto |
| **LinkedIn OAuth** | Enriquecer automáticamente el perfil del fundador con datos reales. Bloqueado hasta crear LinkedIn Company Page. | Bajo (una vez desbloqueado) |
| **Reddit + Google Trends reales** | Activar los datos de mercado reales en el tier Premium. Hoy son mock. | Alto — Sprint C del roadmap |

---

## 12. ECONOMÍA UNITARIA DEL PRODUCTO

| Concepto | Valor |
|----------|-------|
| Costo variable por reporte profundo (Pro) | ~$1.00 USD (tokens + infraestructura prorrateada) |
| Precio sugerido tier Basic | $9.990 CLP (~$11 USD) |
| Margen bruto estimado | > 90% |
| CAC objetivo | < $3.000 CLP vía Meta/LinkedIn Ads |
| LTV/CAC objetivo | > 3x (umbral venture-backable) |

---

## 13. ESTADO ACTUAL DEL PRODUCTO

| Componente | Estado |
|------------|--------|
| Wizard completo (4 pasos) | ✅ En producción |
| Score 5 dimensiones | ✅ En producción |
| 4 tiers con gates por sección | ✅ En producción |
| Rate limiting por tier | ✅ Implementado |
| Análisis competitivo (con web search) | ✅ En producción |
| TAM/SAM/SOM (con web search) | ✅ En producción |
| Gobernanza + Fundraising | ✅ Prompts implementados |
| Caché semántico | ✅ Activo |
| Telemetría (PostHog) | ✅ Activo |
| Stripe / pagos reales | ⚠️ Parcial — sin checkout activo |
| Reddit / Google Trends reales | ❌ Mock — datos ficticios |
| Emails transaccionales (Resend) | ❌ Edge Function lista, sin cron |
| Data Room export (PDF) | ❌ No implementado |
| LinkedIn OAuth | ❌ Bloqueado (sin Company Page) |

---

*Documento generado el 01/06/2026. Para consultas técnicas: equipo de ingeniería ValidateAI.*
