# PYMENGINE → ValidateAI — API de Integración B2G

**Para:** Equipo de desarrollo PYMENGINE  
**De:** Equipo ValidateAI  
**Fecha:** 2026-06-08  
**Prioridad:** Alta

---

## Contexto

ValidateAI es una plataforma de due diligence de startups chilenas. Cuando analizamos una empresa,
uno de los ángulos más valiosos es su posición en el mercado público: ¿vende al Estado?, ¿cuánto?,
¿cómo le está yendo comparado con el mercado?

PYMENGINE ya tiene esta inteligencia construida. Nosotros estamos intentando reconstruirla desde
cero llamando directamente a la API de Mercado Público, con todos los problemas que eso implica
(timeouts, rate limiting, sin historial agregado, sin buyer intelligence).

**La propuesta:** PYMENGINE expone dos endpoints. ValidateAI los consume como fuente de datos
verificada B2G. No duplicamos trabajo, compartimos inteligencia.

---

## Lo que necesitamos — resumen ejecutivo

| Tipo | Endpoint | Datos clave | Usa datos que ya tienen |
|------|----------|------------|------------------------|
| Por RUT | `GET /v1/proveedor/{rut}` | Compliance, win rate, buyer intelligence | ✅ Sí |
| Mercado general | `GET /v1/mercado/benchmarks` | Promedios sectoriales, tendencias | ✅ Sí (agregación) |
| Licitaciones activas | `GET /v1/mercado/activas` | Oportunidades abiertas por sector | ✅ Sí |

Los tres endpoints son **consultas de lectura** sobre datos que PYMENGINE ya tiene.
No requieren scraping nuevo ni cambios en la base de datos principal.

---

## Endpoint 1 — Inteligencia de proveedor por RUT

### Request

```
GET /v1/proveedor/{rut}
Authorization: Bearer <API_KEY_INTER_SISTEMA>
```

**Parámetros:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `rut` | `string` | RUT normalizado, con o sin puntos/guión. Ej: `76543210-K` |
| `periodo_meses` | `int?` | Ventana de análisis en meses. Default: `12`. Max: `24`. |

### Response esperado

```json
{
  "rut": "76543210-K",
  "nombre_empresa": "Servicios Técnicos SpA",
  "periodo_meses": 12,
  "calculado_al": "2026-06-08",

  "compliance": {
    "bloqueado": false,
    "deuda_previsional": false,
    "deuda_laboral": false,
    "deuda_fiscal_sobre_500utm": false,
    "notas": null
  },

  "actividad_licitaciones": {
    "licitaciones_participadas": 18,
    "licitaciones_ganadas": 5,
    "licitaciones_perdidas": 11,
    "licitaciones_en_proceso": 2,
    "win_rate_pct": 27.8,
    "monto_adjudicado_clp": 45000000,
    "ticket_promedio_clp": 9000000,
    "ticket_maximo_clp": 22000000
  },

  "buyer_intelligence": {
    "organismos_distintos": 4,
    "top_compradores": [
      { "nombre": "Hospital Regional de Rancagua", "monto_clp": 28000000, "pct_del_total": 62.2 },
      { "nombre": "Municipalidad de San Fernando",  "monto_clp": 12000000, "pct_del_total": 26.7 },
      { "nombre": "JUNAEB Región VI",               "monto_clp": 5000000,  "pct_del_total": 11.1 }
    ],
    "concentracion_top1_pct": 62.2,
    "sectores_activos": ["Salud", "Municipal", "Educación"]
  },

  "categorias": {
    "unspsc_principales": ["72100000", "81100000"],
    "region_principal": "VI"
  },

  "data_quality": {
    "tiene_ocs_reales": false,
    "fuente_montos": "licitaciones_adjudicadas",
    "advertencia": "Montos estimados desde licitaciones — OCs reales pendientes de sync"
  }
}
```

> **Nota sobre `data_quality`:** Entendemos que el sync de OCs está pendiente. El campo
> `data_quality.advertencia` nos permite mostrar esto al usuario sin que parezca un error.
> Cuando OCs funcionen, `tiene_ocs_reales` pasa a `true` y los montos son exactos.

### Comportamiento ante RUT no encontrado

```json
HTTP 404
{
  "error": "proveedor_no_registrado",
  "message": "RUT 76543210-K no tiene actividad en Mercado Público registrada en PYMENGINE",
  "rut": "76543210-K"
}
```

---

## Endpoint 2 — Benchmarks de mercado por sector

Este es el endpoint **más valioso para nosotros** porque permite a nuestro motor de IA
evaluar si los números de una empresa son buenos o malos *relativos al mercado*.
Sin esto, un win rate del 27% no significa nada.

### Request

```
GET /v1/mercado/benchmarks
Authorization: Bearer <API_KEY_INTER_SISTEMA>
```

**Parámetros (al menos uno requerido):**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sector` | `string?` | Sector normalizado: `Salud`, `Municipal`, `Educación`, `Defensa`, `Infraestructura`, `Vivienda`, `Justicia`, `Economía` |
| `unspsc` | `string?` | Código UNSPSC de 8 dígitos. Ej: `72100000` |
| `region` | `string?` | Código de región: `RM`, `VI`, `VIII`, etc. |
| `periodo_meses` | `int?` | Default: `12` |

### Response esperado

```json
{
  "sector": "Salud",
  "periodo_meses": 12,
  "calculado_al": "2026-06-08",

  "volumen": {
    "licitaciones_publicadas": 1240,
    "monto_total_clp": 48000000000,
    "tendencia_vs_periodo_anterior_pct": 14.3,
    "tipo_distribucion": {
      "LP": 8,
      "LE": 35,
      "LQ": 42,
      "L1": 12,
      "LD": 3
    }
  },

  "proveedores": {
    "activos_en_periodo": 312,
    "nuevos_en_periodo": 28,
    "win_rate_promedio_pct": 22.4,
    "win_rate_p25_pct": 8.1,
    "win_rate_p75_pct": 41.2,
    "concentracion_top5_pct": 68.2,
    "top_proveedores": [
      { "rut": "76000001-1", "nombre": "Proveedor A SpA", "monto_clp": 8200000000, "pct_mercado": 17.1 },
      { "rut": "76000002-2", "nombre": "Proveedor B Ltda", "monto_clp": 6100000000, "pct_mercado": 12.7 }
    ]
  },

  "contratos": {
    "ticket_promedio_clp": 9800000,
    "ticket_mediana_clp": 4500000,
    "ticket_p90_clp": 38000000,
    "ticket_maximo_clp": 420000000
  },

  "compradores": {
    "organismos_activos": 89,
    "top_compradores": [
      { "nombre": "CENABAST",              "monto_clp": 12000000000, "pct_del_sector": 25.0 },
      { "nombre": "Hospital Barros Luco",  "monto_clp": 3200000000,  "pct_del_sector": 6.7 }
    ]
  }
}
```

**Por qué necesitamos los percentiles (`p25`, `p75`):**
Nuestro modelo de IA evalúa si una empresa está en el cuartil bajo, medio o alto.
Un promedio solo no es suficiente — una empresa con 22% win rate en un mercado con p75=41%
está en el cuartil bajo, aunque coincida con el promedio.

---

## Endpoint 3 — Licitaciones activas por sector

Necesario para calcular **oportunidades no aprovechadas**: licitaciones abiertas en el rubro
de una empresa donde esa empresa no está participando.

### Request

```
GET /v1/mercado/activas
Authorization: Bearer <API_KEY_INTER_SISTEMA>
```

**Parámetros:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `sector` | `string?` | Igual que endpoint 2 |
| `unspsc` | `string?` | Código UNSPSC |
| `region` | `string?` | Región |
| `monto_min` | `int?` | Filtro de monto mínimo CLP |
| `cierre_desde_horas` | `int?` | Solo licitaciones que cierran en las próximas N horas. Default: `168` (7 días) |
| `limit` | `int?` | Default: `20`. Max: `100` |

### Response esperado

```json
{
  "sector": "Salud",
  "licitaciones_activas": 34,
  "consultado_al": "2026-06-08T14:00:00Z",

  "items": [
    {
      "codigo": "LP-001-2026-RM",
      "tipo": "LP",
      "nombre": "Servicio de mantención equipos hospitalarios",
      "organismo": "Hospital San Borja Arriarán",
      "monto_estimado_clp": 85000000,
      "fecha_cierre": "2026-06-15T17:00:00Z",
      "horas_para_cierre": 170,
      "region": "RM",
      "unspsc": ["72100000"]
    }
  ]
}
```

---

## Autenticación

Proponemos una **API key estática inter-sistema** compartida entre los dos backends.
No necesita OAuth — ambos son servicios internos nuestros.

```
Header: Authorization: Bearer pymengine_validateai_<hash>
```

ValidateAI llama desde una Edge Function de Supabase con la key en variables de entorno.
PYMENGINE valida en un middleware simple antes del router.

---

## Prioridad de implementación

Ordenado por impacto para ValidateAI y esfuerzo estimado para PYMENGINE:

| # | Endpoint | Impacto ValidateAI | Esfuerzo PYMENGINE | Depende de OCs |
|---|----------|-------------------|-------------------|----------------|
| 1 | `GET /v1/mercado/benchmarks` | 🔴 Crítico | Bajo — query de agregación | No |
| 2 | `GET /v1/proveedor/{rut}` | 🔴 Crítico | Bajo — datos ya existen | Parcial (montos aproximados) |
| 3 | `GET /v1/mercado/activas` | 🟡 Alto | Mínimo — ya tienen el feed | No |

**El endpoint más valioso es el #1 (benchmarks)** porque mejora el scoring de todas las startups,
no solo las que ya venden al Estado. PYMENGINE puede devolver datos sectoriales desde sus tablas
actuales con una query GROUP BY, sin scraping adicional.

---

## Cuando resuelvan el sync de OCs

Una vez que OCs funcione, nos interesa:

1. **Actualizar el Endpoint 1** — Los campos `monto_adjudicado_clp` y `ticket_*` pasan a ser
   exactos (basados en OCs reales, no en adjudicaciones de licitaciones).

2. **Webhook opcional** — Si una empresa que está en una validación activa de ValidateAI recibe
   o gana una OC, podemos recibir una notificación para actualizar su perfil de riesgo en tiempo real.
   No es urgente, pero es el paso natural siguiente.

---

## Lo que nosotros damos a cambio

Esto no es una petición unilateral:

- **RAG sobre normativa licitatoria** — nuestro knowledge base tiene información sobre Ley 19.886,
  Ley 21.634, reglamentos de compra. PYMENGINE puede consultarlo vía nuestro endpoint
  `POST /api/v1/rag/query` para enriquecer el análisis de compliance o la generación de ofertas.

- **Founder + empresa score** — cuando un usuario de PYMENGINE valide su startup en ValidateAI,
  podemos compartir el score de due diligence vía webhook, que podría usar para personalizar
  las recomendaciones de licitaciones (ej: no mostrar LP > 5000 UTM a una empresa con score bajo
  en "capacidad operativa").

- **Cross-referral** — si ValidateAI detecta que una startup tiene potencial B2G, la derivamos
  activamente a PYMENGINE.

---

## Preguntas abiertas para coordinar

1. ¿Tienen los sectores (`Salud`, `Municipal`, etc.) como campo en sus tablas, o solo UNSPSC?
   Si solo tienen UNSPSC, ¿podemos usar la misma tabla de clasificación que usamos nosotros?

2. ¿El `buyer_intelligence` de 365 perfiles es por organismo comprador o por proveedor?
   Necesitamos saber la granularidad para mapear correctamente.

3. Para el Endpoint 1, ¿el win rate está calculado sobre licitaciones adjudicadas en `opportunity_pipeline`
   o hay otra fuente? Necesitamos entender si excluye Trato Directo (tipo LD) o lo incluye.

4. ¿Manejan multi-tenant? ¿Los datos de `supplier_profiles` son por usuario de PYMENGINE
   o son datos públicos del mercado? (Para el Endpoint 1, necesitamos el dato de mercado,
   no el perfil privado de un usuario de PYMENGINE).

---

## Contacto y repo

- **Slack/Discord:** coordinar canal compartido
- **Repo ValidateAI:** el código de integración irá en `validateai/supabase/functions/pymengine-fetch/`
- **Env var que agregaremos:** `PYMENGINE_API_KEY` + `PYMENGINE_BASE_URL`
