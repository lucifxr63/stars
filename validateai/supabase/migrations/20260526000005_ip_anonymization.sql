-- ============================================================
-- Sprint 2A — IP Anonymization
-- Cumplimiento Ley 21.719 Art. 3(d): minimización de datos.
-- Las IPs se truncan a /24 (IPv4) o /48 (IPv6) antes de persistir.
-- La utilidad anti-fraude (detección de farms) se preserva porque
-- las IPs de una misma red comparten el prefijo.
-- ============================================================

-- ── 1. Función pura de anonimización ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.anonymize_ip(ip TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts TEXT[];
BEGIN
  IF ip IS NULL OR ip = '' THEN
    RETURN NULL;
  END IF;

  -- IPv4: zerear el último octeto (x.x.x.0)
  IF ip ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$' THEN
    parts := string_to_array(ip, '.');
    RETURN parts[1] || '.' || parts[2] || '.' || parts[3] || '.0';
  END IF;

  -- IPv6: conservar los primeros 3 grupos (48-bit prefix)
  IF ip ~ ':' THEN
    parts := string_to_array(split_part(ip, '::', 1), ':');
    RETURN COALESCE(parts[1], '0') || ':'
        || COALESCE(parts[2], '0') || ':'
        || COALESCE(parts[3], '0') || '::/48';
  END IF;

  -- Formato desconocido — no almacenar para no crear falsa trazabilidad
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.anonymize_ip IS
  'Trunca IPv4 al /24 y IPv6 al /48. IMMUTABLE — usable en triggers e índices.';

-- ── 2. Trigger para consent_logs (BEFORE INSERT — tabla inmutable) ────────
CREATE OR REPLACE FUNCTION public.fn_anonymize_ip_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.ip_address := public.anonymize_ip(NEW.ip_address);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anonymize_ip_consent ON public.consent_logs;
CREATE TRIGGER trg_anonymize_ip_consent
  BEFORE INSERT ON public.consent_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_anonymize_ip_consent();

-- ── 3. Trigger para api_usage_logs (BEFORE INSERT) ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_anonymize_ip_api_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.ip_address := public.anonymize_ip(NEW.ip_address);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anonymize_ip_api_usage ON public.api_usage_logs;
CREATE TRIGGER trg_anonymize_ip_api_usage
  BEFORE INSERT ON public.api_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_anonymize_ip_api_usage();

-- ── 4. Backfill: anonimizar IPs existentes ────────────────────────────────
-- consent_logs
UPDATE public.consent_logs
SET ip_address = public.anonymize_ip(ip_address)
WHERE ip_address IS NOT NULL
  AND ip_address NOT LIKE '%.0'      -- ya anonimizadas (IPv4)
  AND ip_address NOT LIKE '%::/48';  -- ya anonimizadas (IPv6)

-- api_usage_logs
UPDATE public.api_usage_logs
SET ip_address = public.anonymize_ip(ip_address)
WHERE ip_address IS NOT NULL
  AND ip_address NOT LIKE '%.0'
  AND ip_address NOT LIKE '%::/48';
