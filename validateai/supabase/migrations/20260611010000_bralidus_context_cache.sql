-- ============================================================
-- Bralidus Integration — Fase 2: caché de contexto por PERFIL
-- ============================================================
-- Cachea el contexto Bralidus (macro + doctrina) por 4-tupla normalizada
-- (scope, industry, stage, geography). NO por idea: el contexto de un perfil
-- es idéntico entre todas las ideas con ese perfil y entre los prompts del
-- wizard, así que el usuario B aprovecha el pull que pagó el usuario A.
--
-- TTL híbrido:
--   - Correctness = lazy-on-read: las lecturas filtran `expires_at > now()`.
--     Nunca depende de un cron.
--   - Tamaño = UPSERT sobre keyspace acotado (decenas de perfiles × pocos
--     scopes): las filas expiradas se SOBRESCRIBEN en el próximo acceso, no
--     se acumulan. La tabla se auto-acota. (Sin pg_cron.)
--   - Higiene opcional: un DELETE semanal desde un cron edge basta.
--
-- Seguridad: RLS deny-all a clientes (patrón usage_counters). Acceso solo vía
-- las edge functions con service role (bypassa RLS).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bralidus_context_cache (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clave de perfil normalizada (lowercase). 'scope' = identidad del pull Bralidus.
  scope          text NOT NULL,            -- 'macro' | 'macro_riesgo' | 'expert_unit_economics' | 'expert_legal' | ...
  industry       text NOT NULL,
  stage          text NOT NULL DEFAULT 'seed',
  geography      text NOT NULL DEFAULT 'chile',
  -- Payload: markdown listo para inyectar + estructurado (insumo EvidenceWall, Fase 3).
  context_block  text  NOT NULL,
  evidence       jsonb NOT NULL DEFAULT '[]'::jsonb,
  experts        jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_freshness jsonb,
  node_count     int   NOT NULL DEFAULT 0,
  hit_count      int   NOT NULL DEFAULT 0,  -- ROI del caché (cuántas lecturas reusaron esta fila)
  created_at     timestamptz NOT NULL DEFAULT now(),
  refreshed_at   timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,      -- TTL decidido al ESCRIBIR (por scope)
  CONSTRAINT bralidus_cache_profile_uniq UNIQUE (scope, industry, stage, geography)
);

-- El UNIQUE (btree) ya sirve el lookup exacto por 4-tupla. Índice extra solo para el barrido por TTL.
CREATE INDEX IF NOT EXISTS bralidus_cache_expires_idx
  ON public.bralidus_context_cache (expires_at);

-- RLS deny-all a clientes. Acceso legítimo solo vía service role en edge functions.
ALTER TABLE public.bralidus_context_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bralidus_cache_no_direct_access" ON public.bralidus_context_cache;
CREATE POLICY "bralidus_cache_no_direct_access"
  ON public.bralidus_context_cache
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Incremento atómico de hit_count (PostgREST no expresa `col = col + 1`).
-- SECURITY DEFINER para que la edge function lo invoque sin permisos directos sobre la tabla.
-- Fire-and-forget desde getCachedBralidusContext — no bloquea la lectura.
CREATE OR REPLACE FUNCTION public.bump_bralidus_cache_hit(
  p_scope text, p_industry text, p_stage text, p_geo text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bralidus_context_cache
  SET hit_count = hit_count + 1
  WHERE scope = p_scope AND industry = p_industry AND stage = p_stage AND geography = p_geo;
$$;

REVOKE ALL ON FUNCTION public.bump_bralidus_cache_hit(text, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_bralidus_cache_hit(text, text, text, text) TO service_role;
