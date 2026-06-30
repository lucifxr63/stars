# Validus — Modelo de Pricing y Cálculo de Precio de Venta

> **Estado:** borrador de trabajo (a resolver a futuro).
> **Propósito:** dejar un método reproducible para fijar el precio de venta correcto de cada plan, en vez de números heredados.
> **No es:** una decisión cerrada. Es la plantilla + las fórmulas para llegar a ella con datos reales.
> **Última actualización:** 2026-06-29.

---

## 0. Por qué existe este documento

Durante la Fase 2 detectamos que Validus tenía **dos fuentes de precio desalineadas**:

- `src/app/routes/Landing.tsx` (bloque `#pricing`) → antes en **USD** ($0 / $19 / $49 / $149).
- `src/app/routes/Pricing.tsx` (página `/pricing`) → en **CLP** ($0 / $9.990 / $20.000 / $50.000).

Se unificó todo a **CLP** (decisión de negocio tomada), pero los números actuales son **heredados/sugeridos**, no derivados de un modelo de costos. Este doc fija el método para validarlos o corregirlos.

**Inconsistencia abierta pendiente:** `/pricing` dice "Ideas y pivotes ilimitados" en Pro, pero el límite técnico real es **50/mes** (ver `src/lib/tierLimits.ts`). Hay que decidir cuál es el real (ver §7).

---

## 1. Estado actual (fuentes de verdad en código)

### 1.1 Precios vigentes (CLP/mes)

| Plan | Precio | Fuente |
|------|--------|--------|
| Free | $0 | `Pricing.tsx` · `Landing.tsx` |
| Basic | $9.990 | `Pricing.tsx` · `Landing.tsx` |
| Pro | $20.000 | `Pricing.tsx` · `Landing.tsx` |
| Premium | $50.000 | `Pricing.tsx` · `Landing.tsx` |

### 1.2 Cuotas reales por tier (límite técnico)

Fuente canónica: `src/lib/tierLimits.ts` (espejo de la RPC `tier_limit()` en `supabase/migrations/20260624000000_tier_limits_single_source.sql`).

| Plan | Validaciones totales/mes | De las cuales "costosas"/mes |
|------|--------------------------|------------------------------|
| Free | 3 | 0 |
| Basic | 15 | 5 |
| Pro | 50 | 50 |
| Premium | 999 (uso ampliado) | 999 |

> **"Costosa"** = validación/prompt que usa `web_search` o APIs externas (ej. `market_sizing`, `premium-validate` con Reddit/Trends/SerpApi). Ver comentario en `src/components/wizard/StepGenerating.tsx` y la RPC `check_and_increment_usage` (`supabase/migrations/20260603_usage_counters.sql`). Son las que más tokens/costo consumen.

### 1.3 Cobro

- Pasarela: **LemonSqueezy** (actualmente DORMANTE; las compras redirigen a waitlist Early Bird — ver `Pricing.tsx`).
- Implicación: hoy **no hay ingresos reales** → todas las métricas de venta son proyecciones.

---

## 2. Estructura de costos (COGS por validación)

El costo de servir **una** validación es la suma de:

```
COGS_validación =
    costo_tokens_LLM            (input + output, por prompt type)
  + costo_web_search / APIs     (solo en prompts "costosos")
  + costo_render_PDF            (si exporta)
  + infra_prorrateada          (Supabase, Vercel, almacenamiento)
```

Y el costo de servir **una suscripción/mes** depende del **uso real** dentro de la cuota:

```
COGS_suscripción_mes =
    Σ (validaciones_baratas  × COGS_barata)
  + Σ (validaciones_costosas × COGS_costosa)
  + comisión_pasarela         (LemonSqueezy: % + fijo por transacción)
  + impuestos_no_recuperables (ver §5)
```

### 2.1 Variables a MEDIR (no asumir)

Rellenar con datos reales de PostHog + facturación Anthropic/SerpApi/Supabase:

| Variable | Símbolo | Valor (medir) | Fuente de medición |
|----------|---------|---------------|--------------------|
| Costo medio tokens por prompt barato | `c_barata` | _por medir_ | Facturación Anthropic / logs `ai_interactions` |
| Costo medio por prompt costoso (tokens + web_search/SerpApi) | `c_costosa` | _por medir_ | Anthropic + SerpApi |
| Costo render + almacenamiento PDF | `c_pdf` | _por medir_ | Supabase storage / Vercel |
| Infra prorrateada por validación | `c_infra` | _por medir_ | Supabase + Vercel ÷ nº validaciones/mes |
| Comisión LemonSqueezy | `f_pasarela` | ~5% + ~US$0,50 (verificar plan) | Contrato LS |
| Tipo de cambio CLP/USD | `fx` | _del mes_ | Banco Central |

### 2.2 Cifra de referencia documentada (asunción previa, **a validar**)

De notas internas (`CLAUDE.md`): **COGS ≈ US$1,00 por reporte profundo** (tokens + PDF + infra prorrateada). Tratar como **estimación**, no como dato medido, hasta confirmar con facturación real.

---

## 3. Fórmula del precio de venta correcto

Dos enfoques; usar el **mayor** de ambos como piso, y el valor percibido como techo.

### 3.1 Piso por costo + margen objetivo (cost-plus)

```
Precio_piso = COGS_peor_caso_mes / (1 − margen_bruto_objetivo)
```

- `margen_bruto_objetivo`: definir (SaaS sano ≈ 80–90%).
- `COGS_peor_caso_mes`: usuario que **agota toda su cuota** (máximo abuso), para no perder dinero con power users.

**Peor caso por tier** (usar cuotas de §1.2):

```
COGS_peor_caso(Basic)   = (15−5)·c_barata + 5·c_costosa  + c_pdf·15 + c_infra·15 + f_pasarela
COGS_peor_caso(Pro)     = 0·c_barata     + 50·c_costosa  + c_pdf·50 + c_infra·50 + f_pasarela
COGS_peor_caso(Premium) = ... (cuota 999 → acotar con uso real esperado, no el límite nominal)
```

> ⚠️ Premium tiene cuota 999 (≈ ilimitado). El peor caso nominal es enorme; usar el **P95 de uso real esperado**, no 999, o el plan sangra. Esto refuerza la decisión de §7.

### 3.2 Techo por valor (value-based)

Validus reemplaza horas de consultoría / análisis de un VC. Anclar contra:

- Costo de un análisis equivalente hecho por consultor (referencia de mercado CL/LatAm).
- Disposición a pagar del segmento (founders vs aceleradoras vs fondos — ver `#casos-de-uso` en la landing).

### 3.3 Precio final

```
Precio_lista = clamp(Precio_piso, Precio_valor_min, Precio_valor_max)
```

Y **mostrar con/sin IVA** de forma consistente (ver §5).

---

## 4. Worksheet (rellenar y recalcular)

| Concepto | Free | Basic | Pro | Premium |
|----------|------|-------|-----|---------|
| Cuota total/mes | 3 | 15 | 50 | 999* |
| Cuota costosa/mes | 0 | 5 | 50 | 999* |
| `c_barata` (US$) | | | | |
| `c_costosa` (US$) | | | | |
| `c_pdf` (US$) | | | | |
| `c_infra` (US$) | | | | |
| **COGS peor caso/mes (US$)** | | | | |
| Comisión pasarela (US$) | — | | | |
| **COGS total/mes (US$)** | | | | |
| Margen objetivo (%) | — | | | |
| **Precio piso (US$)** | — | | | |
| Precio piso (CLP, ×fx) | — | | | |
| **Precio lista actual (CLP)** | $0 | $9.990 | $20.000 | $50.000 |
| Margen bruto real (%) | — | | | |

`*` Premium: sustituir 999 por P95 de uso real.

---

## 5. Impuestos, moneda y display

- **IVA Chile 19%:** decidir si los precios mostrados son **IVA incluido** o **+ IVA**. Afecta margen y cumplimiento (boleta/factura).
- **Moneda de display:** decisión tomada = **CLP** (landing + `/pricing` + JSON-LD `index.html` unificados). Si se vende a LatAm fuera de Chile, evaluar mostrar USD o multi-moneda.
- **FX:** si los costos (Anthropic, SerpApi) son en USD y se cobra en CLP, el margen flota con el tipo de cambio. Fijar un colchón (ej. recalcular precio si CLP/USD se mueve >X%).

---

## 6. Métricas de venta (para validar viabilidad)

| Métrica | Objetivo (de notas internas, validar) | Cómo medir |
|---------|---------------------------------------|------------|
| Margen bruto | > 80–90% | Worksheet §4 |
| CAC | < $3.000 CLP (ads segmentados Meta/LinkedIn) | PostHog + gasto ads |
| LTV/CAC | > 3× | LTV = ARPU × meses retención |
| Payback CAC | < X meses | CAC ÷ (precio × margen) |
| Churn mensual | _por medir_ | Cohortes en Supabase |
| Conversión Free→Basic | _por medir_ | PostHog `paywall_hit` → checkout |

> Todas requieren **ingresos reales** (hoy en waitlist). Hasta entonces son hipótesis.

---

## 7. Decisiones abiertas (resolver antes de fijar precios definitivos)

1. **Pro: ¿50/mes o ilimitado?** `/pricing` dice "ilimitado"; `tierLimits.ts` dice 50. Alinear copy ↔ límite técnico. Si es ilimitado de verdad, recalcular peor caso de COGS (riesgo de margen).
2. **Premium peor caso:** acotar la cuota nominal de 999 a un límite operativo o a P95 de uso, o el plan no es rentable bajo abuso.
3. **IVA incluido vs + IVA** en el precio mostrado.
4. **Validar el COGS ≈ US$1** con facturación real (Anthropic + SerpApi + Supabase del mes).
5. **Comisión real de LemonSqueezy** según plan contratado.
6. **¿Anual con descuento?** (mejora payback y reduce churn).
7. **Early Bird:** definir si el precio de lanzamiento es promocional y cuál es el precio "lista" posterior.

---

## 8. Checklist de acción

- [ ] Exportar facturación de 1 mes (Anthropic, SerpApi, Supabase, Vercel) y calcular `c_barata`, `c_costosa`, `c_pdf`, `c_infra`.
- [ ] Confirmar comisión real LemonSqueezy.
- [ ] Rellenar worksheet §4 y obtener precio piso por tier.
- [ ] Resolver decisiones §7 (sobre todo Pro 50 vs ilimitado).
- [ ] Definir margen objetivo y política IVA.
- [ ] Comparar precio piso vs precio lista actual; ajustar `Pricing.tsx` + `Landing.tsx` + JSON-LD `index.html` **en los tres lugares a la vez** (son las 3 superficies de precio).
- [ ] Documentar el precio final y la fecha de revisión.

---

## 9. Dónde tocar si cambian los precios (3 superficies a sincronizar)

1. `src/app/routes/Pricing.tsx` → `PLANS[]` (precio + features detalladas).
2. `src/app/routes/Landing.tsx` → array del bloque `#pricing` (precio + features) **y** la sección `#entregables` (badges de tier).
3. `index.html` → JSON-LD `offers[]`, respuesta FAQ y `<noscript>` (precios para SEO/AEO).

> Mantener las tres coherentes es obligatorio: la incoherencia que originó este doc nació de actualizar solo una.
