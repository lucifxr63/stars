ALTER TABLE validations
  ADD COLUMN target_country    text,
  ADD COLUMN target_region     text,
  ADD COLUMN pricing_range     text,
  ADD COLUMN business_stage    text,
  ADD COLUMN known_competitors text[],
  ADD COLUMN business_model    text;
