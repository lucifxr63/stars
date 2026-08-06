-- 20260805000006_salud_unificada.sql
--
-- Una sola consulta para «¿qué está muerto?» en TODO Animus.
--
-- POR QUÉ
-- -------
-- `job_health_resumen` sólo veía los jobs del worker de Bralidus: 3 filas. Los
-- 11 de mp-sync —que traen el 99 % del volumen del producto— llevaban su propio
-- registro en el otro proyecto, y desde acá eran invisibles. Durante la
-- auditoría del 2026-08-05 eso me llevó a concluir que mp-sync no tenía
-- monitoreo. Lo tiene, y mide MÁS que el de Bralidus: además de rachas vacías,
-- detecta corridas huérfanas —las que empiezan y nunca terminan— y fallos
-- reales de los últimos 7 días.
--
-- Con la migración anterior (FDW) esa vista quedó accesible como
-- `licitus.mp_job_health_resumen`. Acá se unen las dos.
--
--     antes:  3 jobs visibles
--     ahora: 14 jobs visibles
--
-- COSTO
-- -----
-- Consultar esta vista abre una conexión al otro proyecto. Son 11 filas de una
-- vista ya agregada del otro lado: despreciable. No usar dentro de un bucle.

begin;

create or replace view public.salud_jobs_animus as
  select 'bralidus'::text                      as servicio,
         jhr.job_id                            as job,
         jhr.estado                            as diagnostico,
         jhr.dias_sin_producir::numeric        as dias_sin_producir,
         jhr.last_run                          as ultima_corrida,
         jhr.last_success                      as ultima_productiva,
         null::bigint                          as huerfanas_7d
    from public.job_health_resumen jhr
  union all
  select 'mp-sync',
         mp.job_name,
         mp.diagnostico,
         round(mp.dias_sin_producir::numeric, 2),
         mp.ultima_corrida,
         mp.ultima_productiva,
         mp.huerfanas_7d
    from licitus.mp_job_health_resumen mp;

comment on view public.salud_jobs_animus is
  'Salud de TODOS los jobs de Animus: worker de Bralidus (local) + mp-sync '
  '(proyecto szzibobuwgcopewmnkkl vía FDW). Reemplaza mirar job_health_resumen '
  'sola, que sólo veía 3 de 14. Ver 20260805000005.';

-- Sólo el gateway y las herramientas de operación. Un cliente de la API no
-- tiene por qué ver el estado interno de nuestra ingesta.
revoke all on public.salud_jobs_animus from public, anon, authenticated;
grant select on public.salud_jobs_animus to service_role;

commit;

-- Uso:
--   select * from public.salud_jobs_animus
--    where diagnostico <> 'ok'
--    order by dias_sin_producir desc nulls last;
