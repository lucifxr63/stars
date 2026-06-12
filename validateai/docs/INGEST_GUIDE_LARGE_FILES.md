# Validus — Guía de Ingesta INAPI (TOON → Supabase)

> **Audiencia:** Desarrollador externo integrando datos de INAPI (marcas y patentes chilenas).  
> **Formato fuente:** Archivos TOON con registros `RECORD_START / RECORD_END`, ~500 MB c/u.  
> **Volumen estimado:** 4 archivos × ~555,000 registros = ~2,200,000 registros totales.  
> **Fecha:** Mayo 2026

---

## 1. Decisión Arquitectónica: tabla dedicada, no RAG

Los datos de INAPI son **registros estructurados**, no documentos narrativos. La distinción importa:

| Pregunta de negocio | Requiere |
|---|---|
| ¿Está registrada la marca "EcoVida"? | Match exacto — SQL |
| ¿Hay marcas similares a "FreshMkt" vigentes? | Similitud vectorial + filtro SQL |
| Marcas en clase Niza 5 que expiran antes de 2026 | SQL puro |

Meter esto en `tenant_vectors` pierde los filtros estructurados. La solución correcta:

```
Archivos TOON (INAPI)
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  tabla: inapi_records                                   │
│                                                         │
│  ├── Todos los campos tipados (date, text, text[])      │
│  ├── Índices SQL en status, expiration_date, niza       │
│  └── brand_name_embedding  vector(1536)  ◄── solo esto  │
└─────────────────────────────────────────────────────────┘
      │
      ▼
  RPC híbrida: filtro SQL + similitud coseno sobre brand_name
```

El embedding **solo se genera para `brand_name`** — el único campo semántico. Todo lo demás es SQL tipado.

---

## 2. Migración SQL

Crea esta tabla en Supabase (Dashboard → SQL Editor, o agrégala como migración):

```sql
-- Habilitar pgvector si no está activo
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS inapi_records (
  id                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identidad
  application_number       text        UNIQUE NOT NULL,
  registration_number      text,
  application_type         text,
  application_seq          text,
  application_serie        text,

  -- Clasificadores (múltiples valores posibles)
  niza_classes             text[],
  vienna_classes           text[],
  regions                  text[],
  ipc_codes                text[],      -- para patentes

  -- Partes involucradas
  applicants               text,
  representatives          text,
  inventors                text,        -- para patentes
  location_applicants      text,
  state_applicants         text,
  location_representatives text,
  state_representatives    text,
  country                  text,

  -- Fechas (tipo date real, no string)
  filing_date              date,
  publication_date         date,
  registration_date        date,
  expiration_date          date,
  pct_application_date     date,
  pct_publication_date     date,

  -- Descripción de la marca / patente
  brand_name               text,
  title                    text,        -- para patentes: título largo
  translation              text,
  label_description        text,
  protection_description   text,
  priorities               text,
  sign_type                text,
  type_name                text,
  subtype_name             text,
  status                   text,
  image_url                text,

  -- Control
  last_updated_date        timestamptz,
  ingested_at              timestamptz DEFAULT now(),

  -- Vector semántico (solo brand_name o title)
  brand_name_embedding     vector(1536)
);

-- Índices estructurados
CREATE INDEX IF NOT EXISTS inapi_status_idx
  ON inapi_records (status);

CREATE INDEX IF NOT EXISTS inapi_expiration_idx
  ON inapi_records (expiration_date);

CREATE INDEX IF NOT EXISTS inapi_type_idx
  ON inapi_records (type_name);

CREATE INDEX IF NOT EXISTS inapi_country_idx
  ON inapi_records (country);

CREATE INDEX IF NOT EXISTS inapi_niza_idx
  ON inapi_records USING GIN (niza_classes);

CREATE INDEX IF NOT EXISTS inapi_ipc_idx
  ON inapi_records USING GIN (ipc_codes);

-- Full-text search en español sobre brand_name y title
CREATE INDEX IF NOT EXISTS inapi_brand_fts_idx
  ON inapi_records USING GIN (to_tsvector('spanish', COALESCE(brand_name, '') || ' ' || COALESCE(title, '')));

-- Índice vectorial (crear DESPUÉS de cargar los datos para que sea más rápido)
-- Ajusta `lists` a sqrt(total_registros): para 2.2M → ~1500
CREATE INDEX IF NOT EXISTS inapi_brand_vec_idx
  ON inapi_records USING ivfflat (brand_name_embedding vector_cosine_ops)
  WITH (lists = 1500);
```

### RPC de búsqueda híbrida

```sql
CREATE OR REPLACE FUNCTION search_inapi_brands(
  query_embedding   vector(1536),
  filter_status     text    DEFAULT NULL,
  filter_niza       text    DEFAULT NULL,
  filter_type       text    DEFAULT NULL,
  filter_country    text    DEFAULT NULL,
  match_threshold   float   DEFAULT 0.72,
  match_count       int     DEFAULT 10
)
RETURNS TABLE (
  application_number  text,
  registration_number text,
  brand_name          text,
  title               text,
  status              text,
  type_name           text,
  niza_classes        text[],
  expiration_date     date,
  applicants          text,
  country             text,
  similarity          float
)
LANGUAGE sql STABLE AS $$
  SELECT
    application_number,
    registration_number,
    brand_name,
    title,
    status,
    type_name,
    niza_classes,
    expiration_date,
    applicants,
    country,
    1 - (brand_name_embedding <=> query_embedding) AS similarity
  FROM inapi_records
  WHERE
    (filter_status  IS NULL OR status    = filter_status)
    AND (filter_niza    IS NULL OR niza_classes @> ARRAY[filter_niza])
    AND (filter_type    IS NULL OR type_name    = filter_type)
    AND (filter_country IS NULL OR country      = filter_country)
    AND brand_name_embedding IS NOT NULL
    AND 1 - (brand_name_embedding <=> query_embedding) > match_threshold
  ORDER BY brand_name_embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## 3. Estructura del archivo TOON (formato real)

El formato TOON de INAPI es clave-valor con delimitadores de registro:

```
RECORD_START
APPLICATIONNUMBER: 199101284
REGISTRATIONNUMBER: 45911
APPLICANTS: (MX) PLANOBRA S.A. DE C.V.
REPRESENTATIVES: (CL) VILLASECA
INVENTORS: (MX) HECTOR SAMUEL MARTINEZ GONZALEZ
FILINGDATE: 1991-12-20 00:00:00
...
STATUS: Caducada
COUNTRY: MEXICO
IPC: E02D17/00; E02D29/02;
LASTUPDATEDDATE: 2026-05-25 06:00:06.880000
RECORD_END
```

**No es JSON** — es texto con separador `: ` y bloques `RECORD_START / RECORD_END`.

---

## 4. Pipeline de Ingesta

La ingesta **no pasa por la API pública de Validus** — va directo a Supabase con la service role key. Esto evita los rate limits del API gateway y es mucho más rápido para bulk.

```
archivo.toon (500 MB)
    │
    ▼  streaming (no carga todo en memoria)
[1] Parser TOON  ──► dict por registro
    │
    ▼  acumula N registros
[2] Buffer       ──► lote de 100 registros
    │
    ├──► INSERT bulk en inapi_records (sin embedding por ahora)
    │
    └──► brand_name list (20 por vez)
              │
              ▼
         OpenAI Embeddings
              │
              ▼
         UPDATE inapi_records SET brand_name_embedding = ...
```

El embedding se genera en una **segunda pasada** sobre los registros ya insertados. Esto permite:
- Reiniciar la ingesta si falla sin perder datos ya insertados
- Separar el costo de DB del costo de OpenAI
- Paralelizar si es necesario

---

## 5. Implementación

### Dependencias

```bash
pip install supabase openai python-dotenv
```

### Variables de entorno

```bash
# .env
SUPABASE_URL=https://fcdhcntyvsydnvjwopfe.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # service_role, NO anon
OPENAI_API_KEY=sk-...
```

### 5.1 Parser TOON (streaming)

```python
# toon_parser.py
from datetime import date
from typing import Iterator

FIELD_MAP = {
    'APPLICATIONNUMBER':      'application_number',
    'REGISTRATIONNUMBER':     'registration_number',
    'APPLICATIONTYPE':        'application_type',
    'APPLICATIONSEQ':         'application_seq',
    'APPLICATIONSERIE':       'application_serie',
    'NIZACLASSES':            'niza_classes',
    'VIENACLASSES':           'vienna_classes',
    'REGIONS':                'regions',
    'IPC':                    'ipc_codes',
    'APPLICANTS':             'applicants',
    'REPRESENTATIVES':        'representatives',
    'INVENTORS':              'inventors',
    'LOCATIONAPPLICANTS':     'location_applicants',
    'APPLICANTREGION':        'state_applicants',
    'LOCATIONREPRESENTATIVES':'location_representatives',
    'REPRESENTATIVEREGION':   'state_representatives',
    'COUNTRY':                'country',
    'FILINGDATE':             'filing_date',
    'PUBLICATIONDATE':        'publication_date',
    'REGISTRATIONDATE':       'registration_date',
    'EXPIRATIONDATE':         'expiration_date',
    'PCTAPPLICATIONDATE':     'pct_application_date',
    'PCTPUBLICATIONDATE':     'pct_publication_date',
    'BRANDNAME':              'brand_name',
    'TITLE':                  'title',
    'TRANSLATION':            'translation',
    'LABELDESCRIPTION':       'label_description',
    'PROTECTIONDESCRIPTION':  'protection_description',
    'PRIORITIES':             'priorities',
    'SIGNTYPE':               'sign_type',
    'TYPENAME':               'type_name',
    'SUBTYPENAME':            'subtype_name',
    'STATUS':                 'status',
    'IMAGE':                  'image_url',
    'LASTUPDATEDDATE':        'last_updated_date',
}

DATE_FIELDS = {'filing_date', 'publication_date', 'registration_date',
               'expiration_date', 'pct_application_date', 'pct_publication_date'}

ARRAY_FIELDS = {'niza_classes', 'vienna_classes', 'regions', 'ipc_codes'}


def _parse_date(value: str) -> str | None:
    """Convierte '1991-12-20 00:00:00' o '1991-12-20' a 'YYYY-MM-DD'. Retorna None si vacío."""
    value = value.strip()
    if not value:
        return None
    return value.split(' ')[0]  # toma solo la parte de fecha


def _parse_array(value: str) -> list[str]:
    """
    Parsea campos multi-valor.
    Ejemplos: "E02D17/00; E02D29/02;" o "5; 25" o "Metropolitana; Valparaíso"
    """
    parts = [p.strip().rstrip(';').strip() for p in value.split(';')]
    return [p for p in parts if p]


def stream_records(filepath: str) -> Iterator[dict]:
    """
    Lee el archivo TOON línea por línea.
    Emite un dict por registro sin cargar el archivo completo en memoria.
    """
    current: dict = {}
    inside = False

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.rstrip('\n').rstrip('\r')

            if line.strip() == 'RECORD_START':
                current = {}
                inside = True
                continue

            if line.strip() == 'RECORD_END':
                if current.get('application_number'):
                    yield current
                current = {}
                inside = False
                continue

            if not inside:
                continue

            # Separar clave y valor en el primer ':'
            if ':' not in line:
                continue
            raw_key, _, raw_value = line.partition(':')
            key = raw_key.strip().upper().replace(' ', '')
            value = raw_value.strip()

            db_field = FIELD_MAP.get(key)
            if db_field is None:
                continue  # campo desconocido — ignorar

            if db_field in DATE_FIELDS:
                current[db_field] = _parse_date(value)
            elif db_field in ARRAY_FIELDS:
                current[db_field] = _parse_array(value) if value else []
            else:
                current[db_field] = value if value else None
```

### 5.2 Ingesta masiva en Supabase (Fase 1: sin embeddings)

```python
# phase1_insert.py
import os
from dotenv import load_dotenv
from supabase import create_client
from toon_parser import stream_records

load_dotenv()

supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_KEY'],
)

BATCH_SIZE = 500  # inserts por request (Supabase acepta hasta ~1000)

TOON_FILES = [
    '/data/inapi_marcas_01.toon',
    '/data/inapi_marcas_02.toon',
    '/data/inapi_marcas_03.toon',
    '/data/inapi_marcas_04.toon',
]


def insert_batch(batch: list[dict]) -> int:
    """
    Upsert por application_number — idempotente: re-correr no duplica registros.
    """
    resp = supabase.table('inapi_records').upsert(
        batch,
        on_conflict='application_number',
        ignore_duplicates=False,   # actualiza si ya existe
    ).execute()
    return len(resp.data) if resp.data else 0


def main():
    total_inserted = 0

    for filepath in TOON_FILES:
        print(f"\nProcesando: {filepath}")
        buffer = []
        file_count = 0

        for record in stream_records(filepath):
            buffer.append(record)

            if len(buffer) >= BATCH_SIZE:
                n = insert_batch(buffer)
                total_inserted += n
                file_count += n
                print(f"  {file_count:,} registros insertados...", end='\r')
                buffer = []

        # Último lote parcial
        if buffer:
            n = insert_batch(buffer)
            total_inserted += n
            file_count += n

        print(f"  Archivo completo: {file_count:,} registros")

    print(f"\nFASE 1 COMPLETA: {total_inserted:,} registros en inapi_records")


if __name__ == '__main__':
    main()
```

### 5.3 Generación de Embeddings (Fase 2)

Corre esta fase **después** de que la Fase 1 termine. Lee los registros sin embedding de la DB y los procesa en batches.

```python
# phase2_embeddings.py
import os
import time
from dotenv import load_dotenv
from supabase import create_client
from openai import OpenAI

load_dotenv()

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
openai_client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])

EMBED_BATCH = 100    # textos por llamada a OpenAI (máx ~2048, pero 100 es seguro)
PAGE_SIZE   = 1000   # registros leídos de DB por página


def get_embeddings(texts: list[str]) -> list[list[float]]:
    resp = openai_client.embeddings.create(
        model='text-embedding-3-small',
        input=texts,
    )
    return [item.embedding for item in resp.data]


def get_searchable_text(record: dict) -> str:
    """
    El texto que se vectoriza. Combina brand_name + title para cubrir
    tanto marcas comerciales como patentes.
    """
    parts = [
        record.get('brand_name') or '',
        record.get('title') or '',
    ]
    return ' '.join(p for p in parts if p).strip()


def process_page(records: list[dict]) -> int:
    """Genera embeddings para una página y actualiza la DB."""
    # Filtrar los que tienen texto útil
    valid = [(r['id'], get_searchable_text(r)) for r in records if get_searchable_text(r)]
    if not valid:
        return 0

    updated = 0
    for i in range(0, len(valid), EMBED_BATCH):
        batch = valid[i:i + EMBED_BATCH]
        ids   = [b[0] for b in batch]
        texts = [b[1] for b in batch]

        embeddings = get_embeddings(texts)

        # UPDATE individual por id (Supabase no soporta bulk update con valores distintos)
        for record_id, embedding in zip(ids, embeddings):
            supabase.table('inapi_records').update(
                {'brand_name_embedding': embedding}
            ).eq('id', record_id).execute()

        updated += len(batch)

    return updated


def main():
    total_updated = 0
    page = 0

    print('FASE 2: Generando embeddings para brand_name / title...')

    while True:
        # Leer registros sin embedding (paginado)
        resp = supabase.table('inapi_records')\
            .select('id, brand_name, title')\
            .is_('brand_name_embedding', 'null')\
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)\
            .execute()

        records = resp.data or []
        if not records:
            break

        n = process_page(records)
        total_updated += n
        page += 1
        print(f'  Página {page}: {n} embeddings generados | total: {total_updated:,}')
        time.sleep(0.2)  # respeto a rate limits de OpenAI

    print(f'\nFASE 2 COMPLETA: {total_updated:,} registros con embedding')


if __name__ == '__main__':
    main()
```

> **Tip:** El UPDATE individual de la Fase 2 es lento a escala de millones. Si necesitas procesar más rápido, usa la función `pgvector` de Supabase directamente desde un script SQL con `pg_net` o corre los UPDATEs en paralelo con `asyncio`.

---

## 6. Estimación de Escala y Costos

```
FASE 1 — Inserción estructurada
  ~555,000 registros por archivo × 4 = 2,200,000 registros
  Batches de 500 → 4,400 requests a Supabase
  Tiempo estimado: ~2 horas (sin paralelismo)
  Costo Supabase: incluido en el plan (operaciones de DB)

FASE 2 — Embeddings
  ~2,200,000 registros × 5 tokens (brand_name promedio) = 11M tokens
  text-embedding-3-small: $0.02 / 1M tokens → $0.22 USD total
  Batches de 100 → 22,000 requests a OpenAI
  Tiempo estimado: ~4-6 horas (rate limit OpenAI: 3,000 req/min en tier 2+)
```

---

## 7. Crear el índice vectorial DESPUÉS de la ingesta

El índice `ivfflat` debe crearse **una vez que los datos estén cargados**, no antes. Con datos ya presentes, Postgres lo construye de una vez (mucho más eficiente que insertar con índice activo).

```sql
-- Ejecutar en SQL Editor de Supabase cuando la Fase 2 esté completa
CREATE INDEX inapi_brand_vec_idx
  ON inapi_records USING ivfflat (brand_name_embedding vector_cosine_ops)
  WITH (lists = 1500);  -- sqrt(2,200,000) ≈ 1483 → redondeamos a 1500

-- Verificar cobertura
SELECT
  COUNT(*) AS total,
  COUNT(brand_name_embedding) AS con_embedding,
  ROUND(100.0 * COUNT(brand_name_embedding) / COUNT(*), 1) AS pct
FROM inapi_records;
```

---

## 8. Cómo usar la búsqueda desde Validus

Una vez cargados los datos, el sistema puede consultar `inapi_records` directamente desde cualquier Edge Function:

```typescript
// Ejemplo desde una Edge Function (Deno)
const queryEmbedding = await generateEmbedding('EcoVida salud natural')

const { data } = await supabase.rpc('search_inapi_brands', {
  query_embedding: queryEmbedding,
  filter_status:   'Vigente',
  filter_niza:     '5',         // Clase Niza 5: productos farmacéuticos
  match_threshold: 0.72,
  match_count:     10,
})

// data → array de marcas similares vigentes en clase 5
```

---

## 9. Checklist de Ingesta

**Preparación**
- [ ] Ejecutar migración SQL (`CREATE TABLE inapi_records` + índices)
- [ ] Configurar `.env` con `SUPABASE_SERVICE_KEY` (service_role, no anon)
- [ ] Probar parser con 1 archivo: `python -c "from toon_parser import stream_records; r=list(stream_records('archivo.toon')); print(len(r), r[0])"`

**Fase 1 — Inserción**
- [ ] Correr `python phase1_insert.py` con 1 archivo primero
- [ ] Verificar en Supabase: `SELECT COUNT(*) FROM inapi_records`
- [ ] Revisar que los campos de fecha y arrays estén bien parseados
- [ ] Correr los 4 archivos completos

**Fase 2 — Embeddings**
- [ ] Correr `python phase2_embeddings.py`
- [ ] Verificar cobertura con la query SQL de la sección 7

**Post-ingesta**
- [ ] Crear índice `ivfflat` (sección 7)
- [ ] Probar RPC `search_inapi_brands` con una marca de prueba
- [ ] Crear el índice `VACUUM ANALYZE inapi_records` para estadísticas de planner

---

## 10. Notas sobre Re-ingesta

El `upsert` con `on_conflict='application_number'` hace que re-correr el script sea **seguro e idempotente** — actualiza registros existentes si `LASTUPDATEDDATE` cambió, sin duplicar. INAPI actualiza sus registros periódicamente; puedes programar una re-ingesta mensual.
