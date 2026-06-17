#!/usr/bin/env bash
# Auditoría de drift de migraciones: compara las funciones y tablas declaradas en
# supabase/migrations/ contra lo que REALMENTE existe en la DB de producción.
# Existe porque el historial de migraciones remoto NO está trackeado (db push es
# inseguro) → un archivo de migración puede no haberse aplicado nunca y nadie lo nota.
# (Así se encontró merge_generation_progress, que el wizard llamaba sin existir en prod.)
#
# Uso:  bash scripts/audit-migrations.sh
# Requiere: supabase CLI logueado + proyecto linkeado.
set -euo pipefail
cd "$(dirname "$0")/.."

MIG=supabase/migrations

# Nombres de funciones y tablas declaradas en las migraciones (best-effort por regex).
fns=$(grep -rhioE "create or replace function +([a-z0-9_]+)" "$MIG" \
  | sed -E 's/.* ([a-z0-9_]+)$/\1/' | sort -u)
tbls=$(grep -rhioE "create table +(if not exists +)?(public\.)?([a-z0-9_]+)" "$MIG" \
  | sed -E 's/.* ([a-z0-9_]+)$/\1/' | sort -u)

# Construye arrays SQL.
to_arr() { printf "%s" "$1" | sed "s/.*/'&'/" | paste -sd, - ; }

sql="
with f(n) as (select unnest(array[$(to_arr "$fns")])),
     t(n) as (select unnest(array[$(to_arr "$tbls")]))
select 'MISSING FUNCTION: '||f.n from f
  where not exists (select 1 from pg_proc where proname=f.n)
union all
select 'MISSING TABLE: '||t.n from t
  where not exists (select 1 from information_schema.tables
                    where table_schema='public' and table_name=t.n);
"

echo "Auditando $(echo "$fns" | wc -l) funciones y $(echo "$tbls" | wc -l) tablas vs prod…"
out=$(supabase db query --linked "$sql" 2>/dev/null | grep -E "MISSING (FUNCTION|TABLE)" || true)
if [ -z "$out" ]; then
  echo "✅ Sin drift: todas las funciones/tablas de las migraciones existen en prod."
else
  echo "⚠️  DRIFT DETECTADO (declarado en migraciones pero ausente en prod):"
  echo "$out"
  echo ""
  echo "Revisar si la migración correspondiente debe aplicarse:"
  echo "  supabase db query --linked --file supabase/migrations/<archivo>.sql"
  exit 1
fi
