# Validus — Modelo de Negocio

> **Estado:** Borrador inicial · 2026-06-29
> **Etapa:** Pre-revenue. No hay MRR, ARR, clientes pagos ni métricas SaaS medidas. Las cifras de costo/margen marcadas *(estimado)* son proyecciones a validar.

## Modelo

SaaS **freemium por tiers**, suscripción mensual en **CLP**. El plan gratuito permite explorar; los planes pagados escalan en **cuota mensual de validaciones** y en **profundidad de los entregables** (datos macro, unit economics, gobernanza, due diligence, API).

Tesis de pricing: no se cobra por "generar texto", sino por la **profundidad del motor de análisis** y el **acceso a inteligencia de mercado**. La cuota escala desde el fundador individual hasta aceleradoras/fondos.

## Planes actuales

> Fuente canónica de precios: `validateai/src/app/routes/Pricing.tsx` (CLP). Cuotas: `validateai/src/lib/tierLimits.ts`.
> Nota: la unificación de la moneda en la landing (a CLP) está en un PR pendiente de merge; la página `/pricing` ya está en CLP.

| Plan | Precio (CLP/mes) | Validaciones/mes | Análisis "costosos"/mes | Entregables clave |
|------|------------------|------------------|--------------------------|-------------------|
| Free | $0 | 3 | 0 | Score 0–100, resumen ejecutivo, competidores básico, PDF estándar |
| Basic | $9.990 | 15 | 5 | Score detallado 5D, análisis de mercado (TAM/SAM/SOM) |
| Pro | $20.000 | 50 | 50 | Unit economics, gobernanza/cap table/fundraising, founder fit, PDF investor-ready |
| Premium | $50.000 | 999 (ampliado) | 999 | Due diligence (SII+INAPI+CMF), data room PDF, API |

> Pendiente: resolver inconsistencia entre el copy comercial "Pro ilimitado" (página `/pricing`) y el límite técnico real de **50 validaciones/mes** (`tierLimits.ts`). No cambiar precios ni lógica en esta fase; solo documentar.

> "Análisis costoso" = prompt que usa búsqueda web / APIs externas (mayor costo de cómputo). Metered por separado.

## Fuentes de ingreso

- **Suscripciones** (núcleo): planes mensuales Free→Premium.
- **API / RaaS** (potencial): acceso programático en el tramo alto (Premium).
- **B2B / institucional** (potencial): licencias para aceleradoras, incubadoras, programas públicos y equipos de innovación que evalúan portafolios de proyectos.

> Pendiente: definir packaging y pricing del canal B2B/institucional (por asiento, por cohorte, por volumen).

## Unit economics (estimados, a validar)

> Todas las cifras siguientes son *(estimadas)* a partir de notas internas y **no** están validadas con facturación real.

- **COGS por reporte profundo:** ~US$1 *(estimado)* — tokens de IA + render PDF + infra prorrateada.
- **Margen bruto objetivo:** alto (>80–90%) *(estimado)*, típico de SaaS de IA con costo variable bajo.
- **CAC objetivo:** < $3.000 CLP *(objetivo)* vía ads segmentados (Meta/LinkedIn) y canales orgánicos.
- **LTV/CAC objetivo:** > 3× *(objetivo)*.

La metodología para derivar el precio de venta correcto (COGS real, peor caso por cuota, margen, IVA, FX) está documentada aparte como modelo de pricing del producto.

## Costos principales

- **IA (Anthropic):** costo variable por validación (input/output de tokens).
- **Datos externos:** búsqueda web / APIs (p. ej. SerpApi) en análisis "costosos".
- **Infraestructura:** Supabase (DB/Edge/Storage) + Vercel (hosting/CDN).
- **Pasarela de pago:** comisión de LemonSqueezy (cuando se reactive el cobro).
- **Adquisición:** ads + contenido (variable, según GTM).

> Pendiente: medir cada componente con facturación real de un mes y completar el worksheet del modelo de pricing.

## Segmentos B2B potenciales

- Aceleradoras e incubadoras (diagnóstico estandarizado de cohortes).
- Programas públicos de fomento (evaluación de postulaciones).
- Equipos de innovación corporativa / corporate venturing.
- Fondos pequeños / scouts (pre-screening de deal flow).

## Riesgos comerciales

- **Pre-revenue:** disposición a pagar y conversión free→pago **no validadas**.
- **Cobro en pausa:** la pasarela (LemonSqueezy) está dormante; hoy se capta **waitlist Early Bird** en lugar de cobrar.
- **Dependencia de costo de IA:** márgenes sensibles al costo de tokens y al tipo de cambio CLP/USD.
- **Educación de mercado:** explicar por qué Validus no es "otro chatbot".

## Métricas pendientes de medir

> Ninguna de estas existe aún con datos reales (pre-revenue):
- MRR / ARR, ARPU, churn, retención por cohorte.
- Conversión free→Basic/Pro, activación (wizard completado), tiempo a primer dossier.
- CAC, LTV, payback reales.
