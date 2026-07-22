-- ============================================================
-- Migration: audit_logs
-- Purpose  : Registra acciones de sistema, API y autenticación
--            para la Consola de Auditoría del Developer Portal.
-- Created  : 2026-07-22
-- ============================================================

-- ── 1. Tabla principal ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Actor que realizó la acción (email del usuario o identificador de servicio)
    user_email  TEXT        NOT NULL,

    -- Acción estructurada en dot-notation: "api.key.created", "validation.run", etc.
    action      TEXT        NOT NULL,

    -- IP origen de la petición (puede ser NULL para tareas internas)
    ip_address  TEXT,

    -- Resultado de la acción
    status      TEXT        NOT NULL DEFAULT 'success'
                CHECK (status IN ('success', 'warning', 'error')),

    -- Metadata adicional libre (ej. endpoint, key_id, latency_ms)
    meta        JSONB,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ── 2. Comentarios de columnas ────────────────────────────────────────────────

COMMENT ON TABLE  public.audit_logs             IS 'Registro de auditoría para acciones del sistema y accesos de API Bralidus.';
COMMENT ON COLUMN public.audit_logs.user_email  IS 'Email del usuario o identificador del servicio (e.g. bot@bralidus).';
COMMENT ON COLUMN public.audit_logs.action      IS 'Acción en dot-notation: api.key.created | validation.run | data.macro.fetch | auth.login | webhook.created.';
COMMENT ON COLUMN public.audit_logs.ip_address  IS 'Dirección IP de origen. NULL para procesos internos/scheduler.';
COMMENT ON COLUMN public.audit_logs.status      IS 'success | warning | error.';
COMMENT ON COLUMN public.audit_logs.meta        IS 'Metadata libre: endpoint, key_prefix, latency_ms, etc.';

-- ── 3. Índices de rendimiento ─────────────────────────────────────────────────
-- El componente ordena por created_at DESC con filtros opcionales de
-- user_email (ilike) y action (eq). Estos índices cubren ambos patrones.

-- Ordenamiento principal (paginación)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON public.audit_logs (created_at DESC);

-- Filtro exacto por acción (SELECT + eq)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON public.audit_logs (action);

-- Filtro parcial por email (ilike → gin trigram es más eficiente a escala)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email_trgm
    ON public.audit_logs USING gin (user_email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_trgm
    ON public.audit_logs USING gin (action gin_trgm_ops);

-- ── 4. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo admins (service_role o usuarios con rol admin) pueden ver todo
-- Los usuarios normales solo ven sus propias entradas
CREATE POLICY "Admins can read all audit logs"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        -- Permite acceso total si el rol de Supabase es service_role
        -- o si el email del JWT coincide con el de la fila
        auth.jwt() ->> 'role' = 'service_role'
        OR auth.email() = user_email
    );

-- Solo service_role puede insertar (nunca el frontend directamente)
CREATE POLICY "Only service role can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Nadie puede modificar ni borrar registros de auditoría
-- (inmutabilidad por diseño — usar soft delete o archivado si se requiere)

-- ── 5. Función auxiliar para registrar una acción ─────────────────────────────
-- Uso desde Edge Functions: SELECT log_audit_action('lucia@dev.cl', 'api.key.created', '186.1.2.3', 'success', '{}');

CREATE OR REPLACE FUNCTION public.log_audit_action(
    p_user_email  TEXT,
    p_action      TEXT,
    p_ip_address  TEXT DEFAULT NULL,
    p_status      TEXT DEFAULT 'success',
    p_meta        JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.audit_logs (user_email, action, ip_address, status, meta)
    VALUES (p_user_email, p_action, p_ip_address, p_status, p_meta)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_audit_action IS
    'Registra una acción en audit_logs desde Edge Functions o triggers. Retorna el UUID del registro creado.';
