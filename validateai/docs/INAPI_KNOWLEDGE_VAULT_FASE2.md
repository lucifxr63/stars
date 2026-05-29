# INAPI Knowledge Vault — Fase 2: Migración a Proyecto Separado

## Contexto

`inapi_records` es un corpus de 503K marcas/patentes chilenas que vive en el proyecto principal de Supabase (`fcdhcntyvsydnvjwopfe`). No es datos operacionales — es un knowledge vault de consulta para el análisis de colisiones de marcas durante el due diligence.

### Estado post Fase 1 (2026-05-28)

| Métrica | Antes | Después |
|---|---|---|
| Filas | 876K | **503K** (−372K inactivas) |
| Tamaño total | 2.463 GB | **1.279 GB** |
| Índices | 137 MB | **53 MB** |
| DB total proyecto | 2.501 GB | **~1.32 GB** |

**Qué se ejecutó en Fase 1:**
- DELETE de registros con status: Caducado/a, Denegada, Abandonada, Desistida, Rechazada, Vencida, Anulada
- DROP de 6 índices B-tree sin uso
- VACUUM FULL para reclamar espacio físico
- Nuevo índice trigram GIN en `brand_name` (`inapi_brand_trgm_idx`)
- RPC `search_inapi_brands(p_brand_name, p_limit)` con similitud fuzzy
- `inapi-fetch` edge function reescrita para usar la tabla local (la API OData pública de INAPI no funciona)

**Problema pendiente:** `inapi_records` (1.28 GB) sigue en el proyecto principal que corre en MICRO (1 GB RAM). El corpus presiona constantemente el compute.

---

## Fase 2: Separar al Knowledge Vault

**Objetivo:** Proyecto principal pasa de ~1.32 GB → ~37 MB. El corpus INAPI tiene su propio proyecto con compute dedicado.

---

### Paso 1 — Crear nuevo proyecto Supabase

- **Nombre:** `validateai-knowledge-vault`
- **Tier compute:** MICRO (es solo lectura, bajo tráfico)
- **Region:** `us-east-2` (igual que el proyecto principal para baja latencia entre edge functions)
- **Guardar:** URL y `service_role_key` del nuevo proyecto

---

### Paso 2 — Exportar datos del proyecto principal

Con `pg_dump` desde terminal (requiere tener psql/pg_dump instalado):

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.fcdhcntyvsydnvjwopfe.supabase.co:5432/postgres" \
  --table=public.inapi_records \
  --no-owner --no-acl \
  -F c \
  -f inapi_records_export.dump
```

O con el script Node ya disponible en el proyecto (adaptar `vacuum_inapi.mjs` para hacer COPY TO STDOUT en batches).

---

### Paso 3 — Preparar el knowledge-vault

En el nuevo proyecto, habilitar extensiones necesarias:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
```

Crear la tabla (misma estructura que la actual, sin columnas deprecadas):

```sql
CREATE TABLE inapi_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number    text UNIQUE NOT NULL,
  brand_name            text,
  status                text,
  type_name             text,
  subtype_name          text,
  niza_classes          text[],
  filing_date           date,
  expiration_date       date,
  applicants            text,
  country               text,
  brand_name_embedding  vector(1536),
  ingested_at           timestamptz DEFAULT now()
);
```

> Las columnas `label_description`, `protection_description`, `translation`, `priorities`, `representatives`, `inventors`, `location_*`, `state_*`, `vienna_classes`, `regions`, `ipc_codes`, `pct_*`, `sign_type`, `image_url` **no se migran** — no son usadas por ningún componente de la app.

---

### Paso 4 — Importar al knowledge-vault

```bash
pg_restore "postgresql://postgres:[NEW_PASSWORD]@db.[NEW_REF].supabase.co:5432/postgres" \
  -F c -d postgres inapi_records_export.dump
```

---

### Paso 5 — Recrear índices en el knowledge-vault

```sql
-- Búsqueda fuzzy de marcas (trigram) — funciona en MICRO
CREATE INDEX inapi_brand_trgm_idx
  ON inapi_records USING gin (brand_name gin_trgm_ops);

-- Filtro por estado activo
CREATE INDEX inapi_active_status_idx
  ON inapi_records (status)
  WHERE status IN ('Registrada', 'En Trámite', 'En trámite',
                   'Esperando renovación', 'Cancelada Voluntariamente');
```

---

### Paso 6 — Índice vectorial HNSW (requiere SMALL temporalmente)

El IVFFlat ocupa ~900 MB en índice para 117K vectores de 1536 dim — no cabe en MICRO.
El HNSW con parámetros reducidos es más eficiente en consulta pero igualmente pesado para construir.

**Procedimiento:**
1. Subir el knowledge-vault a **SMALL** ($0.0206/hr, 2 GB RAM)
2. Construir el índice (~10-20 min):

```sql
CREATE INDEX inapi_brand_hnsw_idx
  ON inapi_records
  USING hnsw (brand_name_embedding vector_cosine_ops)
  WITH (m = 8, ef_construction = 32)
  WHERE brand_name_embedding IS NOT NULL;
```

3. Volver a bajar a **MICRO** — el índice ya construido persiste y se consulta bien en MICRO para volúmenes moderados.

---

### Paso 7 — Recrear RPC en el knowledge-vault

```sql
CREATE OR REPLACE FUNCTION search_inapi_brands(
  p_brand_name text,
  p_limit      int DEFAULT 25
)
RETURNS TABLE(
  brand_name         text,
  status             text,
  applicants         text,
  niza_classes       text[],
  application_number text,
  similarity_score   float4
)
LANGUAGE sql STABLE SECURITY DEFINER AS $func$
  SELECT
    brand_name,
    status,
    applicants,
    niza_classes,
    application_number,
    similarity(brand_name, p_brand_name) AS similarity_score
  FROM inapi_records
  WHERE
    brand_name % p_brand_name
    OR brand_name ILIKE '%' || p_brand_name || '%'
  ORDER BY
    CASE WHEN upper(brand_name) = upper(p_brand_name) THEN 0 ELSE 1 END,
    similarity(brand_name, p_brand_name) DESC
  LIMIT p_limit;
$func$;
```

---

### Paso 8 — Actualizar `inapi-fetch` para apuntar al vault

En `supabase/functions/inapi-fetch/index.ts`, cambiar `getSupabase()` para usar las variables del knowledge-vault:

```typescript
function getKnowledgeVault() {
  return createClient(
    Deno.env.get('KNOWLEDGE_VAULT_URL')!,
    Deno.env.get('KNOWLEDGE_VAULT_SERVICE_ROLE_KEY')!,
  );
}
```

Configurar los secrets en el proyecto principal:
```bash
supabase secrets set KNOWLEDGE_VAULT_URL=https://[NEW_REF].supabase.co
supabase secrets set KNOWLEDGE_VAULT_SERVICE_ROLE_KEY=[NEW_SERVICE_ROLE_KEY]
```

---

### Paso 9 — DROP TABLE en el proyecto principal

Solo después de verificar que el knowledge-vault responde correctamente:

```sql
-- Proyecto principal fcdhcntyvsydnvjwopfe
DROP TABLE public.inapi_records CASCADE;
-- Esto también dropea: inapi_brand_trgm_idx, inapi_active_status_idx, etc.
```

---

## Resultado esperado

| | Post Fase 1 | Post Fase 2 |
|---|---|---|
| DB proyecto principal | 1.32 GB | **~37 MB** |
| Compute proyecto principal | MICRO sin presión | MICRO cómodo |
| `inapi_records` | en principal | **knowledge-vault dedicado** |
| Índice vectorial HNSW | no disponible | ✅ disponible |
| Costo adicional mensual | $0 | ~$0 (MICRO o FREE para vault) |

---

## Archivos relevantes

| Archivo | Descripción |
|---|---|
| `supabase/functions/inapi-fetch/index.ts` | Edge function — solo cambiar `getSupabase()` → `getKnowledgeVault()` en Paso 8 |
| `scripts/vacuum_inapi.mjs` | Script Node con `pg` instalado — adaptar para el export por batches |
| `supabase/migrations/20260528_inapi_optimize_phase1.sql` | Historial de cambios Fase 1 |
| `validateai-knowledge-vault/` | Carpeta del vault en el monorepo — destino natural del nuevo proyecto |
