ALTER TABLE validations
  ADD COLUMN score_breakdown jsonb,
  ADD COLUMN share_token     text UNIQUE;

CREATE INDEX IF NOT EXISTS validations_share_token_idx ON validations (share_token);

-- Policy: lectura pública por share_token
CREATE POLICY "public_shared_validation" ON validations
  FOR SELECT
  USING (share_token IS NOT NULL AND share_token = current_setting('request.jwt.claims', true)::json->>'share_token');
