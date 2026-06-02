-- Agregar columnas faltantes a la tabla validations.
-- Estas columnas son referenciadas por la edge function ai-validate y el frontend
-- pero nunca fueron creadas en migraciones anteriores.

ALTER TABLE validations
  ADD COLUMN IF NOT EXISTS governance_assessment   jsonb,
  ADD COLUMN IF NOT EXISTS fundraising_roadmap     jsonb,
  ADD COLUMN IF NOT EXISTS lean_roadmap            jsonb,
  ADD COLUMN IF NOT EXISTS financial_projection    jsonb,
  ADD COLUMN IF NOT EXISTS compliance_roadmap      jsonb,
  ADD COLUMN IF NOT EXISTS pitch_deck_content      jsonb,
  ADD COLUMN IF NOT EXISTS due_diligence_score     jsonb,
  ADD COLUMN IF NOT EXISTS generation_progress     jsonb;
