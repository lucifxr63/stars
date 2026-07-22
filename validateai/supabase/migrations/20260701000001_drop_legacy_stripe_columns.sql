-- Fase 16 (D / #5): limpieza de columnas legacy del proveedor de pago anterior
-- (Stripe). El cobro actual es LemonSqueezy (create-checkout + lemonsqueezy-webhook
-- → profiles.tier). Ningún código del repo referencia estas columnas (solo aparecían
-- en database.types.ts autogenerado). Drop idempotente.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_subscription_id;
