-- ============================================================
-- ValidateAI — Fase 4.2: Historial de versiones / Pivotes
-- ============================================================

-- Columnas de versioning en la tabla de validaciones
alter table public.validations
  add column if not exists parent_id    uuid references public.validations(id) on delete set null,
  add column if not exists version      int default 1,
  add column if not exists pivot_reason text;

-- Índice para consultar el historial de una idea (todas sus versiones)
create index if not exists idx_validations_parent
  on public.validations(parent_id);

-- Vista auxiliar: árbol de versiones de una idea
-- Uso: select * from validation_tree where root_id = '<id>';
create or replace view validation_tree as
with recursive tree as (
  -- raíz: validaciones sin parent
  select
    id, user_id, idea_name, validation_score, version, pivot_reason,
    parent_id, created_at, completed_at, status,
    id as root_id,
    0 as depth
  from public.validations
  where parent_id is null

  union all

  -- hijos
  select
    v.id, v.user_id, v.idea_name, v.validation_score, v.version, v.pivot_reason,
    v.parent_id, v.created_at, v.completed_at, v.status,
    t.root_id,
    t.depth + 1
  from public.validations v
  inner join tree t on v.parent_id = t.id
)
select * from tree;
