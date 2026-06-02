-- Sprint: Onboarding + Navigation
-- Agrega campos de onboarding y perfil de startup a profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS startup_name text,
  ADD COLUMN IF NOT EXISTS startup_sector text,
  ADD COLUMN IF NOT EXISTS founder_pitch text;

-- Los usuarios existentes ya completaron su flujo — marcar como listos
UPDATE public.profiles
SET onboarding_completed = true;
