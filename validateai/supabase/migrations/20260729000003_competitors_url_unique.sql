-- ============================================================
-- Unicidad por URL en `competitors`
--
-- El descubrimiento vía SerpApi (_shared/competitorDiscovery.ts) hace UPSERT
-- con onConflict='url' para que reencontrar la misma empresa refresque su
-- ficha en vez de duplicarla. Sin esta constraint, ese upsert falla en runtime
-- ("no unique or exclusion constraint matching the ON CONFLICT specification").
--
-- Índice PARCIAL: `url` es nullable y el seed manual (seedCompetitors.ts) podría
-- traer fichas sin URL. En Postgres varios NULL no colisionan entre sí, pero el
-- WHERE lo deja explícito y mantiene el índice chico.
--
-- La tabla está vacía en producción al aplicar esto, así que no hay riesgo de
-- que la creación falle por duplicados preexistentes.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS competitors_url_unique
  ON public.competitors (url)
  WHERE url IS NOT NULL;
