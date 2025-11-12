-- =====================================================
-- MIGRATION 028: User-Scoped Calendly Webhooks
-- =====================================================
-- This migration converts from organization-scoped webhooks
-- to user-scoped webhooks for proper multi-tenant support.
--
-- Each user gets their own webhook subscription with their own signing key.
-- This allows 100s of users with their own private Calendly accounts.
--
-- Changes:
-- 1. Add user_id column to calendly_webhook_subscriptions
-- 2. Add scope column to track webhook scope (user vs organization)
-- 3. Update indexes to support per-user lookups
-- 4. Add user_id to calendar_connections for webhook reference
-- =====================================================

-- Step 1: Add user_id column to calendly_webhook_subscriptions
ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Step 2: Add scope column to track webhook scope
ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'organization' CHECK (scope IN ('user', 'organization'));

-- Step 3: Add user_uri column for webhook matching
ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS user_uri TEXT;

-- Step 4: Create index for per-user webhook lookups
CREATE INDEX IF NOT EXISTS idx_calendly_webhooks_user_id 
ON calendly_webhook_subscriptions(user_id) 
WHERE is_active = true;

-- Step 5: Create index for user_uri lookups (for webhook routing)
CREATE INDEX IF NOT EXISTS idx_calendly_webhooks_user_uri 
ON calendly_webhook_subscriptions(user_uri) 
WHERE is_active = true;

-- Step 6: Add webhook_id column to calendar_connections for reference
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS calendly_webhook_id TEXT;

-- Step 7: Add webhook_signing_key column to calendar_connections
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS calendly_webhook_signing_key TEXT;

-- Step 8: Create index for webhook lookups by calendar_connections
CREATE INDEX IF NOT EXISTS idx_calendar_connections_calendly_webhook_id 
ON calendar_connections(calendly_webhook_id) 
WHERE provider = 'calendly' AND is_active = true;

-- Step 9: Add comments for documentation
COMMENT ON COLUMN calendly_webhook_subscriptions.user_id IS 'User who owns this webhook subscription (for user-scoped webhooks)';
COMMENT ON COLUMN calendly_webhook_subscriptions.scope IS 'Webhook scope: user (per-user) or organization (shared)';
COMMENT ON COLUMN calendly_webhook_subscriptions.user_uri IS 'Calendly user URI for webhook event routing';
COMMENT ON COLUMN calendar_connections.calendly_webhook_id IS 'Reference to webhook subscription URI';
COMMENT ON COLUMN calendar_connections.calendly_webhook_signing_key IS 'Signing key for this user''s webhook';

-- Step 10: Verify migration
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('calendly_webhook_subscriptions', 'calendar_connections')
AND column_name IN ('user_id', 'scope', 'user_uri', 'calendly_webhook_id', 'calendly_webhook_signing_key')
ORDER BY table_name, ordinal_position;

