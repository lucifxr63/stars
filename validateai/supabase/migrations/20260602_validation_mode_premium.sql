-- Ampliar el check constraint de validation_mode para incluir 'premium'.
-- El constraint original solo admitía ('quick', 'detailed') pero el flujo premium
-- necesita guardar 'premium' como modo válido.

ALTER TABLE validations
  DROP CONSTRAINT IF EXISTS validations_validation_mode_check;

ALTER TABLE validations
  ADD CONSTRAINT validations_validation_mode_check
  CHECK (validation_mode IN ('quick', 'detailed', 'premium'));
