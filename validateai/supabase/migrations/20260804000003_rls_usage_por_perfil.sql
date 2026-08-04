-- ============================================================================
-- api_usage_logs: que el dueño pueda VER lo que ya se le está midiendo
-- ============================================================================
--
-- SÍNTOMA: en el portal de Animus no se descuenta nada. La tabla sí registra
-- (3 filas de sesión el 2026-08-04), pero el usuario ve cero.
--
-- CAUSA: la política de lectura sólo contemplaba el camino por API key:
--
--   EXISTS (SELECT 1 FROM api_keys k
--           WHERE k.id = api_usage_logs.api_key_id AND k.profile_id = auth.uid())
--
-- Las migraciones 20260804000001/2 arreglaron la ESCRITURA y dejaron entrar el
-- tráfico de sesión con `api_key_id NULL` + `profile_id` del usuario. Pero con
-- api_key_id nulo, `k.id = NULL` nunca es verdadero, así que esas filas quedaron
-- invisibles para su propio dueño. Se arregló el medidor y se dejó tapiado el
-- visor: desde afuera se ve igual que cuando no se medía nada.
--
-- ARREGLO: el criterio de propiedad es `profile_id`, que es lo que hoy escriben
-- las dos rutas (con API key se guardan AMBOS: la key y el perfil dueño).
--
-- Se conserva además la cláusula vieja sobre api_keys porque las 92 filas
-- anteriores al 2026-05-26 tienen api_key_id pero no profile_id: sin ella,
-- arreglar la visibilidad nueva escondería el historial viejo.
--
-- Las filas anónimas (ambas columnas NULL) siguen sin ser visibles para nadie
-- salvo el service role, que es lo correcto: no son de nadie.

drop policy if exists "Users can view own api usage logs" on public.api_usage_logs;

create policy "Users can view own api usage logs"
  on public.api_usage_logs
  for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.api_keys k
       where k.id = api_usage_logs.api_key_id
         and k.profile_id = auth.uid()
    )
  );

-- El portal filtra por dueño y mes en cada carga; sin esto es un scan completo.
create index if not exists api_usage_logs_perfil_fecha_idx
  on public.api_usage_logs (profile_id, created_at desc)
  where profile_id is not null;
