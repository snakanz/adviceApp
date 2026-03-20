-- =====================================================
-- MIGRATION 029: Add RLS Policies & Webhook Health Tracking
-- =====================================================
-- CRITICAL SECURITY FIX:
-- 1. Add RLS policies to prevent cross-user data access
-- 2. Add webhook health tracking columns
-- 3. Ensure users can only access their own calendar connections
--
-- ISSUE FIXED: User logged into account and auto-logged into another user's Calendly
-- ROOT CAUSE: No RLS policies on calendar_connections table
-- =====================================================

-- =====================================================
-- PART 1: ADD WEBHOOK HEALTH TRACKING COLUMNS
-- =====================================================

-- Add webhook health tracking to calendar_connections
ALTER TABLE calendar_connections
ADD COLUMN IF NOT EXISTS webhook_last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS webhook_status TEXT DEFAULT 'unknown' CHECK (webhook_status IN ('active', 'missing', 'error', 'unknown')),
ADD COLUMN IF NOT EXISTS webhook_verification_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS webhook_last_error TEXT;

-- Add webhook health tracking to calendly_webhook_subscriptions
ALTER TABLE calendly_webhook_subscriptions
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unknown' CHECK (verification_status IN ('active', 'missing', 'error', 'unknown')),
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- =====================================================
-- PART 2: ENABLE RLS ON CRITICAL TABLES
-- =====================================================

-- Enable RLS on calendar_connections
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

-- Enable RLS on calendly_webhook_subscriptions
ALTER TABLE calendly_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on calendar_watch_channels
ALTER TABLE calendar_watch_channels ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 3: CREATE RLS POLICIES FOR calendar_connections
-- =====================================================

-- Policy: Users can only SELECT their own calendar connections
CREATE POLICY "Users can view their own calendar connections"
ON calendar_connections
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can only INSERT their own calendar connections
CREATE POLICY "Users can create their own calendar connections"
ON calendar_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only UPDATE their own calendar connections
CREATE POLICY "Users can update their own calendar connections"
ON calendar_connections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only DELETE their own calendar connections
CREATE POLICY "Users can delete their own calendar connections"
ON calendar_connections
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- PART 4: CREATE RLS POLICIES FOR calendly_webhook_subscriptions
-- =====================================================

-- Policy: Users can only SELECT their own webhook subscriptions
CREATE POLICY "Users can view their own webhook subscriptions"
ON calendly_webhook_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can only INSERT their own webhook subscriptions
CREATE POLICY "Users can create their own webhook subscriptions"
ON calendly_webhook_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only UPDATE their own webhook subscriptions
CREATE POLICY "Users can update their own webhook subscriptions"
ON calendly_webhook_subscriptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only DELETE their own webhook subscriptions
CREATE POLICY "Users can delete their own webhook subscriptions"
ON calendly_webhook_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- PART 5: CREATE RLS POLICIES FOR calendar_watch_channels
-- =====================================================

-- Policy: Users can only SELECT their own watch channels
CREATE POLICY "Users can view their own watch channels"
ON calendar_watch_channels
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can only INSERT their own watch channels
CREATE POLICY "Users can create their own watch channels"
ON calendar_watch_channels
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only UPDATE their own watch channels
CREATE POLICY "Users can update their own watch channels"
ON calendar_watch_channels
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only DELETE their own watch channels
CREATE POLICY "Users can delete their own watch channels"
ON calendar_watch_channels
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- PART 6: CREATE INDEXES FOR WEBHOOK HEALTH CHECKS
-- =====================================================

-- Index for finding webhooks that need verification
CREATE INDEX IF NOT EXISTS idx_calendar_connections_webhook_status
ON calendar_connections(user_id, webhook_status)
WHERE provider = 'calendly' AND is_active = true;

-- Index for finding old webhook verifications
CREATE INDEX IF NOT EXISTS idx_calendar_connections_webhook_last_verified
ON calendar_connections(user_id, webhook_last_verified_at)
WHERE provider = 'calendly' AND is_active = true;

-- =====================================================
-- PART 7: VERIFY MIGRATION
-- =====================================================

SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('calendar_connections', 'calendly_webhook_subscriptions', 'calendar_watch_channels')
AND column_name IN ('webhook_last_verified_at', 'webhook_status', 'webhook_verification_attempts', 'webhook_last_error', 'last_verified_at', 'verification_status', 'last_error')
ORDER BY table_name, ordinal_position;

