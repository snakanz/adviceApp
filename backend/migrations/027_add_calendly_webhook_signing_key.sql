-- =====================================================
-- ADD CALENDLY WEBHOOK SIGNING KEY COLUMNS
-- =====================================================
-- This migration adds columns to store the webhook signing keys
-- returned by Calendly for proper webhook verification
-- =====================================================

-- Step 1: Add webhook signing key column to calendar_connections
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS calendly_webhook_signing_key TEXT;

COMMENT ON COLUMN calendar_connections.calendly_webhook_signing_key IS 'Signing key returned by Calendly for webhook verification (unique per webhook subscription)';

-- Step 2: Add webhook signing key column to calendly_webhook_subscriptions
ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS webhook_signing_key TEXT;

COMMENT ON COLUMN calendly_webhook_subscriptions.webhook_signing_key IS 'Signing key returned by Calendly for this webhook subscription - used to verify webhook signatures';

-- Step 3: Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('calendar_connections', 'calendly_webhook_subscriptions')
AND column_name LIKE '%signing_key%'
ORDER BY table_name, ordinal_position;

-- =====================================================
-- NOTES
-- =====================================================
-- After running this migration:
-- 1. The calendar_connections table will have calendly_webhook_signing_key column
-- 2. The calendly_webhook_subscriptions table will have webhook_signing_key column
-- 3. When webhooks are created, Calendly returns a signing_key in the response
-- 4. This key is now stored in the database for webhook verification
-- 5. Webhook verification will use the key from the database, not environment variables
-- =====================================================

