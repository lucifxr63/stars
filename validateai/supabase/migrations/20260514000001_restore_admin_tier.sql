-- Migration: Restaurar tier 'pro' al admin/owner del proyecto
-- La migración 20260507_new_tier_structure.sql reseteó TODOS los usuarios a 'free',
-- incluyendo la cuenta del dueño. Esta migración la restaura.
-- Reemplaza el email con el del admin real si es diferente.

UPDATE public.profiles
SET tier = 'pro'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email = 'lucianoalonso2000@gmail.com'
);
