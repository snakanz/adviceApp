-- =====================================================
-- Calendly Multi-User Setup - Database Migration
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Create calendly_webhook_events table for deduplication
CREATE TABLE IF NOT EXISTS calendly_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_calendly_webhook_events_event_id ON calendly_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_calendly_webhook_events_created_at ON calendly_webhook_events(created_at);

-- Add comment
COMMENT ON TABLE calendly_webhook_events IS 'Stores processed Calendly webhook events for deduplication';

-- =====================================================
-- Step 2: Verify existing Calendly connections
-- =====================================================

SELECT 
  '=== Current Calendly Connections ===' AS info;

SELECT 
  id,
  user_id,
  provider_account_email,
  calendly_user_uri,
  calendly_organization_uri,
  is_active,
  created_at
FROM calendar_connections
WHERE provider = 'calendly'
ORDER BY created_at DESC;

-- =====================================================
-- Step 3: Check for connections missing calendly_user_uri
-- =====================================================

SELECT 
  '=== Connections Missing calendly_user_uri (NEED RECONNECTION) ===' AS warning;

SELECT 
  id,
  user_id,
  provider_account_email,
  'User needs to disconnect and reconnect Calendly' AS action_required
FROM calendar_connections
WHERE provider = 'calendly'
  AND calendly_user_uri IS NULL;

-- =====================================================
-- Step 4: Verify webhook events table was created
-- =====================================================

SELECT 
  '=== Webhook Events Table Status ===' AS info;

SELECT 
  table_name,
  'Table exists and ready for webhook deduplication' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'calendly_webhook_events';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Restart your backend service (Render will do this automatically)
-- 2. Have users with NULL calendly_user_uri disconnect and reconnect
-- 3. Test by creating a meeting in Calendly
-- 4. Verify meeting appears instantly in your app
-- =====================================================

