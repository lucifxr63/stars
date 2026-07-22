-- ============================================================
-- INAPI Records Optimization — Phase 1
-- Goal: recover ~1.5 GB without architecture changes
-- Status (2026-05-28): Steps 1-3 + 6-7 DONE via Management API
-- ============================================================

-- ✅ DONE — Step 1: Dropped 6 unused B-tree indexes (-59 MB)
-- Remaining: inapi_records_pkey (39 MB) + inapi_records_application_number_key (36 MB)
DROP INDEX IF EXISTS inapi_status_idx;
DROP INDEX IF EXISTS inapi_expiration_idx;
DROP INDEX IF EXISTS inapi_type_idx;
DROP INDEX IF EXISTS inapi_country_idx;
DROP INDEX IF EXISTS inapi_ipc_idx;
DROP INDEX IF EXISTS inapi_niza_idx;

-- ✅ DONE — Step 2: Text columns switched to EXTENDED storage (compress before TOAST)
-- Existing TOAST rows get rewritten when VACUUM FULL runs (Step 4)
ALTER TABLE inapi_records ALTER COLUMN label_description     SET STORAGE EXTENDED;
ALTER TABLE inapi_records ALTER COLUMN protection_description SET STORAGE EXTENDED;
ALTER TABLE inapi_records ALTER COLUMN translation            SET STORAGE EXTENDED;
ALTER TABLE inapi_records ALTER COLUMN priorities             SET STORAGE EXTENDED;
ALTER TABLE inapi_records ALTER COLUMN applicants             SET STORAGE EXTENDED;
ALTER TABLE inapi_records ALTER COLUMN representatives        SET STORAGE EXTENDED;
ALTER TABLE inapi_records ALTER COLUMN inventors              SET STORAGE EXTENDED;

-- ✅ DONE — Step 3: Deleted 372K inactive records (876K → 503K rows)
-- Statuses removed: Caducado/a, Denegada, Abandonada, Desistida, Rechazada,
--                   Vencida, Anulada, numeric garbage (4, 5, 2, 9)
DELETE FROM inapi_records
WHERE status IN (
  'Caducado', 'Caducada', 'Denegada', 'Abandonada', 'Desistida',
  'Rechazada', 'Vencida', 'Anulada', '4', '5', '2', '9'
);

-- ✅ DONE — Step 6: Partial B-tree index for active status filter
CREATE INDEX IF NOT EXISTS inapi_active_status_idx
  ON inapi_records (status)
  WHERE status IN ('Registrada', 'En Trámite', 'En trámite',
                   'Esperando renovación', 'Cancelada Voluntariamente');

-- ✅ DONE — Step 7: ANALYZE to update planner stats
ANALYZE inapi_records;

-- ─────────────────────────────────────────────────────────────
-- ⚠️  PENDING — Must run manually from Supabase SQL Editor
--     (API has 60s timeout; these commands need more time)
-- ─────────────────────────────────────────────────────────────

-- Step 4: VACUUM FULL — rewrites table, reclaims ~1.3 GB of disk space
-- Time estimate: 10–25 minutes. Takes exclusive lock → run off-hours.
-- After this, table should drop from 2403 MB to ~1100 MB.
VACUUM FULL ANALYZE inapi_records;

-- Step 5: HNSW vector index — enables fast similarity search on brand names
-- Without this, every match_brand_name() call is a full seq scan of 503K rows.
-- Time estimate: 5–15 minutes for 117K vectors.
CREATE INDEX IF NOT EXISTS inapi_brand_embedding_hnsw_idx
  ON inapi_records
  USING hnsw (brand_name_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE brand_name_embedding IS NOT NULL;
