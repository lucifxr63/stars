-- 20260805000005_fdw_licitus.sql
--
-- Trae las tablas del segundo proyecto de Animus DENTRO de esta base, como
-- tablas foráneas. No copia datos: se leen en vivo.
--
-- ⚠️ NO SE APLICA SOLA. Necesita la contraseña del proyecto origen. Ver
--    «CÓMO APLICARLA» al final.
--
-- EL PROBLEMA
-- -----------
-- Animus tiene DOS proyectos Supabase y el gateway sólo consulta uno:
--
--   fcdhcntyvsydnvjwopfe  (este)  licitaciones_mercado_publico, mp_ofertas,
--                                 pjud_suprema_detalle, knowledge_nodes…
--   szzibobuwgcopewmnkkl  (otro)  purchase_orders, purchase_order_items,
--                                 opportunities, buyer_*, supplier_*
--
-- El segundo se llama «Licitus» en el código por herencia —en el dashboard
-- figura como `validateai-knowledge-vault`— pero **es de Animus**. Licitus es
-- un consumidor, no el dueño. Por eso `GET /api/v1/mercado-publico/ordenes-compra`
-- responde 501: el dato existe y está a un `select` de distancia, sólo que en
-- el otro proyecto.
--
-- POR QUÉ FDW Y NO LAS ALTERNATIVAS
-- ---------------------------------
--   * Dual-write desde mp-sync — duplica el dato y, peor, obligaría a meter las
--     órdenes en `licitaciones_mercado_publico`, que modela MECANISMOS DE
--     CONTRATACIÓN, no órdenes post-adjudicación. Sería romper un modelo
--     correcto por una razón de plomería.
--   * Proxy HTTP — no existe el endpoint del otro lado, y agregaría una
--     dependencia de red en el camino caliente para leer una base propia.
--   * Segundo cliente Supabase en la Edge Function — funciona (lo hace
--     `inapi-fetch`) pero deja el dato fuera de SQL: no se puede unir con
--     `mp_ofertas` ni con `licitaciones_mercado_publico` en una sola consulta,
--     que es justo lo que hace valioso cruzar una orden con su licitación.
--
-- Con FDW el dato **está en esta base** a efectos de consulta: se puede unir,
-- agregar y exponer como cualquier tabla local.
--
-- VERIFICADO ANTES DE ESCRIBIR ESTO
-- ---------------------------------
--   * `postgres_fdw` disponible (1.1); `dblink`, `http` y `wrappers` también.
--   * El rol de la conexión PUEDE crear la extensión, el servidor y el user
--     mapping — probado contra esta misma base en una transacción con ROLLBACK,
--     que no dejó residuo.
--   * No hay ningún servidor foráneo ni tabla foránea montada hoy.
--   * `service_role`, `anon` y `authenticated` existen como roles.
--   * `pg_cron` 1.6.4 ya está instalado, con 6 jobs andando — o sea que el plan
--     B (materializar) no necesita infraestructura nueva tampoco.
--
-- LA TRAMPA DEL POOLER, QUE CUESTA UNA TARDE
-- ------------------------------------------
-- Los dos proyectos NO usan el mismo modo de pooler:
--
--     szzibobuwgcopewmnkkl → puerto 5432 (SESSION)
--     fcdhcntyvsydnvjwopfe → puerto 6543 (TRANSACTION)
--
-- En el proyecto origen el 6543 está deshabilitado y responde
-- «password authentication failed» — o sea que un puerto equivocado se ve
-- exactamente igual que una credencial equivocada. Acá va 5432 a propósito.
--
-- Además, FDW abre sus propias conexiones y las mantiene: el modo SESSION es
-- justamente el que corresponde.

begin;

-- ── 1. La extensión ──────────────────────────────────────────────────────

create extension if not exists postgres_fdw;

-- ── 2. El servidor foráneo ───────────────────────────────────────────────

drop server if exists licitus cascade;

create server licitus
  foreign data wrapper postgres_fdw
  options (
    host 'aws-1-us-east-2.pooler.supabase.com',
    port '5432',                       -- SESSION. Ver la nota del pooler.
    dbname 'postgres',
    -- Sin esto, una consulta lenta del otro lado cuelga a ésta sin límite.
    connect_timeout '10',
    -- Le dice al planificador que el otro extremo es remoto y que conviene
    -- empujarle los filtros en vez de traerse la tabla entera.
    fetch_size '10000',
    updatable 'false'                  -- SÓLO LECTURA. Quien escribe es mp-sync.
  );

-- ── 3. Quién se conecta ──────────────────────────────────────────────────
--
-- La contraseña queda en el user mapping. `pg_user_mappings` la oculta a todo
-- rol que no sea el dueño o superusuario, así que no queda legible para
-- `anon` ni `authenticated`.
--
-- ⚠️ Reemplazar CONTRASENA_DEL_PROYECTO_ORIGEN antes de aplicar.

create user mapping for current_user
  server licitus
  options (
    user 'postgres.szzibobuwgcopewmnkkl',
    password 'CONTRASENA_DEL_PROYECTO_ORIGEN'
  );

-- El service_role también necesita su mapeo: es el rol con el que consulta el
-- gateway. Sin esto, las tablas foráneas fallan con «user mapping not found».
create user mapping for service_role
  server licitus
  options (
    user 'postgres.szzibobuwgcopewmnkkl',
    password 'CONTRASENA_DEL_PROYECTO_ORIGEN'
  );

-- ── 4. Dónde aterrizan ───────────────────────────────────────────────────
--
-- Esquema propio y no `public`: que se vea de un vistazo qué vive en el otro
-- proyecto. Una tabla foránea que parece local es una trampa para el próximo
-- que mire un plan de ejecución lento.

create schema if not exists licitus;
comment on schema licitus is
  'Tablas foráneas del proyecto szzibobuwgcopewmnkkl (dashboard: validateai-knowledge-vault). '
  'Se leen en vivo por postgres_fdw; NO son copias. Escribe mp-sync, acá son de sólo lectura.';

-- ── 5. Traer sólo lo que se usa ──────────────────────────────────────────
--
-- `LIMIT TO` a propósito: el proyecto origen también tiene `inapi_records`
-- (1,28 GB) y no hay razón para exponerlo acá. Importar es metadato, no datos,
-- pero una tabla foránea de más es superficie de más.

-- La lista se verificó contra el catálogo del origen: son objetos que existen.
-- Se deja afuera `inapi_records` (1,28 GB) a propósito — ya tiene su propio
-- camino por la Edge Function `inapi-fetch`, y no hay razón para exponerlo acá.
import foreign schema public
  limit to (purchase_orders, purchase_order_items,
            opportunities, opportunity_items,
            buyer_profiles, buyer_context_cache, buyer_reputation,
            buyer_winning_suppliers,
            supplier_profiles, supplier_categories, supplier_keywords,
            sync_logs, mp_job_health_resumen)
  from server licitus
  into licitus;

-- `mp_job_health_resumen` es el regalo de esta migración y conviene no pasarlo
-- por alto: mp-sync SÍ lleva registro de salud de sus 11 jobs —los que traen
-- el 99 % del volumen del producto— sólo que en el otro proyecto, y por eso
-- `job_health` de esta base sólo tiene 3 filas y parecía que mp-sync no
-- reportaba nada. Traerla acá pone a los dos servicios bajo una sola consulta:
--
--     select * from job_health_resumen
--     union all
--     select * from licitus.mp_job_health_resumen;

-- ── 6. Permisos ──────────────────────────────────────────────────────────
--
-- Sólo el gateway. `anon` y `authenticated` no tienen nada que hacer acá: el
-- acceso de clientes pasa por la API con su cuota, no por PostgREST directo.

revoke all on schema licitus from public, anon, authenticated;
grant usage on schema licitus to service_role;
grant select on all tables in schema licitus to service_role;
alter default privileges in schema licitus grant select on tables to service_role;

commit;

-- ─────────────────────────────────────────────────────────────────────────
-- CÓMO APLICARLA
-- ─────────────────────────────────────────────────────────────────────────
--
--  1. Sacar la contraseña del proyecto szzibobuwgcopewmnkkl
--     (Dashboard → Project Settings → Database) y reemplazar las DOS
--     apariciones de CONTRASENA_DEL_PROYECTO_ORIGEN.
--
--  2. Aplicar:
--       npx supabase db query --linked --file supabase/migrations/20260805000005_fdw_licitus.sql
--
--  3. VERIFICAR EL EFECTO, no el status. Que la migración no falle sólo
--     significa que el servidor quedó definido: FDW no conecta hasta la
--     primera consulta.
--
--       select count(*) from licitus.purchase_orders;
--       select max(created_at) from licitus.purchase_orders;
--
--     Si eso devuelve un número, está funcionando de verdad.
--
--  4. Medir la latencia antes de construir encima:
--
--       explain (analyze, verbose) select count(*) from licitus.purchase_orders;
--
--     Si una consulta típica del gateway tarda más de ~300 ms, materializar
--     con `pg_cron` —ya instalado, con 6 jobs andando— en vez de leer en vivo.
--
--  5. NO commitear la contraseña. Aplicar con el valor reemplazado y dejar el
--     archivo del repositorio con el placeholder.
