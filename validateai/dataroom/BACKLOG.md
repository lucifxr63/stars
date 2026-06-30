# Validus — Backlog priorizado de follow-ups

> **Estado:** Borrador inicial · 2026-06-30
> **Propósito:** ordenar los follow-ups abiertos tras la Fase 12 por **impacto / esfuerzo / dependencias**, para decidir la secuencia de las próximas fases. Este documento NO reemplaza los planes de detalle (enlazados abajo); es el índice de decisión.

## Contexto

Validus está **pre-revenue** con captación vía waitlist Early Bird. El código de cobro está **test-ready** (Fase 12) y la instrumentación de analítica existe pero **no emite en producción** (sin `VITE_POSTHOG_KEY`). Los follow-ups se agrupan en dos naturalezas:

- **Ops / configuración** — no requieren código; requieren credenciales reales en dashboards externos (LemonSqueezy, PostHog, Vercel, Supabase). Yo no los puedo ejecutar; entrego runbooks.
- **Fases de código** — features implementables con su propia rama → PR.

---

## Tabla de priorización

| # | Follow-up | Tipo | Impacto | Esfuerzo | Depende de | Bloquea a |
|---|---|---|---|---|---|---|
| 1 | **Activar cobro LemonSqueezy** (secrets + variants + flag + prueba test) | Ops | 🟢 Alto | 🟢 Bajo | Cuenta LS + secrets Supabase | Medir conversión real, MRR |
| 2 | **`VITE_POSTHOG_KEY` en staging/prod** | Ops | 🟢 Alto | 🟢 Bajo | Proyecto PostHog + Vercel | Embudo real, validar eventos #1 |
| 4 | **Captura de lead enriquecida** (plan/fuente/segmento en BD) | Código | 🟡 Medio | 🟢 Bajo | — | GTM data-driven sobre waitlist |
| 3 | **Generación async real** (premium: worker + polling + estado `partial`) | Código | 🟡 Medio | 🔴 Alto | — | Robustez en prompts largos / escala |
| 6 | **Trust Layer en export PDF** + unificar estilo de cards | Código | 🟡 Medio | 🟡 Medio | — | Dossier investor-ready consistente |
| 5 | **Limpieza schema `profiles.stripe_*`** (migración) | BD | ⚪ Bajo | 🟢 Bajo | Nada en uso | Higiene del schema |

> Leyenda impacto: 🟢 mueve la aguja comercial · 🟡 mejora producto/calidad · ⚪ higiene técnica.

---

## Secuencia recomendada

El orden no es por número sino por **desbloqueo de valor con mínimo esfuerzo**:

**Etapa A — Encender la medición y el cobro (ops, bajo esfuerzo, alto impacto)**
1. **#2 PostHog primero** — sin analítica viva no podemos verificar que los eventos de checkout (#1) funcionan ni medir el embudo. Es el prerequisito de observabilidad.
2. **#1 LemonSqueezy en modo test** — con PostHog activo, validar el flujo `checkout_started → checkout_success_viewed` y el webhook → `profiles.tier`. Recién entonces pasar a `live`.

→ *Ambos son configuración; entrego un runbook único con checklists copy-paste. La barrera es disponer de las credenciales, no el trabajo.*

**Etapa B — Aprovechar el tráfico que ya llega (código, bajo esfuerzo)**
3. **#4 Lead enriquecido** — barato y complementa #1/#2: capturar plan/fuente/segmento de cada lead de waitlist da materia prima de GTM aunque el cobro siga off. Buen primer PR de código.

**Etapa C — Calidad del producto (código, esfuerzo medio/alto)**
4. **#6 Trust Layer en PDF** — sube la calidad del entregable que se enseña a inversores/pilotos; esfuerzo acotado.
5. **#3 Generación async real** — el más costoso; justificado cuando haya volumen real (pilotos activos) que estrese prompts largos. No bloquear las etapas anteriores con esto.

**Etapa D — Higiene (oportunista)**
6. **#5 Limpieza `stripe_*`** — hacer junto a cualquier otra migración para no gastar un ciclo de deploy solo en esto. Cero urgencia (columnas legacy inertes).

---

## Notas por follow-up

- **#1 / #2 (ops):** no activan cobros ni exponen secrets por sí solos. Plan de detalle: [docs/LEMONSQUEEZY_ACTIVATION_PLAN.md](../docs/LEMONSQUEEZY_ACTIVATION_PLAN.md). Rollback de cobro = `VITE_CHECKOUT_ENABLED=false` + re-deploy.
- **#3 (async):** plan de detalle existente en [docs/ASYNC_GENERATION_PLAN.md](../docs/ASYNC_GENERATION_PLAN.md). No-premium ya corre en background; el alcance pendiente es el camino premium (worker + estado `partial` en BD). Riesgo: toca el flujo de generación → requiere plan aprobado antes de codear (Protocolo de Desarrollo Proactivo).
- **#4 (lead):** ampliar el payload de waitlist y su tabla; respetar el denylist PII de `src/lib/analytics.ts` y Ley 21.719. Esfuerzo bajo, sin tocar el score ni los prompts.
- **#5 (schema):** columnas `profiles.stripe_customer_id` / `stripe_subscription_id` son legacy del proveedor de pago anterior; no las usa ningún código vivo (el cobro actual es LemonSqueezy). Aplicar vía `supabase db query --linked --file` (historial remoto no trackeado → evitar `db push`).
- **#6 (PDF):** el Trust Layer ya es presentacional en la UI; el gap es portarlo al export PDF y unificar el estilo de cards entre secciones. Sin cambios de datos.

---

## Dependencias transversales

- **Medición real** (#2) condiciona la validación de **cobro** (#1), y ambos condicionan toda métrica SaaS (conversión, MRR, CAC, LTV).
- Las fases de código (#3, #4, #6) son **independientes entre sí** y pueden intercalarse según disponibilidad.
- Ningún follow-up debe modificar el **score de 5 dimensiones** ni los **prompts** (DNA del producto).
