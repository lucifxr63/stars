-- Historial de cambios de tier por usuario.
-- Usado por cron-tier-health para calcular el downgrade rate semanal.
CREATE TABLE IF NOT EXISTS tier_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   text NOT NULL, -- 'upgrade' | 'downgrade_expired' | 'downgrade_manual' | 'cancel_scheduled'
  from_tier    text,
  to_tier      text,
  ls_event     text,          -- raw Lemon Squeezy event_name for debugging
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tier_events_user_created ON tier_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tier_events_type_created  ON tier_events (event_type, created_at DESC);

-- RLS: solo el service role puede insertar/leer (nunca el cliente)
ALTER TABLE tier_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON tier_events USING (false) WITH CHECK (false);
