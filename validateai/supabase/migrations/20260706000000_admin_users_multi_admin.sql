-- ============================================================
-- Multi-admin / operadores Scouttech (Pilotos Fase 3B)
-- ============================================================
-- Reemplaza el `public.is_admin()` de email hardcodeado (002_admin_policies.sql)
-- por un modelo escalable basado en la tabla `public.admin_users`, SIN romper las
-- policies existentes que ya dependen de `is_admin()` (profiles, validations,
-- ai_interactions, report_feedback, pilots, get_feedback_digest).
--
-- Backward-compatible: `is_admin()` devuelve true si el usuario está activo en
-- admin_users OR si coincide con el email legacy (fallback TEMPORAL para no
-- bloquear al owner actual durante la transición).
--
-- Recursión: `is_admin()` es SECURITY DEFINER → corre como owner → al leer
-- admin_users BYPASEA su RLS, por lo que la policy de admin_users puede usar
-- is_admin() sin recursión.
--
-- NO aplicar a producción sin revisión explícita.
-- Aplicar con: supabase db query --linked --file <este archivo>
-- ============================================================

-- Fallback legacy temporal (mismo email de 002_admin_policies.sql).
-- Documentado en docs/ADMIN_OPERATORS.md; se retira cuando admin_users sea la
-- única fuente y todos los operadores estén migrados.

CREATE TABLE IF NOT EXISTS public.admin_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'operator' CHECK (role IN ('owner', 'admin', 'operator')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Email único case-insensitive (no expresable como table constraint).
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_unique_idx
  ON public.admin_users (lower(email));
CREATE INDEX IF NOT EXISTS admin_users_active_idx ON public.admin_users (is_active);

-- updated_at (reutiliza el trigger estándar del schema).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS set_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER set_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS: solo admins pueden LEER admin_users. Sin INSERT/UPDATE/DELETE para
--    clientes: los operadores se gestionan por SQL / Supabase dashboard
--    (service_role bypasea RLS). Ver docs/ADMIN_OPERATORS.md.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_users_admin_select ON public.admin_users;
CREATE POLICY admin_users_admin_select
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ── is_admin() v2: admin_users activo OR email legacy (fallback temporal) ─────
-- SECURITY DEFINER + search_path fijo. Devuelve boolean NO nulo (coalesce) →
-- las policies `USING (is_admin())` y el guard `IS NOT TRUE` siguen seguros.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
    OR lower(coalesce((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()), ''))
       = 'lucianoalonso2000@gmail.com';
$$;

-- ── RPC: el usuario consulta SU propio rol admin (gate UX). No lista admins. ──
CREATE OR REPLACE FUNCTION public.get_my_admin_role()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_admin', public.is_admin(),
    'role', COALESCE(
      (SELECT au.role FROM public.admin_users au
        WHERE au.user_id = auth.uid() AND au.is_active = true
        LIMIT 1),
      CASE WHEN public.is_admin() THEN 'owner_legacy' ELSE NULL END
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_admin_role() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_admin_role() TO authenticated;
-- Supabase concede EXECUTE por default (ALTER DEFAULT PRIVILEGES) a anon en funciones
-- nuevas; el REVOKE FROM public no lo quita. Revocamos anon explícitamente para que
-- solo usuarios autenticados invoquen la RPC (defensa en profundidad — ya filtra por
-- auth.uid(), que es NULL para anon → devuelve {is_admin:false}).
REVOKE EXECUTE ON FUNCTION public.get_my_admin_role() FROM anon;

-- ── Seed: migra al owner actual (por email) a admin_users. Idempotente. ──────
INSERT INTO public.admin_users (user_id, email, role, is_active)
SELECT id, email, 'owner', true
FROM auth.users
WHERE lower(email) = 'lucianoalonso2000@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET role = 'owner', is_active = true, updated_at = now();

COMMENT ON TABLE public.admin_users IS
  'Operadores/admins de Scouttech (Fase 3B). is_admin() valida is_active aquí + fallback legacy temporal por email. Gestión por SQL/dashboard hasta una UI (Fase 3C).';
