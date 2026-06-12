# ChileCompra — Transformación de Datos en Inteligencia de Riesgo

Guía para convertir los datos crudos de la API de Mercado Público en métricas
accionables para el motor de due diligence y perfilamiento de riesgo corporativo.

---

## Contexto

La API de Mercado Público expone transacciones del Estado. En crudo, esos datos son
ruido. Transformados, revelan tres cosas que ningún balance financiero muestra:
la **dependencia fiscal real** de una empresa, su **salud de caja con el Estado**,
y su **posición competitiva** en el mercado público.

Este documento define qué calcular, desde qué campos de la API, y cómo interpretarlo.

---

## Fuentes de datos de la API

### Endpoints relevantes

| Endpoint | Datos clave |
|----------|------------|
| `GET /servicios/v1/publico/ordenesdecompra.json?idrutempresa={rut}` | OC adjudicadas al proveedor |
| `GET /servicios/v1/publico/licitaciones.json?idrutempresa={rut}` | Licitaciones donde participó |
| `GET /servicios/v1/publico/proveedores/{rut}.json` | Perfil del proveedor |

### Campos relevantes en Órdenes de Compra (OC)

```
CodigoOC          → ID único de la orden
Fecha             → Fecha de creación
FechaModificacion → Última modificación (relevante para estado de pago)
Monto             → Valor en CLP
Estado            → Aceptada | Recepcionada | Pagada | Cancelada | Pendiente
Organismo.Nombre  → Organismo comprador
Organismo.Codigo  → Código del organismo
Tipo              → Trato Directo | Licitación | Convenio Marco
Descripcion       → Descripción del bien/servicio
```

### Campos relevantes en Licitaciones

```
CodigoLicitacion  → ID único
Tipo              → LP (>5000 UTM) | LE (500-5000 UTM) | LQ (100-500 UTM) | L1 (<100 UTM) | LD (Trato Directo)
Estado            → Publicada | Adjudicada | Desierta | Revocada | Suspendida
FechaCreacion
FechaCierre
Adjudicacion.RutProveedor  → Si ganó, quién fue
Adjudicacion.Monto
Ofertas           → Array de oferentes (para calcular win rate y competidores)
```

---

## Las 10 Métricas a Calcular

### TIER 1 — Señales de riesgo directo

---

#### M1. Ingreso Fiscal Anual (CLP)

**Qué mide:** Cuánto dinero recibió (o debe recibir) del Estado en los últimos 12 meses.

**Cálculo:**
```
ingreso_fiscal_12m = SUM(OC.Monto)
  WHERE OC.Estado IN ('Aceptada', 'Recepcionada', 'Pagada')
  AND OC.Fecha >= hoy - 365 días
```

**Interpretación:**
- Base de todas las demás métricas fiscales
- Comparar contra declaraciones SII para calcular dependencia
- Valor absoluto útil para calibrar el tamaño real de la empresa

---

#### M2. Tendencia de Contratos (% variación interanual)

**Qué mide:** Si la empresa está ganando más o menos contratos con el Estado. Una caída
sostenida aparece aquí 6–12 meses antes de que se refleje en estados financieros.

**Cálculo:**
```
ingreso_fiscal_periodo_actual  = SUM(OC.Monto) últimos 12 meses
ingreso_fiscal_periodo_anterior = SUM(OC.Monto) meses 13–24

tendencia_pct = ((actual - anterior) / anterior) × 100
```

**Interpretación:**
- `> +20%` → Crecimiento saludable en contratos públicos
- `-10% a +20%` → Estable
- `-10% a -30%` → Señal de alerta — revisar causas
- `< -30%` → Señal roja — pérdida significativa de mercado fiscal

---

#### M3. Deuda del Estado Pendiente (OC sin pagar > 60 días)

**Qué mide:** El Estado le debe plata a la empresa y no ha pagado. Es un proxy directo
de stress de liquidez: la empresa ya entregó el bien o servicio pero no recibió el dinero.

**Cálculo:**
```
deuda_estado_clp = SUM(OC.Monto)
  WHERE OC.Estado IN ('Aceptada', 'Recepcionada')  -- entregado pero no pagado
  AND OC.FechaModificacion < hoy - 60 días

oc_pendientes_count = COUNT de esas OC
```

**Interpretación:**
- Cualquier monto > 0 merece atención
- `> 3 meses de ingreso mensual promedio` → problema de liquidez activo
- Cruzar con `tendencia_contratos`: si tendencia baja Y deuda estado alta → doble señal roja

---

#### M4. % Trato Directo vs. Licitación Competitiva

**Qué mide:** Transparencia del proceso de adjudicación. Un proveedor que gana casi
todo por trato directo puede tener relaciones preferenciales con el organismo comprador.

**Cálculo:**
```
oc_trato_directo = COUNT(OC) WHERE OC.Tipo = 'Trato Directo'
oc_total = COUNT(OC) total

trato_directo_pct = (oc_trato_directo / oc_total) × 100

-- También calcular por monto (más revelador):
monto_trato_directo_pct = SUM(OC.Monto WHERE tipo='TD') / SUM(OC.Monto total) × 100
```

**Interpretación:**
- `< 30%` → Normal, mix saludable
- `30–60%` → Revisar — puede ser válido en rubros especializados
- `> 60%` → Bandera amarilla para due diligence — investigar organismos compradores
- `> 80%` → Bandera roja — posible captura del organismo o proveedor cautivo

**Nota:** En Chile, el Trato Directo está regulado (Ley 19.886 Art. 8) y tiene causales
válidas. No es ilegal, pero en exceso es una señal de opacidad.

---

### TIER 2 — Contexto y profundidad

---

#### M5. Índice de Concentración de Clientes Estatales

**Qué mide:** Riesgo de concentración. Si el 80% de los ingresos fiscales viene de
un solo organismo, la empresa es vulnerable a cambios en ese organismo.

**Cálculo:**
```
-- Distribución por organismo (últimos 12 meses)
por_organismo = GROUP BY OC.Organismo.Codigo → SUM(Monto)

-- Índice HHI (Herfindahl-Hirschman) de concentración:
participaciones = [monto_org / ingreso_fiscal_12m for cada org]
HHI_fiscal = SUM(participacion² × 10000)

-- O más simple: % del top organismo
top_organismo_pct = MAX(monto_org) / ingreso_fiscal_12m × 100
top_organismo_nombre = nombre del organismo con mayor monto
```

**Interpretación (índice simplificado — % top organismo):**
- `< 30%` → Cartera diversificada
- `30–50%` → Concentración moderada — aceptable
- `50–70%` → Concentración alta — riesgo si ese organismo cambia prioridades
- `> 70%` → Cliente único de facto — riesgo equivalente a empresa con un solo cliente B2B

---

#### M6. Monto Máximo de Contrato Adjudicado

**Qué mide:** La capacidad operativa máxima que el mercado le reconoce. Indica si la
empresa puede ejecutar contratos grandes o solo opera en escala micro.

**Cálculo:**
```
max_contrato_clp = MAX(OC.Monto) histórico
max_contrato_clp_12m = MAX(OC.Monto) últimos 12 meses
ticket_promedio_clp = AVG(OC.Monto) últimos 12 meses
```

**Interpretación:**
- Comparar el monto del contrato que se está evaluando vs. el `max_contrato_clp`
- Si la empresa nunca ha ejecutado un contrato de ese tamaño → riesgo de ejecución
- Un `ticket_promedio` muy bajo (< UF 50) indica operación en escala micro

---

#### M7. Diversificación Sectorial de Compradores

**Qué mide:** Si la empresa vende a múltiples sectores del Estado o está especializada
en uno. Diversificación = menor riesgo ante recortes presupuestarios sectoriales.

**Cálculo:**
```
-- Clasificar cada organismo en un sector
sector_map = {
  'Hospital', 'Servicio de Salud', 'FONASA' → 'Salud',
  'Municipalidad' → 'Municipal',
  'Ministerio de Educación', 'JUNAEB' → 'Educación',
  'Ejército', 'Armada', 'FACH' → 'Defensa',
  ... etc
}

sectores_activos = COUNT(sectores distintos con OC en últimos 12 meses)
distribucion_sectorial = { sector: monto_total } para cada sector
```

**Interpretación:**
- `>= 4 sectores` → Diversificación saludable
- `2–3 sectores` → Moderada
- `1 sector` → Concentración sectorial — evaluar según el sector

---

#### M8. Win Rate en Licitaciones Competitivas

**Qué mide:** Tasa de éxito real cuando la empresa compite en igualdad de condiciones
contra otros proveedores. Un win rate muy bajo con alto volumen de trato directo
es inconsistente y merece investigación.

**Cálculo:**
```
-- Licitaciones donde aparece como oferente (no trato directo)
licit_participadas = COUNT(Licitaciones donde aparece en Ofertas[])
licit_ganadas = COUNT(Licitaciones WHERE Adjudicacion.RutProveedor = rut_empresa)

win_rate_pct = (licit_ganadas / licit_participadas) × 100

-- Filtrar por tipo para comparación justa
win_rate_lp = win rate en licitaciones LP (>5000 UTM)
win_rate_le = win rate en licitaciones LE (500-5000 UTM)
```

**Interpretación:**
- Win rate muy alto (>60%) es sospechoso si el volumen es grande — investigar si son licitaciones "a medida"
- Win rate muy bajo (<5%) con alto volumen de trato directo → inconsistencia a señalar
- Win rate sectorial normal en Chile: 15–35% dependiendo del rubro

---

### TIER 3 — Inteligencia competitiva

---

#### M9. Mapa de Competidores Frecuentes

**Qué mide:** Quién más compite por los mismos contratos. Útil para entender el
ecosistema competitivo del cliente y su posición relativa en él.

**Cálculo:**
```
-- Para cada licitación donde participó la empresa:
competidores = Ofertas[].RutProveedor WHERE RUT != rut_empresa

-- Frecuencia:
competidor_frecuencia = {
  rut_competidor: COUNT(licitaciones en común)
}

-- Top 5 competidores por frecuencia de aparición conjunta
```

**Uso:** Cruzar con el propio perfil de Validus de esos competidores para
comparación directa (benchmarking de riesgo).

---

#### M10. Oportunidades No Aprovechadas

**Qué mide:** Licitaciones abiertas en el mismo rubro donde la empresa no está
participando. Puede indicar falta de capacidad de respuesta, problemas de
garantías, o simplemente una estrategia comercial.

**Cálculo:**
```
-- Identificar rubros de la empresa (desde descripción de OC ganadas)
rubros_empresa = clasificación por keywords de OC.Descripcion

-- Licitaciones activas en esos rubros donde no aparece como oferente
oportunidades = Licitaciones[estado='Publicada']
  WHERE rubro IN rubros_empresa
  AND rut_empresa NOT IN Ofertas[]
  AND FechaCierre > hoy
```

**Uso:** Para el pitch de Validus — mostrar al cliente startup cuánto mercado
fiscal está disponible en su sector que no está aprovechando.

---

## La Métrica Maestra: Dependencia Fiscal

Cuando se combina ChileCompra con SII (ya integrado), se puede calcular:

```
dependencia_fiscal_pct = ingreso_fiscal_12m / ingreso_total_sii_12m × 100
```

| Rango | Clasificación | Implicancia de riesgo |
|-------|--------------|----------------------|
| `0–10%` | Independiente | El Estado es un cliente más |
| `10–30%` | Dependencia baja | Saludable para la mayoría de rubros |
| `30–60%` | Dependencia media | Vulnerable a recortes presupuestarios |
| `60–80%` | Dependencia alta | Negocio cuasi-público — evaluar estabilidad del organismo comprador |
| `> 80%` | Dependencia crítica | Prácticamente una empresa del Estado sin serlo — riesgo máximo si cambia gobierno/autoridad |

---

## Schema SQL para Persistir las Métricas

```sql
create table public.chilecompra_metricas (
  id              uuid default gen_random_uuid() primary key,
  rut             text not null,
  calculado_al    date not null,               -- fecha de cálculo (ventana de 12m desde aquí)

  -- Tier 1
  ingreso_fiscal_12m          bigint,          -- CLP
  ingreso_fiscal_12m_anterior bigint,          -- CLP (meses 13-24)
  tendencia_pct               numeric(6,2),    -- % variación
  deuda_estado_pendiente_clp  bigint,
  oc_pendientes_count         int,
  trato_directo_pct           numeric(5,2),    -- % por count
  trato_directo_monto_pct     numeric(5,2),    -- % por monto

  -- Tier 2
  top_organismo_nombre        text,
  top_organismo_pct           numeric(5,2),
  organismos_count            int,
  sectores_count              int,
  distribucion_sectorial      jsonb,           -- { sector: monto }
  max_contrato_clp            bigint,
  ticket_promedio_clp         bigint,
  win_rate_pct                numeric(5,2),
  licit_participadas          int,
  licit_ganadas               int,

  -- Tier 3
  competidores_frecuentes     jsonb,           -- [{ rut, nombre, coincidencias }]
  oportunidades_abiertas      int,

  -- Métrica maestra (requiere SII)
  dependencia_fiscal_pct      numeric(5,2),    -- null si no hay dato SII

  -- Raw
  oc_procesadas               int,             -- cantidad de OC usadas para el cálculo
  raw_snapshot                jsonb,           -- snapshot de datos crudos para reparse
  fetched_at                  timestamptz default now()
);

create unique index on public.chilecompra_metricas(rut, calculado_al);
create index on public.chilecompra_metricas(rut, calculado_al desc);
```

---

## Lógica de Actualización

```
Frecuencia sugerida: semanal (los datos de ChileCompra se actualizan con 24-48h de lag)

Trigger adicional: cuando alguien genera un informe de due diligence para una empresa,
forzar refresh si las métricas tienen > 7 días.

Cron:  0 7 * * 1   # Lunes 07:00 UTC — recalcula métricas de empresas en watchlist
```

---

## Integración con el Motor de IA (assemble-mega-prompt)

Al construir el prompt de due diligence, incluir este bloque si hay datos disponibles:

```
DATOS MERCADO PÚBLICO (últimos 12 meses):
- Ingresos fiscales: $[M1] CLP ([tendencia]% vs. año anterior)
- Dependencia fiscal: [dependencia_fiscal_pct]% de ingresos totales
- Estado deuda del Estado: $[M3] CLP en OC sin pagar >60 días
- Concentración: [top_organismo_pct]% con [top_organismo_nombre]
- Transparencia: [trato_directo_pct]% adjudicado por trato directo
- Win rate competitivo: [win_rate_pct]% ([licit_ganadas]/[licit_participadas])
```

Esto le da al modelo el contexto fiscal sin necesidad de razonar sobre datos crudos.

---

## Señales de Alerta Combinadas (reglas de negocio)

Definir alertas automáticas cuando se detectan patrones de riesgo:

| Condición | Nivel | Mensaje sugerido |
|-----------|-------|-----------------|
| `tendencia < -30%` | 🔴 Alto | Caída >30% en contratos públicos interanual |
| `deuda_estado > 2× ticket_promedio` | 🟡 Medio | Estado debe >2 meses de facturación promedio |
| `trato_directo_monto_pct > 70%` | 🟡 Medio | Alta concentración en trato directo (opacidad) |
| `top_organismo_pct > 70%` | 🟡 Medio | Cliente fiscal único de facto |
| `dependencia_fiscal_pct > 60%` | 🔴 Alto | Dependencia crítica del gasto público |
| `win_rate < 5%` AND `trato_directo > 60%` | 🔴 Alto | Inconsistencia competitiva — investigar |
| `tendencia < -15%` AND `deuda_estado > 0` | 🔴 Alto | Doble señal: menos contratos + Estado no paga |
