-- Add Calendly-specific columns to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT,
ADD COLUMN IF NOT EXISTS calendly_event_uuid TEXT,
ADD COLUMN IF NOT EXISTS client_email TEXT;

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
