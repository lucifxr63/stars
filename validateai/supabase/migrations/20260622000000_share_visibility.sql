-- Control de visibilidad por sección en el reporte público compartido (/shared/:token).
-- Semántica: null = todo visible (retrocompatible con los share_token ya existentes).
-- Solo las claves en `false` ocultan su sección. Hoy se exponen como togglables las
-- secciones financieras sensibles (unit_economics, fundraising_roadmap).
ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS share_visibility jsonb;

COMMENT ON COLUMN public.validations.share_visibility IS
  'Visibilidad por sección en el reporte público compartido. null = todo visible; { "<section>": false } oculta esa sección.';
