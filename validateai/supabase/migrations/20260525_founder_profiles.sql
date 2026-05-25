-- TS-101: Founder Profiles — tabla 1:1 con profiles
-- Almacena datos enriquecidos del fundador vía LinkedIn + edición manual

CREATE TABLE IF NOT EXISTS public.founder_profiles (
  id                      uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  linkedin_url            text,
  full_name               text,
  headline                text,
  summary_bio             text,
  industry_expertise_years integer NOT NULL DEFAULT 0,
  skills                  jsonb NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  work_experience         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- WorkEntry[]
  education               jsonb NOT NULL DEFAULT '[]'::jsonb,  -- EduEntry[]
  competency_scores       jsonb,                               -- {visionComercial, capacidadTecnica, liderazgo, experienciaIndustria, resilienciaOperativa}
  raw_scraped_data        jsonb,                               -- respaldo crudo del scraper
  ai_inference_metadata   jsonb,                               -- JSON estructurado generado por LLM
  extraction_status       text NOT NULL DEFAULT 'idle'
                            CHECK (extraction_status IN ('idle','processing','done','error')),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'founder_profiles_updated_at'
  ) THEN
    CREATE TRIGGER founder_profiles_updated_at
      BEFORE UPDATE ON public.founder_profiles
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- RLS
ALTER TABLE public.founder_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "founder_profiles_owner_select"
  ON public.founder_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "founder_profiles_owner_insert"
  ON public.founder_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "founder_profiles_owner_update"
  ON public.founder_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "founder_profiles_owner_delete"
  ON public.founder_profiles FOR DELETE
  USING (auth.uid() = id);
