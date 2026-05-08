-- Figma OAuth2 connections
CREATE TABLE public.figma_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    figma_user_id TEXT,
    figma_handle TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE public.figma_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own figma connection"
    ON public.figma_connections
    FOR ALL
    USING (auth.uid() = user_id);

-- Navigation maps linked to a validation
CREATE TABLE public.figma_navigation_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_id UUID REFERENCES public.validations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    file_key TEXT NOT NULL,
    file_name TEXT,
    page_id TEXT,
    page_name TEXT,
    version_id TEXT,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    ai_insights JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.figma_navigation_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own navigation maps"
    ON public.figma_navigation_maps
    FOR ALL
    USING (auth.uid() = user_id);

-- Sync history for auditing and debugging
CREATE TABLE public.figma_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID REFERENCES public.figma_navigation_maps(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('success', 'failed')) NOT NULL,
    nodes_count INT DEFAULT 0,
    edges_count INT DEFAULT 0,
    duration_ms INT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.figma_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sync logs"
    ON public.figma_sync_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_figma_connections_updated_at
    BEFORE UPDATE ON public.figma_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_figma_navigation_maps_updated_at
    BEFORE UPDATE ON public.figma_navigation_maps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
