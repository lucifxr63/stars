-- ============================================================
-- Sprint 1 / ValidateAI V3 — Restaurar tier 'premium'
-- La migración 20260507 eliminó 'premium'. V3 lo requiere como
-- cuarto nivel ($29.990 CLP) con acceso total sin restricciones.
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('free', 'basic', 'pro', 'premium', 'admin'));
