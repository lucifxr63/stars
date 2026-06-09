# Sistemas Externos Pendientes de Implementación

Guía técnica para los scrapers y sistemas de ingesta de datos que requieren
infraestructura fuera de Supabase Edge Functions. Cada sección documenta:
qué dato obtener, cómo obtenerlo, dónde almacenarlo y las fricciones conocidas.

> **Infraestructura requerida antes de implementar cualquier scraper:**
> Supabase Edge Functions tienen timeout de 10 segundos y 150 MB de RAM.
> Los scrapers con Playwright / sesiones largas deben correr en un **worker externo**.
> Stack recomendado: **Deno en Fly.io** (imagen `denoland/deno`) con PG notify para
> encolar jobs. Ver sección "Arquitectura sugerida" al final.

---

## 1. Dirección del Trabajo (DT) — Morosidad Previsional

### Por qué es crítico
La morosidad en el pago de cotizaciones previsionales es la señal más temprana de
insolvencia de una empresa chilena, 3–6 meses antes de que los estados financieros
reflejen el problema. Una empresa que deja de pagar AFP/salud a sus empleados está
en crisis de liquidez.

### Dato a extraer
- Por cada RUT de empresa: si tiene deuda previsional en DT
- Monto adeudado (CLP)
- Número de trabajadores afectados
- Fecha del último registro de deuda

### URL objetivo
```
https://www.dt.gob.cl/portal/1626/w3-propertyvalue-22743.html
# Portal de verificación de cumplimiento de obligaciones previsionales
# Requiere RUT de la empresa como input
```

### Método de scraping
1. **Playwright** (no Puppeteer — Playwright maneja mejor los sitios .gob.cl)
2. Navegar a `/verificacion-cumplimiento`
3. Ingresar RUT en el formulario
4. Esperar respuesta (puede tomar 3–8 segundos)
5. Parsear tabla de resultados

### Autenticación
El portal de consulta pública **no requiere login** para consultas individuales.
Para scraping masivo: rotar user agents + delays aleatorios entre requests.
Si el volumen es alto, evaluar acuerdo de intercambio de datos con DT (tienen convenios institucionales).

### Fricción principal: CAPTCHA
El portal DT tiene reCAPTCHA v2 en el formulario de búsqueda masiva.
**Solución:** Para un RUT a la vez, el CAPTCHA no se activa en los primeros N requests.
Para volumen, usar servicio de resolución: **2captcha** (USD 1.5 por 1000 CAPTCHAs) o
implementar delay de 30s entre requests para no triggear rate limiting.

### Tabla destino
```sql
create table public.dt_morosidad (
  id uuid default gen_random_uuid() primary key,
  rut text not null,
  tiene_deuda boolean not null,
  monto_clp bigint,            -- null si no tiene deuda
  trabajadores_afectados int,
  fecha_registro_deuda date,
  raw_html text,               -- HTML crudo para reparse futuro
  fetched_at timestamptz not null default now(),
  unique(rut)
);
```

### Edge Function wrapper
Después de que el worker externo scrapea y persiste en `dt_morosidad`,
agregar a `api-v1`:
```
GET /api/v1/data/dt?rut={rut}
```
Que simplemente lee de la tabla. El scraping no ocurre en el hot path.

### Cron sugerido
```
0 6 * * 1-5   # 06:00 UTC (02:00 CLT) — procesa cola de RUTs pendientes de refresh
```

---

## 2. Tesorería General de la República (TGR) — Deudas Tributarias

### Por qué es valioso
TGR gestiona la cobranza de deudas del Estado. Una empresa con deudas en cobranza
ejecutiva con TGR tiene problemas financieros documentados y un riesgo de embargo.
Complementa a DT: DT detecta crisis de liquidez operativa; TGR detecta deuda tributaria acumulada.

### Dato a extraer
- Por RUT: si tiene deudas en cobranza ejecutiva con el Fisco
- Monto total adeudado
- Organismos acreedores (SII, municipalidades, etc.)

### URL objetivo
```
https://www.tgr.cl/certificado-deuda-moratoria/
# Servicio de certificado de deuda (consulta pública con RUT)
```

**Alternativa con mejor estructura:**
```
https://portaldeudas.tgr.cl/  # Portal específico de deudas (lanzado 2024)
```

### Método de scraping
1. Playwright, navegar al formulario
2. Ingresar RUT + dígito verificador
3. Si requiere código de seguridad (imagen CAPTCHA, no reCAPTCHA): usar OCR con
   `tesseract.js` — el CAPTCHA de TGR es simple texto distorsionado, OCR resuelve ~85%
4. Parsear resultado de tabla o mensaje de "sin deudas"

### Fricción principal: CAPTCHA de imagen
TGR usa CAPTCHA de imagen simple (texto en fondo ruidoso).
**Solución preferida:** `tesseract.js` con preprocesamiento de imagen (contraste + umbralización).
Si accuracy < 80%, fallback a 2captcha.

### Tabla destino
```sql
create table public.tgr_deudas (
  id uuid default gen_random_uuid() primary key,
  rut text not null,
  tiene_deuda_ejecutiva boolean not null,
  monto_clp bigint,
  acreedores jsonb,            -- [{ organismo: "SII", monto: 1234567 }]
  fetched_at timestamptz not null default now(),
  unique(rut)
);
```

### Nota legal
El certificado de deuda TGR es información pública (Ley 20.285 de Transparencia).
Consultarlo y almacenarlo está permitido para uso comercial en consultoría y
evaluación de riesgo. Fuente: dictamen CGR 2019.

---

## 3. Diario Oficial — Estructura Societaria

### Por qué es crítico
El Diario Oficial es la única fuente oficial para:
- Constitución de empresas (quiénes son los dueños iniciales, capital)
- Modificaciones societarias (cambios de directorio, nuevos socios)
- Disoluciones
- Fusiones y adquisiciones

### Dato a extraer
Filtrar por tipo de publicación (solo las relevantes, ~20% del volumen total):
- `CONSTITUCIÓN DE SOCIEDAD`
- `MODIFICACIÓN DE ESTATUTOS`
- `DISOLUCIÓN`
- `FUSIÓN`
- `CESIÓN DE DERECHOS`

Para cada publicación: nombre empresa, RUT, fecha, tipo de acto, participantes y
porcentajes de participación.

### URL objetivo
```
https://www.diariooficial.interior.gob.cl/publicaciones/
# Listado diario — acceso libre

# Para bajar el PDF del día:
https://www.diariooficial.interior.gob.cl/publicaciones/{YYYY}/{MM}/{DD}/
```

### Método de ingesta
1. **Download diario del PDF** a las 09:00 (se publica ~08:30)
2. **LlamaParse** para extraer texto estructurado del PDF
   - Usar `mode: "premium"` para documentos legales
   - Costo estimado: ~USD 0.003 por página × 200 páginas/día = USD 0.60/día = USD 18/mes
3. **Claude con structured output** para extraer:
   ```json
   {
     "tipo_acto": "CONSTITUCIÓN",
     "empresa": { "nombre": "...", "rut": "..." },
     "socios": [{ "nombre": "...", "rut": "...", "porcentaje": 50 }],
     "capital_clp": 1000000,
     "fecha_publicacion": "2026-06-08"
   }
   ```
4. **Filtrar** solo actos societarios relevantes antes de enviar a Claude
   (ahorra ~80% de tokens)

### Tabla destino
```sql
create table public.diario_oficial_actos (
  id uuid default gen_random_uuid() primary key,
  fecha_publicacion date not null,
  tipo_acto text not null,       -- CONSTITUCION, MODIFICACION, DISOLUCION, etc.
  empresa_nombre text,
  empresa_rut text,
  socios jsonb,                  -- [{ nombre, rut, porcentaje }]
  capital_clp bigint,
  raw_text text,                 -- texto extraído por LlamaParse
  do_edicion text,               -- número de edición del DO
  pagina_inicio int,
  fetched_at timestamptz not null default now()
);
create index on public.diario_oficial_actos(empresa_rut);
create index on public.diario_oficial_actos(fecha_publicacion desc);
```

### Cron sugerido
```
30 12 * * 1-6   # 12:30 UTC (08:30 CLT) — descarga e ingesta el DO del día
```

### Fricción conocida: PDFs mal formateados
Algunos DO históricos son escaneos con OCR deficiente.
LlamaParse maneja esto mejor que PyPDF/pdfplumber, pero para documentos pre-2015
puede ser necesario preprocesamiento con `img2pdf` + mejora de contraste.

---

## 4. Aduanas Chile — Validación de Flujo Físico

### Por qué es valioso
Permite verificar que el volumen de negocio declarado por una empresa es real:
si una empresa dice importar USD 5M en componentes electrónicos pero no aparece
en los registros de Aduanas, hay una discrepancia a investigar.

### Dato a extraer
- Por RUT importador/exportador: volumen de importaciones/exportaciones
- Principales países de origen/destino
- Categorías arancelarias (partidas HS)
- Tendencia temporal (últimos 12 meses)

### Fuentes de datos

#### Opción A: Datos abiertos de Aduanas (sin acuerdo)
```
https://datos.gob.cl/dataset?q=aduanas
# Portal datos.gob.cl tiene datasets agregados de Aduanas
# Granularidad: mensual por capítulo arancelario (NO por empresa individual)
# Útil para contexto macro pero no para análisis por empresa
```

#### Opción B: Solicitud de acceso a datos (recomendada para escalabilidad)
```
# Servicio Nacional de Aduanas tiene programa de intercambio de datos para
# investigación y desarrollo. Contacto:
# Departamento de Estadísticas — subdatosestadisticas@aduana.cl
# Requiere: descripción del caso de uso, acuerdo de confidencialidad
# Tiempo estimado de respuesta: 30–60 días hábiles
```

#### Opción C: Compra de base de datos comercial
```
# Proveedores que revenden datos de Aduanas estructurados:
# - DATAMYNE: datos.datamyne.com (USD 500–2000/mes)
# - Import Genius: importgenius.com (similar pricing)
# Desventaja: latencia de 1–3 días vs. datos oficiales
```

### Recomendación
**Postergar esta integración** hasta tener >50 clientes activos que la demanden.
El costo de obtención (acuerdo institucional O servicio comercial) no se justifica
para el volumen actual. Usar datos agregados de datos.gob.cl como proxy mientras tanto.

### Tabla destino (para cuando se implemente)
```sql
create table public.aduanas_movimientos (
  id uuid default gen_random_uuid() primary key,
  rut text not null,
  tipo text not null,            -- IMPORTACION | EXPORTACION
  mes date not null,             -- primer día del mes
  monto_usd bigint,
  pais_contraparte text,
  partida_hs text,               -- código HS de 6 dígitos
  cantidad_kg bigint,
  fuente text not null,          -- ADUANA_OFICIAL | DATAMYNE | DATOS_GOB_CL
  fetched_at timestamptz not null default now()
);
create index on public.aduanas_movimientos(rut, mes desc);
```

---

## 5. OpenSanctions + OFAC — Compliance Global

### Por qué es crítico para enterprise
Sin este módulo, ValidateAI no puede ser usado por bancos ni aseguradoras para KYC/AML.
Es el requisito de entrada al segmento enterprise (10x pricing vs. startup tier).

### Dato a extraer
Por cada RUT o nombre de empresa/persona: si aparece en listas de sanciones internacionales.
- OFAC SDN List (EE.UU.) — lavado de activos, terrorismo, narcotráfico
- EU Consolidated Sanctions List
- UN Security Council Sanctions
- Interpol notices (via OpenSanctions)

### Implementación recomendada

#### Paso 1: Licencia OpenSanctions
```
https://www.opensanctions.org/licensing/
Precio: USD 1,800/mes (100k queries) o USD 800/mes (self-hosted con bulk download)
```
**Elegir self-hosted**: se descarga el dataset completo (JSON, ~2 GB comprimido)
y se corre localmente. Protege los datos de los clientes (no salen a APIs externas).

#### Paso 2: Ingesta del dataset en Supabase
```sql
create table public.sanctions_entities (
  id text primary key,           -- ID de OpenSanctions
  schema_type text,              -- Person | Company | Organization
  names jsonb,                   -- array de nombres alternativos
  identifiers jsonb,             -- RUTs, pasaportes, NIT equivalentes
  datasets text[],               -- ['us_ofac_sdn', 'eu_fsf', etc.]
  countries text[],
  raw_data jsonb,
  updated_at timestamptz
);
create index on public.sanctions_entities using gin(names jsonb_path_ops);
create index on public.sanctions_entities using gin(identifiers jsonb_path_ops);
```

#### Paso 3: Matching algorithm
El matching por nombre es el desafío real (no los datos):
```typescript
// Nivel 1: match exacto por RUT (si disponible en el dataset)
// Nivel 2: match difuso por nombre con pg_trgm (similarity > 0.85)
// Nivel 3: match por transliteración (nombres con acentos vs. sin acentos)

// Regla: threshold 0.85 → "revisar manualmente"
//        threshold 0.95 → "coincidencia probable"
//        NO REPORTAR como sancionado hasta revisión humana
```

#### Paso 4: Edge Function `sanctions-check`
```
POST /api/v1/compliance/sanctions
Body: { rut?: string, nombre: string, tipo: "empresa" | "persona" }
Response: { match_level: "none" | "review" | "probable", matches: [...] }
```

### Fricción: Falsos positivos
Un match incorrecto puede ser demandable. Implementar siempre con:
1. Flag `requires_human_review: true` para matches > 0.85 y < 0.95
2. Audit log de cada consulta (quién consultó, cuándo, qué resultado)
3. Disclaimer legal en la API response

---

## Arquitectura Sugerida para Scrapers

```
┌─────────────────────────────────────────────────────┐
│                  Fly.io Worker                       │
│                                                     │
│  ┌─────────────┐    ┌──────────────────────────┐    │
│  │  Job Queue  │    │   Scraper Workers         │    │
│  │  (Redis /   │◄───│   - dt-scraper.ts         │    │
│  │  pg_notify) │    │   - tgr-scraper.ts        │    │
│  └─────────────┘    │   - diario-oficial.ts     │    │
│         ▲           └──────────┬─────────────────┘    │
│         │                      │                     │
└─────────┼──────────────────────┼─────────────────────┘
          │                      │ upsert
          │ notify               ▼
┌─────────┴──────────────────────────────────────────┐
│              Supabase                              │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │  scraper_jobs    │  │  dt_morosidad          │  │
│  │  (queue table)   │  │  tgr_deudas            │  │
│  │                  │  │  diario_oficial_actos  │  │
│  │  - rut           │  │  economic_knowledge    │  │
│  │  - scraper_type  │  └────────────────────────┘  │
│  │  - status        │                              │
│  │  - priority      │  api-v1 Edge Functions        │
│  └──────────────────┘  (solo leen, no scrapen)      │
└───────────────────────────────────────────────────┘
```

### Tabla de cola de jobs
```sql
create table public.scraper_jobs (
  id uuid default gen_random_uuid() primary key,
  scraper_type text not null,    -- 'DT' | 'TGR' | 'DIARIO_OFICIAL'
  input_rut text,                -- null para jobs sin RUT (ej: DO diario)
  status text not null default 'pending',  -- pending | processing | done | failed
  priority int default 5,        -- 1=urgente, 5=normal, 10=batch
  attempts int default 0,
  last_error text,
  created_at timestamptz default now(),
  processed_at timestamptz
);
create index on public.scraper_jobs(status, priority, created_at);
```

### Patrón de trigger desde api-v1
Cuando alguien consulta un RUT que no está en cache (o está stale):
1. `api-v1` devuelve los datos disponibles + `{ _data_freshness: "stale", _refresh_queued: true }`
2. Inserta un job en `scraper_jobs`
3. Fly.io worker recibe pg_notify, scrapea, actualiza la tabla destino

### Deploy en Fly.io
```toml
# fly.toml
app = "validateai-scrapers"
primary_region = "scl"  # Santiago — cerca de los servidores .gob.cl

[build]
  dockerfile = "Dockerfile.scraper"

[env]
  SUPABASE_URL = "..."   # leer de secrets
  DENO_ENV = "production"

[[services]]
  internal_port = 8080
  protocol = "tcp"

[processes]
  worker = "deno run --allow-net --allow-env worker.ts"
```

---

## Variables de Entorno Pendientes

Agregar a `.env.local` del proyecto y a Supabase Dashboard → Settings → Edge Functions:

| Variable | Descripción | Cómo obtener |
|----------|------------|--------------|
| `FRED_API_KEY` | API key gratuita de FRED | https://fred.stlouisfed.org/docs/api/api_key.html |
| `MERCADOPUBLICO_TICKET` | Ticket API Mercado Público | mercadopublico.cl → Mi Cuenta → Datos de cuenta |
| `OPENSANCTIONS_KEY` | Licencia OpenSanctions (pago) | opensanctions.org/licensing |
| `TWOCAPTCHA_API_KEY` | Resolver CAPTCHAs DT/TGR | 2captcha.com (USD 1.5/1000) |
| `FLY_API_TOKEN` | Deploy workers en Fly.io | fly.io → Account Settings |

---

## Prioridades de Implementación

| # | Sistema | Fricción | Valor | Bloqueo |
|---|---------|---------|-------|---------|
| 1 | ✅ FRED | Baja | Alto | FRED_API_KEY (gratis) |
| 2 | ✅ ChileCompra | Baja | Alto | MERCADOPUBLICO_TICKET |
| 3 | OpenSanctions | Media | Muy alto | Budget licencia |
| 4 | Diario Oficial | Alta | Alto | Infra Fly.io + LlamaParse scale |
| 5 | DT morosidad | Alta | Muy alto | Infra Fly.io + CAPTCHA |
| 6 | TGR deudas | Alta | Alto | Infra Fly.io + CAPTCHA |
| 7 | Aduanas | Muy alta | Medio | Acuerdo institucional |
