-- Agrega columna playbook_analysis a validations para persistir el veredicto del Prompt Maestro
alter table validations
  add column if not exists playbook_analysis jsonb;
