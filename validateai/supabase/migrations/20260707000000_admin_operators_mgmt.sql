-- ============================================================
-- Gestión de operadores admin (Pilotos Fase 3C)
-- ============================================================
-- Reemplaza la gestión manual por SQL de `public.admin_users` por RPCs seguras,
-- usadas por la UI `/admin → Operadores`. NO toca `is_admin()`, ni la RLS de
-- `pilots`, ni la policy SELECT existente de admin_users.
--
-- Modelo de permisos:
--   - Cualquier admin puede LEER la lista (policy admin_users_admin_select ya existe).
--   - Solo un OWNER activo puede agregar / desactivar / cambiar rol (RPCs con guard
--     is_owner()). SECURITY DEFINER → resuelve email→user_id en auth.users (el cliente
--     no puede) y aplica protecciones anti-lockout (último owner).
--
-- NO aplicar a producción sin revisión/staging explícito.
-- ============================================================

-- ── is_owner(): owner activo en admin_users OR email legacy (fallback temporal) ──
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true AND au.role = 'owner'
    )
    OR lower(coalesce((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()), ''))
       = 'lucianoalonso2000@gmail.com';
$$;

-- ── Agregar operador por email (debe tener cuenta en auth.users) ────────────────
CREATE OR REPLACE FUNCTION public.admin_add_operator(p_email text, p_role text DEFAULT 'operator')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid; v_email text;
BEGIN
  IF NOT public.is_owner() THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF p_role NOT IN ('owner', 'admin', 'operator') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_role'); END IF;

  SELECT id, email INTO v_uid, v_email FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'user_not_found'); END IF;

  INSERT INTO public.admin_users (user_id, email, role, is_active)
  VALUES (v_uid, v_email, p_role, true)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Activar / desactivar operador (protege al último owner activo) ─────────────
CREATE OR REPLACE FUNCTION public.admin_set_operator_active(p_user_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;

  IF NOT p_active
     AND (SELECT role FROM public.admin_users WHERE user_id = p_user_id) = 'owner'
     AND (SELECT count(*) FROM public.admin_users WHERE role = 'owner' AND is_active = true) <= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'last_owner');
  END IF;

  UPDATE public.admin_users SET is_active = p_active, updated_at = now() WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Cambiar rol (protege al último owner activo) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_operator_role(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF p_role NOT IN ('owner', 'admin', 'operator') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_role'); END IF;

  IF p_role <> 'owner'
     AND (SELECT role FROM public.admin_users WHERE user_id = p_user_id) = 'owner'
     AND (SELECT count(*) FROM public.admin_users WHERE role = 'owner' AND is_active = true) <= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'last_owner');
  END IF;

  UPDATE public.admin_users SET role = p_role, updated_at = now() WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grants: self-guardadas por is_owner(); solo authenticated (nunca anon/public).
REVOKE ALL ON FUNCTION public.is_owner()                                   FROM public;
REVOKE ALL ON FUNCTION public.admin_add_operator(text, text)              FROM public;
REVOKE ALL ON FUNCTION public.admin_set_operator_active(uuid, boolean)    FROM public;
REVOKE ALL ON FUNCTION public.admin_set_operator_role(uuid, text)         FROM public;
GRANT EXECUTE ON FUNCTION public.is_owner()                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_operator(text, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_operator_active(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_operator_role(uuid, text)      TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_owner()                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_add_operator(text, text)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_operator_active(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_operator_role(uuid, text)     FROM anon;
