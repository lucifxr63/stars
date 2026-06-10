-- ============================================================
-- migration_analyst_rating.sql
-- Beta Phase — feedback de analistas sobre señales del Radar Forense.
--
-- Aplicar en Supabase SQL Editor UNA SOLA VEZ.
-- ============================================================

ALTER TABLE radar_signals
  ADD COLUMN IF NOT EXISTS analyst_rating     smallint
    CHECK (analyst_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS is_false_positive  boolean,
  ADD COLUMN IF NOT EXISTS analyst_notes      text,
  ADD COLUMN IF NOT EXISTS rated_at           timestamptz,
  ADD COLUMN IF NOT EXISTS rated_by           text;

-- Índice para consultas de análisis de calidad del classifier
CREATE INDEX IF NOT EXISTS idx_radar_signals_rating
  ON radar_signals (analyst_rating)
  WHERE analyst_rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_radar_signals_false_positive
  ON radar_signals (is_false_positive)
  WHERE is_false_positive IS TRUE;

-- Verificar:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'radar_signals'
-- AND column_name IN ('analyst_rating', 'is_false_positive', 'analyst_notes', 'rated_at', 'rated_by');
