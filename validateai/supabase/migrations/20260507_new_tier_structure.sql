-- Migration: nueva arquitectura de tiers (Free / Basic / Pro)
-- Elimina el tier 'premium', ajusta cuotas a mensuales y resetea todos los usuarios a 'free'.

-- 1. Resetear todos los perfiles al nuevo tier por defecto
UPDATE public.profiles
SET tier = 'free',
    ls_subscription_id = NULL,
    tier_expires_at = NULL;

-- 2. Reemplazar el CHECK constraint para eliminar 'premium'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('free', 'basic', 'pro'));

-- 3. Asegurar que el default también quede actualizado
ALTER TABLE public.profiles
  ALTER COLUMN tier SET DEFAULT 'free';
