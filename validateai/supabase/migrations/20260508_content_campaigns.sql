-- Content campaigns: carruseles generados por IA vinculados a una validación
CREATE TABLE public.content_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_id UUID REFERENCES public.validations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Metadatos de la campaña
    platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'instagram')),
    theme TEXT NOT NULL DEFAULT 'clean' CHECK (theme IN ('clean', 'dark', 'gradient')),
    title TEXT,

    -- Slides como JSONB array; cada objeto sigue la interfaz CarouselSlide
    slides JSONB NOT NULL DEFAULT '[]',

    -- Control de versiones: permite regenerar sin perder la versión anterior
    version INT NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.content_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own content campaigns"
    ON public.content_campaigns
    FOR ALL
    USING (auth.uid() = user_id);

CREATE TRIGGER update_content_campaigns_updated_at
    BEFORE UPDATE ON public.content_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índice para recuperar campañas de una validación rápidamente
CREATE INDEX idx_content_campaigns_validation_id
    ON public.content_campaigns(validation_id);
