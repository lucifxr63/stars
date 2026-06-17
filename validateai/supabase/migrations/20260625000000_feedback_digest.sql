-- ============================================================
-- Digest de feedback — cerrar el loop para refinar el RAG (#4)
-- ============================================================
-- report_feedback ya captura la señal (rating, dimensions_wrong, free_text),
-- pero hasta ahora solo se veía cruda. Esta RPC la agrega SERVER-SIDE sobre
-- TODO el histórico (no las últimas N filas) en una worklist accionable:
--   - by_dimension: qué se corrige más (prioridad de fix en el vault)
--   - by_section:   qué secciones tienen peor rating
--   - recent_low:   reportes mal valorados + comentario (casos a revisar)
-- Admin-only (is_admin()) — mismo criterio que el panel /admin.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_feedback_digest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- IS NOT TRUE (no "NOT is_admin()"): is_admin() devuelve NULL cuando auth.uid()
  -- es nulo (request anónimo) y "NOT NULL" = NULL no levantaría la excepción → fuga
  -- a anon. IS NOT TRUE trata NULL y FALSE como no-admin.
  IF public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT jsonb_build_object(
    'total',        (SELECT count(*) FROM report_feedback),
    'avg_rating',   (SELECT round(avg(rating)::numeric, 2) FROM report_feedback WHERE rating IS NOT NULL),
    'low_count',    (SELECT count(*) FROM report_feedback WHERE rating IS NOT NULL AND rating <= 2),
    'corrections',  (SELECT count(*) FROM report_feedback rf
                       WHERE jsonb_array_length(COALESCE(rf.dimensions_wrong, '[]'::jsonb)) > 0),

    -- Qué dimensión se corrige más (señal directa para el RAG)
    'by_dimension', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('dimension', dim, 'count', c) ORDER BY c DESC)
      FROM (
        SELECT d AS dim, count(*) AS c
        FROM report_feedback rf,
             LATERAL jsonb_array_elements_text(COALESCE(rf.dimensions_wrong, '[]'::jsonb)) d
        GROUP BY d
      ) q
    ), '[]'::jsonb),

    -- Rating y volumen por sección
    'by_section', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'section', section,
        'count',   c,
        'avg_rating', avg_r,
        'low_count',  low_c
      ) ORDER BY c DESC)
      FROM (
        SELECT section,
               count(*) AS c,
               round(avg(rating)::numeric, 2) AS avg_r,
               count(*) FILTER (WHERE rating IS NOT NULL AND rating <= 2) AS low_c
        FROM report_feedback
        GROUP BY section
      ) s
    ), '[]'::jsonb),

    -- Worklist: reportes mal valorados o con comentario, recientes
    'recent_low', COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at DESC)
      FROM (
        SELECT rf.validation_id,
               v.idea_name,
               rf.rating,
               rf.dimensions_wrong,
               rf.free_text,
               rf.section,
               rf.created_at
        FROM report_feedback rf
        LEFT JOIN validations v ON v.id = rf.validation_id
        WHERE (rf.rating IS NOT NULL AND rf.rating <= 2)
           OR (rf.free_text IS NOT NULL AND length(trim(rf.free_text)) > 0)
        ORDER BY rf.created_at DESC
        LIMIT 30
      ) r
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_feedback_digest() IS
  'Agrega report_feedback en una worklist accionable para refinar el RAG. Admin-only.';
