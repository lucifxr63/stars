-- Migration: Agregar kyc_status y rut a la tabla profiles
-- Para cumplimiento de validación de identidad y onboarding.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS rut text;

-- Restricción para asegurar que kyc_status solo pueda tener valores válidos
ALTER TABLE profiles
ADD CONSTRAINT chk_kyc_status CHECK (kyc_status IN ('pending', 'verified', 'rejected'));

-- Índice para mejorar el rendimiento de consultas por estado de KYC
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON profiles(kyc_status);
