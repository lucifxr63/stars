# Migraciones — proceso y auditoría de drift

## El problema
El historial de migraciones remoto **no está trackeado** (`supabase migration list` muestra
la columna Remote vacía). Por eso:
- `supabase db push` es **peligroso** (intentaría re-aplicar todo el historial).
- Las migraciones se aplican a mano → es fácil que un archivo **nunca llegue a prod** y
  nadie lo note hasta que algo falla en runtime.

Esto pasó de verdad: `merge_generation_progress` (persistencia de progreso del wizard)
existía en `migrations/` pero no en prod → las llamadas fallaban en silencio. Se detectó
generando los tipos de DB y se corrigió.

## Cómo aplicar una migración (canónico)
```bash
cd validateai
supabase db query --linked --file supabase/migrations/<archivo>.sql
```
`db query --linked` usa la Management API (sin password, con la sesión `supabase login`),
aplica SOLO ese SQL sin tocar el historial. Escribir siempre migraciones **idempotentes**
(`create table if not exists`, `create or replace function`, `drop policy if exists`).

## Auditoría de drift (preventiva)
```bash
bash scripts/audit-migrations.sh
```
Compara todas las funciones y tablas declaradas en `migrations/` contra lo que existe en
prod. Sale con error y lista lo que falta. **Correr tras cada migración** y periódicamente.
Hoy: ✅ sin drift (16 funciones, 43 tablas).

## Regla de equipo
1. Escribir la migración idempotente.
2. Aplicarla con `db query --linked` **al mergear** (o antes).
3. Correr `audit-migrations.sh` para confirmar.
4. Tras aplicar, `npm run gen:types` para refrescar los tipos de DB.
