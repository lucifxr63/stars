-- ============================================================
-- Cashflow — Ingesta asistida por IA (CASHFLOW_PRD_PART_4)
-- ============================================================
-- 1) Amplía invoice.source_system para aceptar 'PDF_AI' (facturas creadas
--    desde el parser de PDF; la función create_invoice las acepta además de MANUAL).
-- 2) Crea el bucket privado `cashflow_docs` para subir PDFs temporales, con RLS
--    por carpeta de usuario (path = {auth.uid()}/archivo.pdf). La función
--    parse-pdf borra el archivo tras procesarlo (TTL/limpieza).
-- ============================================================

-- ── 1. source_system: + PDF_AI ──────────────────────────────
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'cashflow.invoice'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%source_system%';
  if cname is not null then
    execute format('alter table cashflow.invoice drop constraint %I', cname);
  end if;
end $$;

alter table cashflow.invoice
  add constraint invoice_source_system_check
  check (source_system in ('MANUAL', 'SII', 'ODOO', 'PDF_AI'));

-- ── 2. Bucket privado para PDFs temporales ──────────────────
insert into storage.buckets (id, name, public)
values ('cashflow_docs', 'cashflow_docs', false)
on conflict (id) do nothing;

-- RLS: cada usuario solo opera sobre archivos bajo su propia carpeta {uid}/...
create policy "cf_docs_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'cashflow_docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "cf_docs_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'cashflow_docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "cf_docs_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'cashflow_docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
