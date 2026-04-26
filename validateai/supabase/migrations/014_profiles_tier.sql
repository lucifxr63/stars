ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier text default 'free' check (tier in ('free', 'basic', 'pro', 'premium'));
