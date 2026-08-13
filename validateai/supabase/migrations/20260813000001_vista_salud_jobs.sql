-- Salud de los jobs de ingesta, accesible desde PostgREST.
--
-- `mp_job_health_resumen` vive en el esquema `licitus` (la tabla foránea del
-- otro proyecto de Animus, montada por postgres_fdw). **PostgREST sólo sirve el
-- esquema `public`**, así que cualquier Edge Function que la consulte por el
-- cliente de Supabase recibe un error de relación inexistente — no un permiso
-- denegado, que sería más fácil de leer.
--
-- Es exactamente el motivo por el que ya existían `public.mp_ordenes_compra` y
-- `…_items` (migración 20260805000007). Faltaba ésta, y se notó cuando
-- `reporte-extracciones` la pidió: el parte salía informando un problema que era
-- suyo, no de los jobs.
--
-- La vista es un espejo sin lógica a propósito: el diagnóstico lo calcula
-- mp-sync, que es quien sabe qué significa cada estado. Duplicar ese criterio
-- acá crearía dos verdades sobre la misma pregunta.
create or replace view public.mp_job_health_resumen as
select * from licitus.mp_job_health_resumen;

comment on view public.mp_job_health_resumen is
  'Espejo de licitus.mp_job_health_resumen para PostgREST, que sólo sirve el esquema public. '
  'Mide si los jobs PRODUJERON, no si terminaron: un job puede cerrar en verde y no traer una fila.';


-- ── Salud de los crons que llaman por HTTP ──────────────────────────────────
--
-- `pg_cron` dispara Edge Functions con `net.http_post`, y el resultado queda en
-- `net._http_response`. Si esa llamada devuelve 401 no falla nada visible: el
-- cron figura como ejecutado, la función nunca corre, y nadie se entera.
--
-- Al escribir este reporte aparecieron **72 respuestas 401 en 6 horas** — un
-- cron pegando cada 5 minutos contra una función que lo rechaza, en silencio.
-- Ese es justamente el fallo que el canal de extracciones existe para atrapar,
-- así que se expone.
--
-- Se agrega SOLO el conteo por código: `net._http_response.content` puede traer
-- cuerpos de respuesta y los `headers` llevan la service role key con la que se
-- hizo la llamada. Publicar la tabla entera por PostgREST filtraría credenciales
-- a cualquiera con acceso al esquema public.
create or replace view public.cron_http_salud as
select
  status_code,
  count(*)                       as respuestas,
  min(created)                   as desde,
  max(created)                   as hasta
from net._http_response
where created > now() - interval '24 hours'
group by status_code;

comment on view public.cron_http_salud is
  'Conteo por código HTTP de las llamadas que pg_cron hizo en 24 h. Sin content ni headers a '
  'propósito: esos campos traen cuerpos de respuesta y la service role key de la llamada.';
