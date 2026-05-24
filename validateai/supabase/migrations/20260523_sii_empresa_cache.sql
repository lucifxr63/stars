-- Caché de consultas SII por RUT (TTL 7 días)
-- Reduce costos de API y mejora tiempos de respuesta.
CREATE TABLE IF NOT EXISTS public.sii_empresa_cache (
  rut         TEXT PRIMARY KEY,
  data        JSONB        NOT NULL,
  cached_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Solo accesible desde service role (tabla interna, sin exposición pública)
ALTER TABLE public.sii_empresa_cache ENABLE ROW LEVEL SECURITY;

-- Índice para filtrar por antigüedad
CREATE INDEX IF NOT EXISTS idx_sii_empresa_cache_cached_at
  ON public.sii_empresa_cache (cached_at);
