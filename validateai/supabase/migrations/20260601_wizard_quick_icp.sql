-- Sprint Q-A: Wizard Rápido v2 — campo ICP rápido
-- quick_icp es el segmento de cliente capturado en el flujo rápido.
-- No reemplaza customer_segment (flujo detallado); conviven como columnas independientes.

ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS quick_icp TEXT;
