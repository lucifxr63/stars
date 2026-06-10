-- ============================================================================
-- MIGRACIÓN: Sprint MoE-8 — Radar Forense
-- Ejecutar en: Supabase SQL Editor DESPUÉS de sprint_moe4.sql
-- Prerrequisito: extensión pgcrypto activa (para gen_random_uuid())
-- ============================================================================


-- ── 1. Tabla de señales del Radar Forense ─────────────────────────────────────
--
-- Cada fila representa una señal negativa de mercado detectada por el scraper.
-- El scheduler inserta cada 30 min. El GatingNetwork lee desde SignalCache (5min TTL).
-- Las señales expiran automáticamente via expires_at (no se borran, se filtran).
-- Retención recomendada: 30 días (limpiar con DELETE WHERE created_at < NOW() - INTERVAL '30 days').

CREATE TABLE IF NOT EXISTS radar_signals (
    id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at          timestamptz DEFAULT now() NOT NULL,
    sector              text        NOT NULL,                    -- "fintech" | "mineria" | "macro" | "global"
    affected_industries text[]      NOT NULL DEFAULT '{}',       -- ["fintech", "credito"]
    signal_type         text        NOT NULL,                    -- "REGULATORY_ACTION" | "SECTOR_RISK" | ...
    severity            float       NOT NULL
                        CHECK (severity >= 0 AND severity <= 1),
    headline_preview    text        NOT NULL,                    -- Primeros 300 chars del titular
    source              text        NOT NULL,                    -- "df.cl" | "emol.com" | "marketaux" | "marketaux-en"
    expires_at          timestamptz,                             -- NULL = nunca expira (señal manual)
    classified_by       text        NOT NULL DEFAULT 'keyword'   -- "keyword" | "haiku"
);


-- ── 2. Índices para consultas frecuentes ──────────────────────────────────────

-- El SignalCache consulta: WHERE expires_at > NOW() AND severity >= 0.4
CREATE INDEX IF NOT EXISTS radar_signals_active_idx
    ON radar_signals (expires_at DESC, severity DESC)
    WHERE expires_at IS NOT NULL;

-- Para análisis histórico: cuántas señales por sector y tipo
CREATE INDEX IF NOT EXISTS radar_signals_sector_type_idx
    ON radar_signals (sector, signal_type);

-- GIN para buscar por industria afectada (array containment queries)
-- Ejemplo: SELECT * FROM radar_signals WHERE affected_industries @> '{fintech}';
CREATE INDEX IF NOT EXISTS radar_signals_industries_gin_idx
    ON radar_signals USING gin (affected_industries);


-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE radar_signals ENABLE ROW LEVEL SECURITY;

-- Service role: acceso completo (scheduler inserta, GET /radar/signals lee)
CREATE POLICY "service_role_all" ON radar_signals
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Anon: sin acceso (datos de inteligencia interna)


-- ── 4. Vista analítica — Dashboard Radar ──────────────────────────────────────
--
-- SELECT * FROM radar_dashboard ORDER BY last_detected DESC LIMIT 20;

CREATE OR REPLACE VIEW radar_dashboard AS
SELECT
    sector,
    signal_type,
    round(avg(severity)::numeric, 3)   AS avg_severity,
    count(*)                           AS total_signals,
    count(*) FILTER (
        WHERE expires_at > now() OR expires_at IS NULL
    )                                  AS active_now,
    max(created_at)                    AS last_detected,
    min(created_at)                    AS first_detected
FROM radar_signals
WHERE created_at > now() - INTERVAL '7 days'
GROUP BY sector, signal_type
ORDER BY avg_severity DESC;


-- ── 5. Función de inserción manual de señales (para analistas) ───────────────
--
-- Permite a la Mesa Directiva inyectar señales manualmente sin esperar al scraper.
-- Uso desde Supabase Studio:
--   SELECT insert_radar_signal('fintech', ARRAY['fintech','credito'], 'REGULATORY_ACTION', 0.9, 'CMF inicia revisión masiva de fintechs', 'manual', 48);

CREATE OR REPLACE FUNCTION insert_radar_signal(
    p_sector            text,
    p_industries        text[],
    p_signal_type       text,
    p_severity          float,
    p_headline          text,
    p_source            text DEFAULT 'manual',
    p_ttl_hours         int  DEFAULT 24
) RETURNS uuid AS $$
DECLARE
    new_id uuid;
BEGIN
    INSERT INTO radar_signals (sector, affected_industries, signal_type, severity, headline_preview, source, expires_at, classified_by)
    VALUES (p_sector, p_industries, p_signal_type, p_severity, p_headline, p_source,
            now() + (p_ttl_hours || ' hours')::interval, 'manual')
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── Rollback ──────────────────────────────────────────────────────────────────
--
-- DROP FUNCTION IF EXISTS insert_radar_signal;
-- DROP VIEW IF EXISTS radar_dashboard;
-- DROP TABLE IF EXISTS radar_signals;
