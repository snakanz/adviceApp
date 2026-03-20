-- Calendly Integration Schema Migration
-- Adds support for Calendly meetings alongside Google Calendar and manual meetings

-- Add Calendly-specific columns to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT,
ADD COLUMN IF NOT EXISTS calendly_event_uuid TEXT,
ADD COLUMN IF NOT EXISTS client_email TEXT; -- Store client email for matching

-- Update meeting_source enum to include calendly
ALTER TABLE meetings 
DROP CONSTRAINT IF EXISTS meetings_meeting_source_check;

ALTER TABLE meetings 
ADD CONSTRAINT meetings_meeting_source_check 
CHECK (meeting_source IN ('google', 'manual', 'outlook', 'calendly'));

-- Create index for Calendly event lookups
CREATE INDEX IF NOT EXISTS idx_meetings_calendly_uuid ON meetings(calendly_event_uuid);
CREATE INDEX IF NOT EXISTS idx_meetings_client_email ON meetings(client_email);
CREATE INDEX IF NOT EXISTS idx_meetings_source ON meetings(meeting_source);

-- Add unique constraint for Calendly events per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_calendly_unique 
ON meetings(userid, calendly_event_uuid) 
WHERE calendly_event_uuid IS NOT NULL;

-- Create a view for integration status (optional, for monitoring)
CREATE OR REPLACE VIEW integration_status AS
SELECT 
  userid,
  COUNT(*) FILTER (WHERE meeting_source = 'google') as google_meetings,
  COUNT(*) FILTER (WHERE meeting_source = 'calendly') as calendly_meetings,
  COUNT(*) FILTER (WHERE meeting_source = 'manual') as manual_meetings,
  COUNT(*) as total_meetings,
  MAX(last_calendar_sync) as last_sync
FROM meetings 
WHERE is_deleted IS NOT TRUE
GROUP BY userid;
