-- =====================================================
-- ADD WEBHOOK TRACKING COLUMNS TO MEETINGS TABLE
-- =====================================================
-- This migration adds columns needed for webhook-based sync:
-- 1. synced_via_webhook - tracks if meeting came from webhook
-- 2. meeting_source - tracks source (google/calendly)
-- 3. last_webhook_update - timestamp of last webhook update
-- =====================================================

-- Add synced_via_webhook column
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS synced_via_webhook BOOLEAN DEFAULT false;

-- Add meeting_source column if not exists
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS meeting_source TEXT DEFAULT 'google'
CHECK (meeting_source IN ('google', 'calendly', 'manual', 'import'));

-- Add last_webhook_update timestamp
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS last_webhook_update TIMESTAMP;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS meetings_synced_via_webhook_idx ON meetings(synced_via_webhook);
CREATE INDEX IF NOT EXISTS meetings_meeting_source_idx ON meetings(meeting_source);
CREATE INDEX IF NOT EXISTS meetings_last_webhook_update_idx ON meetings(last_webhook_update);

-- Add comments for documentation
COMMENT ON COLUMN meetings.synced_via_webhook IS 'True if meeting was created/updated via webhook (real-time sync)';
COMMENT ON COLUMN meetings.meeting_source IS 'Source of the meeting: google, calendly, manual, or import';
COMMENT ON COLUMN meetings.last_webhook_update IS 'Timestamp of the last webhook update for this meeting';

-- =====================================================
-- NOTES
-- =====================================================
-- After running this migration, the webhook-based sync will work properly.
-- Existing meetings will have synced_via_webhook = false (default).
-- New meetings from webhooks will have synced_via_webhook = true.
-- =====================================================

