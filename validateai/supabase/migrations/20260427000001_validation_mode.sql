ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS validation_mode text DEFAULT 'detailed'
  CHECK (validation_mode IN ('quick', 'detailed'));

COMMENT ON COLUMN public.validations.validation_mode IS
  'quick = solo Step 1, IA infiere el resto | detailed = wizard completo (3 steps + generación)';

ALTER TABLE public.validations DROP CONSTRAINT IF EXISTS validations_current_step_check;
UPDATE public.validations SET current_step = 4 WHERE current_step > 4;
ALTER TABLE public.validations ADD CONSTRAINT validations_current_step_check CHECK (current_step BETWEEN 1 AND 4);
