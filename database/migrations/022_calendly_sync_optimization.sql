-- Calendly Sync Optimization Migration
-- Adds user-level sync tracking for intelligent incremental syncs

-- =====================================================
-- STEP 1: Add sync tracking to users table
-- =====================================================

-- Add columns to track last sync per user
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_calendly_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS calendly_initial_sync_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS calendly_webhook_enabled BOOLEAN DEFAULT FALSE;

-- Create index for sync queries
CREATE INDEX IF NOT EXISTS idx_users_last_calendly_sync ON users(last_calendly_sync);
CREATE INDEX IF NOT EXISTS idx_users_calendly_initial_sync ON users(calendly_initial_sync_complete);

-- =====================================================
-- STEP 2: Add webhook tracking table
-- =====================================================

-- Create table to track webhook events for deduplication
CREATE TABLE IF NOT EXISTS calendly_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for webhook queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON calendly_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON calendly_webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON calendly_webhook_events(created_at);

-- =====================================================
-- STEP 3: Add function to clean old webhook events
-- =====================================================

-- Function to clean webhook events older than 30 days
CREATE OR REPLACE FUNCTION clean_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM calendly_webhook_events
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 4: Add sync metadata to meetings
-- =====================================================

-- Add column to track if meeting came from webhook
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS synced_via_webhook BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_meetings_webhook_sync ON meetings(synced_via_webhook);

-- =====================================================
-- STEP 5: Create view for sync health monitoring
-- =====================================================

CREATE OR REPLACE VIEW calendly_sync_health AS
SELECT 
    u.id as user_id,
    u.email,
    u.last_calendly_sync,
    u.calendly_initial_sync_complete,
    u.calendly_webhook_enabled,
    COUNT(m.id) FILTER (WHERE m.meeting_source = 'calendly' AND m.is_deleted = false) as active_calendly_meetings,
    COUNT(m.id) FILTER (WHERE m.meeting_source = 'calendly' AND m.is_deleted = true) as deleted_calendly_meetings,
    COUNT(m.id) FILTER (WHERE m.meeting_source = 'calendly' AND m.synced_via_webhook = true) as webhook_synced_meetings,
    MAX(m.last_calendar_sync) as last_meeting_sync,
    COUNT(w.id) as webhook_events_received
FROM users u
LEFT JOIN meetings m ON m.userid = u.id::text
LEFT JOIN calendly_webhook_events w ON w.user_id = u.id
GROUP BY u.id, u.email, u.last_calendly_sync, u.calendly_initial_sync_complete, u.calendly_webhook_enabled;

-- =====================================================
-- Documentation
-- =====================================================

COMMENT ON COLUMN users.last_calendly_sync IS 'Timestamp of last successful Calendly sync for this user';
COMMENT ON COLUMN users.calendly_initial_sync_complete IS 'True if initial full sync (2 years back) has been completed';
COMMENT ON COLUMN users.calendly_webhook_enabled IS 'True if user has webhooks configured for real-time updates';
COMMENT ON COLUMN meetings.synced_via_webhook IS 'True if this meeting was created/updated via webhook instead of polling';
COMMENT ON TABLE calendly_webhook_events IS 'Tracks received webhook events for deduplication and audit trail';
COMMENT ON VIEW calendly_sync_health IS 'Monitoring view for Calendly sync status per user';

