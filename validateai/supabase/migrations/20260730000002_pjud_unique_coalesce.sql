-- ============================================================
-- Corrige la unicidad de pjud_estadisticas: NULL no colisiona consigo mismo
--
-- La constraint original era UNIQUE (serie, anio, categoria, subcategoria). En
-- Postgres dos NULL nunca son iguales dentro de un índice único, así que toda
-- fila con `anio` NULL (las series de Cuenta Pública) o `subcategoria` NULL
-- (casi todas) NUNCA hacía match en el ON CONFLICT y se re-insertaba completa
-- en cada corrida.
--
-- Efecto medido el 2026-07-30 tras dos ingestas: cuenta-publica/terminos-cortes
-- pasó de 17 a 34 filas, ingresos-causas de 6 a 12, etc. — todo duplicado.
--
-- Se reemplaza por un índice sobre expresiones con COALESCE, que sí colisiona.
-- El job debe usar exactamente la misma expresión en su ON CONFLICT.
--
-- Antes de crear el índice hay que deduplicar: se conserva la fila más
-- recientemente actualizada de cada grupo.
-- ============================================================

-- ── 1. Deduplicar lo ya insertado ────────────────────────────────────────────
DELETE FROM public.pjud_estadisticas a
 USING public.pjud_estadisticas b
 WHERE a.ctid < b.ctid
   AND a.serie = b.serie
   AND COALESCE(a.anio, -1) = COALESCE(b.anio, -1)
   AND a.categoria = b.categoria
   AND COALESCE(a.subcategoria, '') = COALESCE(b.subcategoria, '');

-- ── 2. Reemplazar la constraint por un índice que trate NULL como valor ──────
ALTER TABLE public.pjud_estadisticas
  DROP CONSTRAINT IF EXISTS pjud_estadisticas_unica;

CREATE UNIQUE INDEX IF NOT EXISTS pjud_estadisticas_unica
  ON public.pjud_estadisticas
     (serie, COALESCE(anio, -1), categoria, COALESCE(subcategoria, ''));

-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT serie, count(*)::int AS filas
  FROM public.pjud_estadisticas
 GROUP BY serie ORDER BY serie;
