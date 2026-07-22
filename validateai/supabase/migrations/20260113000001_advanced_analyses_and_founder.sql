ALTER TABLE validations
  ADD COLUMN IF NOT EXISTS founder_context jsonb,
  ADD COLUMN IF NOT EXISTS risk_analysis jsonb,
  ADD COLUMN IF NOT EXISTS unit_economics jsonb,
  ADD COLUMN IF NOT EXISTS founder_fit jsonb,
  ADD COLUMN IF NOT EXISTS market_signals jsonb;
