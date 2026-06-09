# PYMENGINE → ValidateAI — Respuesta a preguntas técnicas

**Fecha:** 2026-06-08  
**Contexto:** Respuesta al análisis del codebase de PYMENGINE

---

## Resumen ejecutivo antes de responder

Su análisis revela algo mejor de lo esperado: **tienen OCs reales en `purchase_orders`**.
Eso cambia el diseño de los endpoints — los montos y buyer intelligence son datos reales,
no estimados desde adjudicaciones de licitaciones. Arranquemos desde ahí.

---

## Respuestas a las 4 preguntas

---

### Q1 — Taxonomía de sectores

**Respuesta: el filtro vive en ValidateAI, no en PYMENGINE.**

No construyan una tabla de mapeo. Añade complejidad innecesaria a su lado.

El razonamiento: "sector" en Chile no es un campo en la API de Mercado Público — es una
inferencia a partir del nombre del organismo comprador. Nosotros ya tenemos esa inferencia
construida. PYMENGINE solo necesita exponer el campo `buyer_org_name` (u equivalente)
en los responses, y nosotros lo clasificamos en nuestro lado.

**Para los benchmarks (`/v1/mercado/benchmarks`)**, el parámetro `sector` que pedimos
en el doc original lo reemplazamos por:

```
GET /v1/mercado/benchmarks?unspsc=721&region=RM
```

Solo `unspsc` (prefijo de código) + `region` como filtros nativos de PYMENGINE.
Nosotros mapeamos sector → lista de UNSPSC antes de llamar.

Si quieren agregar el filtro por nombre de organismo como conveniencia, el parámetro
sería `buyer_keyword=hospital` y ustedes hacen `buyer_org_name ILIKE '%hospital%'`.
Pero no es blocker.

---

### Q2 — `licitaciones_participadas`

**Respuesta: expongan lo que tienen, no intenten aproximar.**

No extraigan del `raw_payload_json` — es frágil y el dato puede no estar en todos los registros.

El campo `licitaciones_participadas` en nuestra spec era un error de diseño de nuestra parte.
Asumimos que PYMENGINE rastrea todos los oferentes. No lo hace, y tiene sentido: lo que importa
es quién gana, no quién participa.

**El reemplazo que funciona mejor:**

```json
"actividad_ocs": {
  "ocs_ganadas_12m": 14,
  "monto_total_adjudicado_clp": 45000000,
  "ticket_promedio_clp": 3214285,
  "ticket_maximo_clp": 12000000,
  "compradores_distintos": 4
}
```

Con esto nuestro motor calcula:
- **Tracción real** → monto adjudicado 12m (verificado, no auto-declarado)
- **Escala operativa** → ticket máximo (¿puede ejecutar contratos grandes?)
- **Diversificación** → compradores distintos

El "win rate" lo omitimos del Endpoint 1 o lo marcamos `null` con nota `"requiere datos de participación"`.
No es un problema — tenemos otras señales más directas desde las OCs.

---

### Q3 — Compliance de RUTs externos

**Respuesta: devuelvan `null`, nosotros lo resolvemos por otro lado.**

```json
"compliance": {
  "bloqueado": null,
  "notas": "compliance solo disponible para proveedores registrados en PYMENGINE",
  "fuente": null
}
```

No integren ChileProveedores ni ninguna fuente externa para esto. Es una deuda técnica
que cada sistema debería resolver por separado — no la compartan.

ValidateAI tiene integración con SII que cubre parte del compliance tributario.
Para compliance previsional/laboral arbitrario, lo agregaremos a nuestra lista de integraciones
pendientes independientemente de esta integración.

Lo que sí nos es valioso y sí tienen: **si el RUT pertenece a un usuario de PYMENGINE**,
el campo `is_pymengine_user: true` en el response nos indica que hay datos de compliance
más completos disponibles (aunque no los expongan). Eso solo, ya nos ayuda.

---

### Q4 — ¿Por dónde arrancar?

**Respuesta: Endpoint 2 (benchmarks) primero, no el 3.**

El Endpoint 3 (activas) es el más fácil pero el que menos valor entrega a corto plazo.
El Endpoint 2 (benchmarks) es el que desbloquea el motor de scoring de ValidateAI
para **todas** las startups que analizamos, no solo las que ya venden al Estado.

**Orden recomendado:**

```
Semana 1:  GET /v1/mercado/benchmarks  ← esto
Semana 1:  GET /v1/mercado/activas     ← esto (casi gratis si ya están en el mismo sprint)
Semana 2:  GET /v1/proveedor/{rut}     ← esto cuando los dos primeros estén testeados
```

Los tres primeros días de Semana 1 deberían ser:
1. Módulo `/v1/` con middleware de API key → 1 día
2. Query de benchmarks con `percentile_cont()` → 1 día
3. Query de activas (básicamente un SELECT con filtros) → medio día

---

## Schema revisado de los endpoints

### Endpoint 1 revisado — `/v1/proveedor/{rut}`

Basado en lo que PYMENGINE realmente tiene en `purchase_orders`:

```json
{
  "rut": "76543210-K",
  "nombre_empresa": "Servicios Técnicos SpA",
  "es_usuario_pymengine": false,
  "periodo_meses": 12,
  "calculado_al": "2026-06-08",

  "compliance": {
    "bloqueado": null,
    "notas": "solo disponible para usuarios registrados en PYMENGINE",
    "fuente": null
  },

  "actividad_ocs": {
    "ocs_ganadas_12m": 14,
    "monto_total_adjudicado_clp": 45000000,
    "ticket_promedio_clp": 3214285,
    "ticket_maximo_clp": 12000000,
    "compradores_distintos": 4
  },

  "buyer_intelligence": {
    "top_compradores": [
      {
        "codigo_organismo": "H-001",
        "nombre_organismo": "Hospital Regional de Rancagua",
        "ocs_count": 8,
        "monto_clp": 28000000,
        "pct_del_total": 62.2,
        "reputacion_pago": "buena"
      }
    ],
    "concentracion_top1_pct": 62.2
  },

  "categorias": {
    "unspsc_principales": ["72100000", "81100000"],
    "region_principal": "VI"
  },

  "data_quality": {
    "fuente_montos": "purchase_orders",
    "tiene_ocs_reales": true,
    "win_rate_disponible": false,
    "advertencia": null
  }
}
```

### Endpoint 2 revisado — `/v1/mercado/benchmarks`

```
GET /v1/mercado/benchmarks?unspsc=721&region=RM&periodo_meses=12
```

```json
{
  "filtros": { "unspsc_prefix": "721", "region": "RM", "periodo_meses": 12 },
  "calculado_al": "2026-06-08",

  "volumen": {
    "licitaciones_publicadas": 1240,
    "monto_total_ocs_clp": 48000000000,
    "tendencia_vs_periodo_anterior_pct": 14.3
  },

  "proveedores": {
    "activos_en_periodo": 312,
    "monto_p25_clp": 1200000,
    "monto_mediana_clp": 4500000,
    "monto_p75_clp": 18000000,
    "concentracion_top5_pct": 68.2
  },

  "contratos": {
    "ticket_promedio_clp": 9800000,
    "ticket_mediana_clp": 4500000,
    "ticket_p90_clp": 38000000
  },

  "top_compradores": [
    { "nombre": "CENABAST", "monto_clp": 12000000000, "pct_del_total": 25.0 }
  ]
}
```

> Nota: los percentiles son sobre el **monto total adjudicado por proveedor** en el periodo,
> no por contrato individual. Así podemos comparar "¿está esta empresa en el cuartil bajo del
> mercado?" de forma directa.

### Endpoint 3 revisado — `/v1/mercado/activas`

Sin cambios respecto al doc original — es el más sencillo.

---

## SQL de referencia para los percentiles

Si ayuda para arrancar más rápido, la query de benchmarks en PostgreSQL se ve así:

```sql
SELECT
  COUNT(DISTINCT supplier_code)                              AS proveedores_activos,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY monto_proveedor) AS monto_p25,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY monto_proveedor) AS monto_mediana,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY monto_proveedor) AS monto_p75,
  AVG(monto_proveedor)                                       AS monto_promedio
FROM (
  SELECT
    supplier_code,
    SUM(total) AS monto_proveedor
  FROM purchase_orders po
  JOIN opportunities o ON po.opportunity_id = o.id   -- ajustar según schema real
  WHERE
    po.created_at >= NOW() - INTERVAL '12 months'
    AND (o.category_code LIKE '721%' OR :unspsc_prefix IS NULL)
    AND (o.region_code = :region          OR :region IS NULL)
  GROUP BY supplier_code
) sub
```

Ajustar los nombres de tabla/columna según su schema real. Si `purchase_orders` no tiene
foreign key directa a `opportunities`, el JOIN puede ir por `buyer_org_code` + fecha.

---

## Autenticación — propuesta concreta

API key estática en header, validada con un middleware antes del router:

```typescript
// middleware/apiKeyAuth.ts
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] ?? req.headers['authorization']?.replace('Bearer ', '');
  if (key !== process.env.VALIDATEAI_API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
```

ValidateAI configura `PYMENGINE_API_KEY` y `PYMENGINE_BASE_URL` en sus Edge Functions.
PYMENGINE configura `VALIDATEAI_API_KEY` en su `.env`.

No necesitan Supabase JWT ni ningún sistema de tokens rotativos — esto es comunicación
server-to-server entre sistemas que controlamos nosotros.

---

## Una sola cosa crítica antes de arrancar

**Necesitamos saber el nombre exacto de las columnas de `purchase_orders`
que corresponden a:**

1. RUT del proveedor → `supplier_code`? ¿Es el RUT o un ID interno?
2. Nombre del organismo comprador → `buyer_org_name`? ¿Viene normalizado o en raw?
3. Fecha de la OC → `created_at`? ¿`issue_date`?
4. Código UNSPSC → ¿en `purchase_orders` directamente o via join a `opportunity_items`?

Con eso armamos el `pymengine-fetch` en ValidateAI sin necesitar más idas y vueltas.
