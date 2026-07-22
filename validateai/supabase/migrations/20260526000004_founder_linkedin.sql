ALTER TABLE public.founder_profiles
  ADD COLUMN IF NOT EXISTS linkedin_member_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS photo_url          text;
