-- Add user_id to ai_interactions for per-user rate limiting
ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS ai_interactions_user_id_created_at_idx
  ON ai_interactions (user_id, created_at DESC);
