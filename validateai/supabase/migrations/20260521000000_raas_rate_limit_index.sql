-- Optimize rate limit queries: count api_usage_logs by api_key_id in date ranges
-- These indexes are critical for the rateLimitMiddleware performance

-- Composite index: api_key_id + created_at for time-range queries
create index if not exists idx_api_usage_logs_key_created
  on public.api_usage_logs (api_key_id, created_at desc);

-- Index on profiles tier for fast lookup in rate limit middleware
create index if not exists idx_profiles_tier
  on public.profiles (id, tier);

-- Add RLS policy to allow Edge Functions (service role) to read profiles for rate limiting
-- (service role bypasses RLS by default, but this documents the intent)
-- No additional policy needed as service role has full access.

comment on index idx_api_usage_logs_key_created is
  'Rate limit middleware: per-minute burst + monthly quota lookups by api_key_id';
