-- ============================================================
-- Test de aislamiento RLS — esquema cashflow
-- ============================================================
-- Criterio del hito: "Cero fugas de datos entre inquilinos; pruebas
-- de lectura cruzada deben FALLAR" (no devolver filas de otro usuario).
--
-- Cómo correrlo (local):
--   supabase db reset            # aplica migraciones limpias
--   psql "$DATABASE_URL" -f supabase/tests/cashflow_rls_isolation.sql
--
-- El script se ejecuta dentro de una transacción que se revierte al
-- final (rollback), así no deja datos. Simula a dos usuarios fijando
-- el rol `authenticated` y el claim JWT `sub` (lo que lee auth.uid()).
-- Falla con excepción si alguna aserción no se cumple.
-- ============================================================

begin;

-- Dos usuarios sintéticos en auth.users (el trigger crea sus profiles).
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000aa', 'user_a@test.local'),
  ('00000000-0000-0000-0000-0000000000bb', 'user_b@test.local')
on conflict (id) do nothing;

-- Helper: ponerse en la piel de un usuario autenticado.
create or replace function pg_temp.act_as(uid uuid) returns void as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
end;
$$ language plpgsql;

-- ── Usuario A crea una categoría y una transacción ──────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000000aa');

insert into cashflow.categories (id, auth_user_id, name, kind)
values ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-0000000000aa', 'Ventas', 'income');

insert into cashflow.transactions (auth_user_id, category_id, amount, kind, description)
values ('00000000-0000-0000-0000-0000000000aa',
        '11111111-1111-1111-1111-111111111111', 1500.00, 'income', 'Factura A');

-- A se ve a sí mismo: debe contar 1.
do $$
declare n int;
begin
  select count(*) into n from cashflow.transactions;
  if n <> 1 then
    raise exception 'FALLO: usuario A debería ver 1 transacción propia, vio %', n;
  end if;
  raise notice 'OK: usuario A ve sus % transacción(es) propias', n;
end $$;

-- ── Usuario B intenta leer los datos de A (lectura cruzada) ──
select pg_temp.act_as('00000000-0000-0000-0000-0000000000bb');

do $$
declare n int;
begin
  -- Cross-read de transactions debe devolver 0 filas.
  select count(*) into n from cashflow.transactions;
  if n <> 0 then
    raise exception 'FUGA DE DATOS: usuario B vio % transacción(es) de A', n;
  end if;
  raise notice 'OK: usuario B no ve transacciones de A (cross-read = 0)';

  -- Cross-read de categories debe devolver 0 filas.
  select count(*) into n from cashflow.categories;
  if n <> 0 then
    raise exception 'FUGA DE DATOS: usuario B vio % categoría(s) de A', n;
  end if;
  raise notice 'OK: usuario B no ve categorías de A (cross-read = 0)';

  -- Cross-read de profiles: B solo debe verse a sí mismo (0 ó 1, nunca el de A).
  select count(*) into n from cashflow.profiles
    where id = '00000000-0000-0000-0000-0000000000aa';
  if n <> 0 then
    raise exception 'FUGA DE DATOS: usuario B vio el profile de A';
  end if;
  raise notice 'OK: usuario B no ve el profile de A';
end $$;

-- ── B no puede ESCRIBIR en nombre de A (WITH CHECK) ─────────
do $$
begin
  begin
    insert into cashflow.transactions (auth_user_id, amount, kind)
    values ('00000000-0000-0000-0000-0000000000aa', 99.00, 'expense');
    raise exception 'FUGA DE DATOS: usuario B insertó una transacción a nombre de A';
  exception when insufficient_privilege or check_violation then
    raise notice 'OK: WITH CHECK bloqueó a B escribir a nombre de A';
  end;
end $$;

reset role;
rollback;

\echo '============================================'
\echo ' Test RLS cashflow: TODAS las aserciones OK '
\echo '============================================'
