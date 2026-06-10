-- ============================================================================
-- MIGRACIÓN: Sprint MoE-4
-- Ejecutar en: Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Entorno: aplicar primero en staging, luego en producción
-- Prerrequisito: extensión pgvector ya activa (verificar con \dx)
-- ============================================================================


-- ── 1. Índice ivfflat para búsqueda vectorial eficiente ───────────────────────
--
-- SIN este índice: search_hybrid_graphrag hace un full-table scan en el path
-- VECTOR (O(n) coseno en memoria). Con 2K nodos es tolerable; con 30K nodos
-- la latencia sube a 2-5 segundos y el fallback Python (_vector_search_direct)
-- colapsa por RAM.
--
-- CON este índice: Postgres evalúa coseno en O(sqrt(n)) usando IVF clustering.
-- Latencia VECTOR: ~5ms independiente del tamaño del grafo.
--
-- Parámetro `lists`:
--   Regla: lists ≈ sqrt(total_nodos)
--   Actual (305 nodos) → lists = 20  (mínimo recomendado pgvector)
--   Futuro (30K nodos) → lists = 173 (ajustar con ALTER INDEX o recrear)
--
-- IMPORTANTE: CREATE INDEX no bloquea lecturas en Postgres, pero sí es
-- intensivo en CPU durante la construcción. Ejecutar en ventana de bajo tráfico.
-- En producción con datos en vivo, usar: CREATE INDEX CONCURRENTLY ...

CREATE INDEX IF NOT EXISTS knowledge_nodes_embedding_ivfflat_idx
    ON knowledge_nodes
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 20);

-- Verificar que el índice se creó correctamente:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'knowledge_nodes'
--   AND indexname = 'knowledge_nodes_embedding_ivfflat_idx';


-- ── 2. Tabla de audit log del GatingNetwork ───────────────────────────────────
--
-- Cada llamada a POST /query/moe persiste una fila aquí (background task,
-- non-blocking). Los analistas pueden consultar esta tabla para:
--   a) Ver qué método de routing predomina (keyword vs semantic)
--   b) Detectar expertos que siempre ganan → candidatos a recibir más nodos
--   c) Correlacionar graph_hits/vector_hits con calidad percibida
--   d) Ajustar match_threshold por expert_id en experts.py
--
-- Retención: las filas pueden borrarse cada 90 días (son logs, no datos de negocio).

CREATE TABLE IF NOT EXISTS moe_routing_log (
    id              bigserial PRIMARY KEY,
    created_at      timestamptz NOT NULL DEFAULT now(),
    query_preview   text        NOT NULL,           -- Primeros 300 chars de la query
    routing_method  text        NOT NULL,           -- keyword | semantic | keyword+context | fallback
    routing_reason  text        NOT NULL,           -- Traza completa del GatingNetwork
    experts_activated text[]    NOT NULL DEFAULT '{}',  -- ["legal", "unit_economics"]
    graph_hits      int         NOT NULL DEFAULT 0,
    vector_hits     int         NOT NULL DEFAULT 0,
    total_hits      int         NOT NULL DEFAULT 0
);

-- Índice para consultas de análisis frecuentes
CREATE INDEX IF NOT EXISTS moe_routing_log_created_at_idx
    ON moe_routing_log (created_at DESC);

CREATE INDEX IF NOT EXISTS moe_routing_log_routing_method_idx
    ON moe_routing_log (routing_method);

-- Índice GIN para buscar por experto activado (array containment)
-- Ejemplo: SELECT * FROM moe_routing_log WHERE experts_activated @> '{legal}';
CREATE INDEX IF NOT EXISTS moe_routing_log_experts_gin_idx
    ON moe_routing_log USING gin (experts_activated);


-- ── 3. RLS: la tabla es solo de escritura desde el service role ───────────────
--
-- Los analistas la consultan desde Supabase Studio o via SQL directo.
-- El API solo inserta (nunca lee desde el endpoint).

ALTER TABLE moe_routing_log ENABLE ROW LEVEL SECURITY;

-- Service role puede insertar y leer (usado por la Edge Function y el worker)
CREATE POLICY "service_role_all" ON moe_routing_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Anon/authenticated: sin acceso (datos de auditoría internos)
-- Si en el futuro quieres un dashboard analítico con RLS granular,
-- agregar: CREATE POLICY "analyst_read" ON moe_routing_log FOR SELECT TO authenticated ...


-- ── 4. Vista analítica para refinamiento de match_threshold ──────────────────
--
-- Consulta rápida para la Mesa Directiva:
--   SELECT * FROM moe_routing_summary ORDER BY calls DESC;

CREATE OR REPLACE VIEW moe_routing_summary AS
SELECT
    routing_method,
    unnest(experts_activated)           AS expert_id,
    count(*)                            AS calls,
    round(avg(graph_hits)::numeric, 1)  AS avg_graph_hits,
    round(avg(vector_hits)::numeric, 1) AS avg_vector_hits,
    round(avg(total_hits)::numeric, 1)  AS avg_total_hits,
    min(created_at)                     AS first_call,
    max(created_at)                     AS last_call
FROM moe_routing_log
GROUP BY routing_method, expert_id;


-- ── Rollback (guardar antes de ejecutar en producción) ────────────────────────
--
-- DROP INDEX IF EXISTS knowledge_nodes_embedding_ivfflat_idx;
-- DROP TABLE IF EXISTS moe_routing_log;
-- DROP VIEW IF EXISTS moe_routing_summary;
