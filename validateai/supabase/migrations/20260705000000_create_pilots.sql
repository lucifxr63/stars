-- ============================================================
-- Pilotos reales — Fase 1: solicitud persistida + estado founder
-- ============================================================
-- Épica separada del roadmap frontend-only del dashboard. Persiste las solicitudes
-- de piloto que hoy se gestionan a mano (ops/SALES_PIPELINE_TEMPLATE.md).
--
-- Seguridad:
--   - El founder SOLO puede INSERT su propia solicitud (auth.uid() = user_id).
--   - El founder NO tiene SELECT directo (evita leer admin_notes / filas ajenas):
--     lee su estado por la RPC SECURITY DEFINER get_my_pilot_status(), que devuelve
--     solo campos seguros (nunca email, objective ni admin_notes).
--   - El admin (public.is_admin()) lee y actualiza todo (gestión temporal por
--     Supabase dashboard / SQL; la UI admin llega en Fase 2).
--
-- Aplicar con: supabase db query --linked --file <este archivo>
-- (NO usar `supabase db push`: el historial remoto no está trackeado.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pilots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text NOT NULL,

  -- Idea de contexto (opcional). Si la validación se borra, la solicitud sobrevive.
  validation_id  uuid NULL REFERENCES public.validations(id) ON DELETE SET NULL,

  segment        text NOT NULL CHECK (segment IN (
                   'founder',
                   'pre_seed_seed',
                   'aceleradora',
                   'incubadora',
                   'innovacion_corporativa',
                   'mentor_scout',
                   'otro'
                 )),

  stage          text NULL,
  objective      text NULL,

  plan_interes   text NULL CHECK (plan_interes IN ('basic', 'pro', 'premium')),

  -- Estados del pipeline manual (ops/SALES_PIPELINE_TEMPLATE.md), sin inventar nuevos.
  status         text NOT NULL DEFAULT 'nuevo' CHECK (status IN (
                   'nuevo',
                   'contactado',
                   'demo_agendada',
                   'piloto_activo',
                   'feedback_recibido',
                   'interes_pago',
                   'cerrado',
                   'no_califica'
                 )),

  source         text NOT NULL DEFAULT 'dashboard',

  -- SOLO admin. El founder nunca lo lee (no tiene SELECT; la RPC no lo devuelve).
  admin_notes    text NULL,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilots_user_id_idx    ON public.pilots(user_id);
CREATE INDEX IF NOT EXISTS pilots_status_idx     ON public.pilots(status);
CREATE INDEX IF NOT EXISTS pilots_created_at_idx ON public.pilots(created_at DESC);

-- Una sola solicitud ABIERTA por usuario (cerrada/no_califica libera para re-solicitar).
CREATE UNIQUE INDEX IF NOT EXISTS pilots_one_open_request_per_user_idx
  ON public.pilots(user_id)
  WHERE status NOT IN ('cerrado', 'no_califica');

-- updated_at: reutiliza public.set_updated_at() (ya existe en el schema;
-- se re-declara idempotente para que este archivo sea self-contained).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_pilots_updated_at ON public.pilots;
CREATE TRIGGER set_pilots_updated_at
  BEFORE UPDATE ON public.pilots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.pilots ENABLE ROW LEVEL SECURITY;

-- Founder crea su propia solicitud.
DROP POLICY IF EXISTS pilots_owner_insert ON public.pilots;
CREATE POLICY pilots_owner_insert
  ON public.pilots
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin lee todo (panel /admin — Fase 2).
DROP POLICY IF EXISTS pilots_admin_select ON public.pilots;
CREATE POLICY pilots_admin_select
  ON public.pilots
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin actualiza estado/notas.
DROP POLICY IF EXISTS pilots_admin_update ON public.pilots;
CREATE POLICY pilots_admin_update
  ON public.pilots
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NOTA: no hay SELECT owner ni DELETE policy a propósito.

-- ── RPC segura: el founder ve SOLO su propio estado (campos seguros) ─────────
CREATE OR REPLACE FUNCTION public.get_my_pilot_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'id',           p.id,
        'status',       p.status,
        'segment',      p.segment,
        'stage',        p.stage,
        'plan_interes', p.plan_interes,
        'source',       p.source,
        'created_at',   p.created_at,
        'updated_at',   p.updated_at
      )
      FROM public.pilots p
      WHERE p.user_id = auth.uid()
      ORDER BY p.created_at DESC
      LIMIT 1
    ),
    NULL::jsonb
  );
$$;

-- La RPC nunca expone email, objective ni admin_notes.
REVOKE ALL ON FUNCTION public.get_my_pilot_status() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_pilot_status() TO authenticated;
-- Supabase concede EXECUTE por default (ALTER DEFAULT PRIVILEGES) a anon/authenticated/
-- service_role en funciones nuevas; el REVOKE FROM public no lo quita. Revocamos anon
-- explícitamente para que solo usuarios autenticados invoquen la RPC (defensa en
-- profundidad — la función ya filtra por auth.uid(), que es NULL para anon).
REVOKE EXECUTE ON FUNCTION public.get_my_pilot_status() FROM anon;

COMMENT ON TABLE public.pilots IS
  'Solicitudes de piloto (Fase 1). Founder solo INSERT + lectura de su estado vía RPC get_my_pilot_status; admin (is_admin) lee/actualiza. admin_notes es admin-only.';
