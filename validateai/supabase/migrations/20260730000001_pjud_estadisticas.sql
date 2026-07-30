-- ============================================================
-- Estadísticas del Poder Judicial (PJUD)
--
-- Fuente: https://estadisticaservices.pjud.cl — API pública, sin autenticación.
-- Auditoría completa de la fuente en docs/PJUD_API_HALLAZGOS.md.
--
-- POR QUÉ UNA TABLA GENÉRICA Y NO UNA POR SERIE
-- --------------------------------------------
-- La API devuelve al menos cuatro formas distintas sin normalizar:
--     {key, value}
--     {key, text, value}
--     {ITEM, MONTO, ANO}
--     {Anio_actual, Anio_anterior, Categoría, Variación %}
-- y las claves traen acentos y espacios. Modelar una tabla por serie serían 37
-- tablas para datos que se consultan igual: "dame la serie X del año Y".
--
-- Se normaliza a un formato común y se conserva la fila original en `payload`,
-- así ninguna ingesta pierde información aunque el mapeo se quede corto.
--
-- OJO CON EL VOLUMEN: los `_detalle` de la Corte Suprema devuelven hasta 95.075
-- filas en una sola respuesta. Esta tabla está pensada para las series
-- agregadas; si algún día se ingieren los detalles, conviene su propia tabla
-- particionada.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pjud_estadisticas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Endpoint de origen, sin parámetros. Ej: 'cuenta-publica/ingresos-causas'.
  serie          text NOT NULL,
  anio           integer,

  -- Dimensiones normalizadas desde las distintas formas de la fuente.
  categoria      text NOT NULL,          -- Categoría / key / ITEM / Región
  subcategoria   text,                   -- text / UNIDAD / TIPO

  -- Métricas. `valor_anterior` y `variacion` sólo vienen en las series de
  -- Cuenta Pública, que comparan contra el año previo.
  valor          numeric,
  valor_anterior numeric,
  variacion      text,

  -- Fila original tal como la devolvió la API.
  payload        jsonb NOT NULL,

  capturado_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Una fila por serie/año/categoría/subcategoría: re-ingerir refresca en vez
  -- de duplicar. COALESCE en subcategoria porque NULL no colisiona consigo
  -- mismo en un índice único.
  CONSTRAINT pjud_estadisticas_unica
    UNIQUE (serie, anio, categoria, subcategoria)
);

CREATE INDEX IF NOT EXISTS idx_pjud_serie_anio
  ON public.pjud_estadisticas (serie, anio DESC);

CREATE INDEX IF NOT EXISTS idx_pjud_categoria
  ON public.pjud_estadisticas (categoria);

COMMENT ON TABLE public.pjud_estadisticas IS
  'Series estadísticas del Poder Judicial. Datos NACIONALES por año: los '
  'parámetros corte/tribunal/competencia de la API son decorativos (verificado '
  '2026-07-30). Inteligencia judicial agregada — NO permite consultar causas '
  'individuales. Ver docs/PJUD_API_HALLAZGOS.md.';

-- RLS: lectura pública (es dato público), escritura sólo service_role.
ALTER TABLE public.pjud_estadisticas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de estadisticas PJUD" ON public.pjud_estadisticas;
CREATE POLICY "Lectura publica de estadisticas PJUD"
  ON public.pjud_estadisticas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura de estadisticas PJUD por service role" ON public.pjud_estadisticas;
CREATE POLICY "Escritura de estadisticas PJUD por service role"
  ON public.pjud_estadisticas FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
