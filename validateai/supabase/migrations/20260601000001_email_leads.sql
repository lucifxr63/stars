-- Sprint Q-D: tabla de leads capturados en exit-intent del flujo rápido.
-- RLS estricto: INSERT permitido para anon/authenticated, SELECT bloqueado para todos
-- los roles de cliente — solo service_role puede leer (bypassa RLS).

CREATE TABLE IF NOT EXISTS public.email_leads (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email            TEXT        NOT NULL CHECK (email LIKE '%@%'),
  validation_id    UUID        REFERENCES public.validations(id) ON DELETE SET NULL,
  validation_score INT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para deduplicar leads por email
CREATE INDEX IF NOT EXISTS idx_email_leads_email ON public.email_leads(email);

ALTER TABLE public.email_leads ENABLE ROW LEVEL SECURITY;

-- INSERT: permitido a roles anon y authenticated (captura anónima aprobada)
CREATE POLICY "allow_insert_email_leads"
  ON public.email_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT: sin política → bloqueado para todos los roles cliente.
-- Los admins acceden con service_role_key que bypassa RLS.
