-- ============================================================
-- Cashflow — Run Rate Autopilot (CASHFLOW_PRD_PART_6)
-- ============================================================
-- Unifica los gastos recurrentes en una entidad de transacciones recurrentes
-- con tipo IN/OUT, para soportar también INGRESOS fijos (igualas, MRR).
-- ============================================================

-- 1. Renombrar la tabla existente.
alter table cashflow.recurring_expense rename to recurring_transaction;

-- 2. Columna 'type' con default 'OUT' para no romper los datos actuales.
alter table cashflow.recurring_transaction
  add column type text not null default 'OUT' check (type in ('IN', 'OUT'));

-- 3. Renombrar la política RLS por limpieza (el nombre real en este proyecto
--    es cf_recurring_crud_own).
alter policy "cf_recurring_crud_own" on cashflow.recurring_transaction
  rename to "cf_recurring_tx_crud_own";

-- 4. Refrescar el cache de esquema de PostgREST tras el rename.
notify pgrst, 'reload schema';
