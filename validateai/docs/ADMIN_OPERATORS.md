# Operadores / Admins de Scouttech (multi-admin)

> Pilotos Fase 3B (2026-07). Reemplaza el `public.is_admin()` de email hardcodeado por
> un modelo escalable basado en la tabla `public.admin_users`, sin romper las policies
> existentes que dependen de `is_admin()`.

## Qué es `public.admin_users`

Tabla que lista los operadores con acceso admin.

| Columna | Detalle |
|---|---|
| `user_id` | FK a `auth.users` (único). Fuente de verdad de identidad. |
| `email` | Contacto/identificación (único case-insensitive). |
| `role` | `owner` \| `admin` \| `operator` (CHECK). |
| `is_active` | `true` = admin activo. `false` = desactivado (pierde acceso). |
| `created_at` / `updated_at` | Auditoría (trigger `set_updated_at`). |

**RLS**: solo admins pueden `SELECT` (`USING (public.is_admin())`). **No hay** policies de
`INSERT/UPDATE/DELETE` para clientes → los operadores se gestionan por SQL / Supabase
dashboard (service_role bypasea RLS). Una UI de gestión llega en Fase 3C.

## Cómo decide `is_admin()`

```
is_admin() = (existe en admin_users con is_active = true)  OR  (email == legacy)
```
`SECURITY DEFINER` + `search_path = public`, devuelve boolean no-nulo. El fallback por
email legacy (`lucianoalonso2000@gmail.com`) es **TEMPORAL** para no bloquear al owner
durante la transición; se retira cuando `admin_users` sea la única fuente.

> **Sin recursión**: como `is_admin()` es `SECURITY DEFINER`, corre como owner y al leer
> `admin_users` bypasea su RLS. Por eso la policy `admin_users_admin_select` puede usar
> `is_admin()` sin loop.

## Gate del frontend

`useAdminRole()` (hook) consulta la RPC segura `get_my_admin_role()` → `{ is_admin, role }`
(no lista admins). Lo usan `/admin` (redirige a no-admins), el `Header` y el `Sidebar`
(muestran el link "Admin"). La **seguridad real es la RLS**; el gate es solo UX. Si la RPC
aún no existe (migración no aplicada), cae al chequeo legacy por email.

## Agregar un operador (por SQL)

```sql
insert into public.admin_users (user_id, email, role, is_active)
select id, email, 'operator', true
from auth.users
where lower(email) = 'nuevo.operador@ejemplo.cl'
on conflict (user_id) do update set is_active = true, role = 'operator', updated_at = now();
```
(El usuario debe tener cuenta en `auth.users`; que se registre primero.)

## Desactivar un operador

```sql
update public.admin_users set is_active = false, updated_at = now()
where lower(email) = 'operador@ejemplo.cl';
```
Si el operador coincide con el email legacy, seguirá siendo admin por el fallback hasta
que este se retire.

## Roles

- `owner`: dueño(s). `admin` / `operator`: operadores. Hoy **todos tienen el mismo acceso**
  (la RLS solo distingue admin / no-admin); el `role` es informativo para una futura
  jerarquía (Fase 3C).

## Riesgos / notas

- **Fallback legacy temporal**: documentado; retirar cuando todos los operadores estén en
  `admin_users` (editar `is_admin()` para quitar el `OR email == legacy`).
- **`admin_users` no es listable** por usuarios normales (RLS admin-only).
- Cambiar `is_admin()` afecta a TODAS las policies que dependen de ella (profiles,
  validations, ai_interactions, report_feedback, pilots, get_feedback_digest) — es
  backward-compatible (superset del comportamiento legacy).

## Rollback

```sql
-- Volver al is_admin() legacy (solo email) y quitar el modelo multi-admin:
create or replace function public.is_admin() returns boolean
language plpgsql security definer as $$
begin
  return (select email = 'lucianoalonso2000@gmail.com' from auth.users where id = auth.uid());
end; $$;
drop function if exists public.get_my_admin_role();
drop table if exists public.admin_users cascade;
```
