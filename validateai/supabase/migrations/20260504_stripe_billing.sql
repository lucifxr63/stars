-- Lemon Squeezy billing fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ls_subscription_id  text unique,
  ADD COLUMN IF NOT EXISTS tier_expires_at      timestamptz;

-- Index para lookups desde el webhook
CREATE INDEX IF NOT EXISTS profiles_ls_subscription_id_idx
  ON public.profiles (ls_subscription_id);
