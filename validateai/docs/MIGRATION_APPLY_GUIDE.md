# Aplicar Migraciones en Producción — Guía Exacta

Dos migraciones pendientes de aplicar en el Supabase de producción (en orden).

---

## Migración 1 — `20260608120000_fix_economic_knowledge_constraints.sql`
## Migración 2 — `20260608140000_chilecompra_metricas.sql`

Ambas están en `validateai/supabase/migrations/`.

---

## Qué hace la migración 2 (chilecompra_metricas)

```sql
-- Crea la tabla chilecompra_metricas con columnas M1-M10
-- Índice único (rut, calculado_al) para upsert onConflict
-- RLS: service_role escribe, authenticated lee
create table if not exists public.chilecompra_metricas (...)
```

**Por qué es necesaria:** La Edge Function `chilecompra-calcular` hace upsert en esta tabla
con `onConflict: 'rut,calculado_al'`. Sin la tabla, la función falla con error 42P01.

---

## Qué hace la migración 1 (constraints economic_knowledge)

---

## Qué hace esta migración

```sql
-- 1. Agrega columna created_at a economic_knowledge (faltaba)
alter table public.economic_knowledge
  add column if not exists created_at timestamp with time zone
    default timezone('utc'::text, now()) not null;

-- 2. Garantiza constraint único (provider, indicator) para upsert onConflict
alter table public.economic_knowledge
  drop constraint if exists economic_knowledge_provider_indicator_key;

alter table public.economic_knowledge
  add constraint economic_knowledge_provider_indicator_key
  unique (provider, indicator);
```

**Por qué es necesaria:** Los crons `fred-sync`, `cron-uf-daily`, y la función `chilecompra-fetch`
usan `.upsert(..., { onConflict: 'provider,indicator' })`. Sin el constraint único en esas columnas,
el upsert falla silenciosamente e inserta duplicados.

---

## Opción A — Supabase CLI (aplica ambas en orden)

```bash
cd E:\DEV\Respos\Trabajo\startups\validateai
supabase link --project-ref <tu-project-ref>
supabase db push
```

`db push` aplica las migraciones pendientes en orden cronológico (por timestamp del nombre de archivo).
Verificar el output: debe mostrar ambos archivos como "Applied".

---

## Opción A — Supabase CLI (histórico)

### Prerrequisitos

```bash
# Instalar CLI si no lo tienes
npm install -g supabase

# Autenticarse
supabase login
```

### Comandos

```bash
# Navegar al directorio del proyecto
cd E:\DEV\Respos\Trabajo\startups\validateai

# Enlazar con el proyecto de producción (solo primera vez)
# El project-ref está en: Supabase Dashboard → Settings → General → Reference ID
supabase link --project-ref <tu-project-ref>

# Ver qué migraciones están pendientes
supabase db push --dry-run

# Aplicar las migraciones pendientes en producción
supabase db push
```

`db push` aplicará TODAS las migraciones que aún no se hayan ejecutado en prod.
Si solo quieres aplicar esta en particular:

```bash
# Opción: ejecutar el SQL directamente
supabase db execute --file supabase/migrations/20260608120000_fix_economic_knowledge_constraints.sql --project-ref <tu-project-ref>
```

---

## Opción B — SQL Editor en el Dashboard (más rápido, aplica una por una)

**Ejecutar en este orden:**

### 1. `20260608120000_fix_economic_knowledge_constraints.sql`
### 2. `20260608140000_chilecompra_metricas.sql`

---

## Opción B — SQL Editor (detalles)

1. Ir a: **Supabase Dashboard → SQL Editor → New Query**
2. Copiar y pegar el contenido del archivo:
   `validateai/supabase/migrations/20260608120000_fix_economic_knowledge_constraints.sql`
3. Hacer click en **Run** (o `Ctrl+Enter`)

El SQL usa `IF NOT EXISTS` / `IF EXISTS` así que es **idempotente** — ejecutarlo dos veces no rompe nada.

---

## Verificar que se aplicaron correctamente

```sql
-- 1. Verificar migración 1: columna created_at + constraint
select column_name, data_type
from information_schema.columns
where table_name = 'economic_knowledge' and column_name = 'created_at';

select conname, contype from pg_constraint
where conname = 'economic_knowledge_provider_indicator_key';
-- Debe retornar: contype = 'u'

-- 2. Verificar migración 2: tabla chilecompra_metricas existe
select table_name from information_schema.tables
where table_name = 'chilecompra_metricas' and table_schema = 'public';

-- 3. Verificar índice único
select indexname from pg_indexes
where tablename = 'chilecompra_metricas' and indexname like '%rut_fecha%';
```

---

## Después de aplicar — desplegar Edge Functions nuevas

```bash
# Función nueva que requiere la tabla chilecompra_metricas
supabase functions deploy chilecompra-calcular --project-ref <ref>

# Funciones actualizadas (nuevas rutas)
supabase functions deploy api-v1 --project-ref <ref>
supabase functions deploy assemble-mega-prompt --project-ref <ref>
```

---

## Después de aplicar — verificar flujo completo

1. **Verificar los crons** funcionan sin errores:
   - `fred-sync`: ir a Supabase → Edge Functions → Logs → buscar `fred-sync`
   - `cron-uf-daily`: ídem

2. **Confirmar datos en economic_knowledge**:
   ```sql
   select provider, count(*), max(updated_at)
   from public.economic_knowledge
   group by provider
   order by provider;

3. **Probar chilecompra-calcular** con un RUT real:
   ```bash
   curl -X GET "${SUPABASE_URL}/functions/v1/chilecompra-calcular?rut=76543210-K" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
   ```
   Debe devolver `{ ingreso_fiscal_12m: ..., tendencia_pct: ..., _cached: false }`
   ```
   Debe mostrar al menos `CMF` y `FRED` con fechas recientes.

3. **Verificar el health check** del portal en [validus.scouttech.lat/developers](https://validus.scouttech.lat/developers):
   - CMF → Activo (con fecha de última sync)
   - FRED → Activo (si el cron ya corrió)

---

## Si algo sale mal

La migración es completamente segura de revertir si es necesario:

```sql
-- Rollback manual
alter table public.economic_knowledge drop constraint if exists economic_knowledge_provider_indicator_key;
alter table public.economic_knowledge drop column if exists created_at;
```

Pero esto solo será necesario si la columna `created_at` colisiona con alguna columna existente
(lo cual no debería pasar dado el `IF NOT EXISTS`).
