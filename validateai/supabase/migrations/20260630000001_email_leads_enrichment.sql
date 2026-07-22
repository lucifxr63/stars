-- Fase 13 (#4): enriquecer email_leads con el plan deseado y el origen del lead.
-- Ambas columnas son NULLABLE → inserts previos (solo email) siguen funcionando.
-- 'plan'  = tier que el usuario intentaba comprar (basic|pro|premium) o NULL.
-- 'source' = superficie de captura (pricing|upgrade_modal|demo|quick_exit) o NULL.
-- No contienen PII: son enums cerrados sanitizados en send-quick-lead.

ALTER TABLE public.email_leads
  ADD COLUMN IF NOT EXISTS plan   TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Índice para segmentar leads por origen en analítica/admin.
CREATE INDEX IF NOT EXISTS idx_email_leads_source ON public.email_leads(source);
