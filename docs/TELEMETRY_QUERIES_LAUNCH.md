# Telemetría de Lanzamiento — Queries para el Corte de Datos (18:00 CLT)

> Instrumental de medición del embudo Demo100. Vector #2 (Ingeniería de Datos).
> Ejecutar en consola SQL de Supabase + dashboards de PostHog.
> Fecha: 2026-06-12.

## Notas de uso (leer antes de correr)

- **Zona horaria:** Supabase guarda `created_at` en UTC. "Hoy CLT" ≠ "hoy UTC".
  Todas las queries usan un límite CLT-aware. Para "los últimos N días" reemplazar
  el filtro por `created_at >= now() - interval 'N days'`.
- **Cohortes (corrección clave):** el burn de tokens NO se atribuye a leads, sino a
  **usuarios activados**. Un lead de `/demo` cuesta $0 de cómputo (página estática).
  No mezclar `email_leads` (captura) con `ai_interactions` (gasto) en un mismo CAC.
- **Reconciliación PostHog ↔ Supabase:** PostHog (cliente) es vulnerable a adblockers
  y caídas de red; Supabase es el ground truth del servidor. Si no cuadran, hay leak.

```sql
-- Límite "inicio de hoy en horario de Chile" reutilizable en los WHERE de abajo.
-- (date_trunc en CLT y de vuelta a timestamptz UTC)
-- inicio_hoy_clt := date_trunc('day', now() AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago'
```

---

## Q1 · CAC de Identidad (ToFu) — confirmar costo $0

**Objetivo:** volumen de leads del soft-wall y prueba de que el ToFu no quema tokens.

```sql
-- Leads de /demo (soft-wall) capturados hoy. validation_id IS NULL = origen demo/anónimo.
SELECT
  count(*)                                            AS demo_leads_hoy,
  count(*) FILTER (WHERE validation_id IS NOT NULL)   AS leads_con_validacion
FROM public.email_leads
WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Santiago')
                    AT TIME ZONE 'America/Santiago';
```

**Prueba de costo $0 del ToFu** — los leads del demo NO generan `ai_interactions`
(la generación real solo ocurre en `/validate`, autenticado):

```sql
-- Interacciones de IA atribuibles a HOY. El demo no debe sumar aquí.
-- Si demo_leads_hoy crece y este número se mantiene bajo → ToFu confirmado a $0.
SELECT count(*) AS ai_calls_hoy
FROM public.ai_interactions
WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Santiago')
                    AT TIME ZONE 'America/Santiago';
```

**Reconciliación PostHog:** comparar `demo_leads_hoy` (SQL) vs. el conteo del evento
`demo_lead_captured` (PostHog, mismo rango).
- PostHog **<** SQL → adblockers comiendo eventos (subestimamos conversión).
- PostHog **>** SQL → **ALARMA**: la Edge Function no insertó el lead (capital perdido).

---

## Q2 · Activation Burn (MoFu) — el sangrado real

**Objetivo:** cuántos usuarios pasaron de captura a generar reporte, y cuánta caja quemó.

```sql
-- Validaciones completadas hoy (la métrica simple que pidió la Mesa).
SELECT
  count(*)                                       AS validaciones_completadas_hoy,
  count(*) FILTER (WHERE validation_mode='quick')    AS modo_quick,
  count(*) FILTER (WHERE validation_mode='detailed') AS modo_detailed
FROM public.validations
WHERE status = 'completed'
  AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/Santiago')
                    AT TIME ZONE 'America/Santiago';
```

**Burn real por modelo (preciso, desde `ai_interactions.tokens_used`):**

```sql
SELECT
  model,
  count(*)          AS llamadas,
  sum(tokens_used)  AS tokens_totales
FROM public.ai_interactions
WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Santiago')
                    AT TIME ZONE 'America/Santiago'
GROUP BY model
ORDER BY tokens_totales DESC;
```

**Estimación de costo en USD** (ajustar el pricing blended antes de correr — `tokens_used`
es combinado input+output, por eso se usa una tarifa mixta por millón de tokens):

```sql
WITH pricing(model, usd_por_mtok_blended) AS (
  VALUES
    ('claude-sonnet-4-20250514', 9.00),    -- AJUSTAR a pricing vigente (blended in/out)
    ('claude-haiku-4-5-20251001', 2.50),   -- AJUSTAR a pricing vigente (blended in/out)
    ('gpt-4o-mini',              0.40)     -- AJUSTAR (fallback OpenAI)
),
usage AS (
  SELECT model, sum(tokens_used) AS toks
  FROM public.ai_interactions
  WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Santiago')
                      AT TIME ZONE 'America/Santiago'
  GROUP BY model
)
SELECT
  u.model,
  u.toks                                                         AS tokens,
  round((u.toks / 1000000.0) * coalesce(p.usd_por_mtok_blended, 9.00), 4) AS burn_usd_estimado
FROM usage u
LEFT JOIN pricing p USING (model)
ORDER BY burn_usd_estimado DESC;
```

> **CAC orgánico real** = `Σ burn_usd_estimado` / (usuarios activados hoy). NO dividir
> por el total de leads — eso infla artificialmente el CAC mezclando cohortes $0.

---

## Q3 · Demanda BoFu (waitlist por tier) — solo PostHog

`email_leads` **no almacena el tier** (Scope Lock: sin columna nueva). El desglose por
plan vive únicamente en PostHog.

**Spec PostHog:**
- Evento: `checkout_waitlist_captured`
- Breakdown by: propiedad de evento `tier` (`basic` | `pro` | `premium`)
- Rango: hoy (CLT)
- Lectura: dónde está la mayor disposición de pago → prioriza ese tier el Día 1 post-Legal.

Sanity-check de volumen total en Supabase (sin desglose de tier):

```sql
-- Leads totales hoy (demo + waitlist). Cruzar el total contra
-- demo_lead_captured + checkout_waitlist_captured de PostHog.
SELECT count(*) AS leads_totales_hoy
FROM public.email_leads
WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Santiago')
                    AT TIME ZONE 'America/Santiago';
```

---

## Q4 · Atribución por campaña (UTM) — PostHog

Confirmar que el hook funciona y que el tagging del post llega a la telemetría.

**Spec PostHog:**
- Funnel: `demo_paywall_hit` → `demo_lead_captured`
- Breakdown by: `utm_campaign` (y/o `utm_source`)
- Verificar que la primera ola trae `utm_campaign = ltv_cac_benchmark`.
- ⚠️ Si los días 3–7 reusan el mismo `utm_campaign`, no se podrán comparar hooks
  (ver tabla de campañas sugeridas entregada a Ops).

---

## Umbrales de decisión (KPI Anchors)

| Métrica | Fórmula | Umbral | Acción si falla |
|---|---|---|---|
| Paywall Conversion (ToFu) | `demo_lead_captured / demo_paywall_hit` | ≥ 15% | UI débil o contenido base sin valor |
| Waitlist Conversion (BoFu) | `checkout_waitlist_captured / checkout_waitlist_hit` | ≈ 50% | Copy genera desconfianza |
| Reconciliación | PostHog vs Supabase | ±10% | >10% gap = leak de Edge Function o adblockers |
| Activation Burn | `Σ burn_usd` / usuarios activados | vigilar vs LTV | Si CAC > LTV → throttle (THROTTLE_MODE=on) |
