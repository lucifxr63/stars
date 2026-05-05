-- Campos enriquecidos del Wizard v2 para alimentar el Prompt Maestro (playbook_analysis)
-- current_solution: cómo resuelven el problema hoy (define JTBD y competidor real)
-- acquisition_channel: canal para los primeros 100 clientes (define CAC estimado)
-- tech_level: nivel técnico del equipo (define stack recomendado)
alter table validations
  add column if not exists current_solution    text,
  add column if not exists acquisition_channel text,
  add column if not exists tech_level          text;
