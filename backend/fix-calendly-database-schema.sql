-- Fix database schema to support Calendly meetings
-- This addresses the constraints preventing Calendly meetings from being inserted

-- 1. Make googleeventid nullable (since Calendly meetings don't have Google event IDs)
ALTER TABLE meetings 
ALTER COLUMN googleeventid DROP NOT NULL;

-- 2. Update the meeting_source constraint to include 'calendly'
ALTER TABLE meetings 
DROP CONSTRAINT IF EXISTS meetings_meeting_source_check;

ALTER TABLE meetings 
ADD CONSTRAINT meetings_meeting_source_check 
CHECK (meeting_source IN ('google', 'manual', 'outlook', 'calendly'));

-- 3. Add Calendly-specific columns if they don't exist
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT,
ADD COLUMN IF NOT EXISTS calendly_event_uuid TEXT;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_calendly_event_uuid 
ON meetings(calendly_event_uuid) 
WHERE calendly_event_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_meeting_source 
ON meetings(meeting_source);

-- 5. Create unique constraint for Calendly events per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_calendly_unique 
ON meetings(userid, calendly_event_uuid) 
WHERE calendly_event_uuid IS NOT NULL;

-- 6. Verify the changes
SELECT 'Schema updates completed successfully!' as status;

-- Show current meeting sources in the database
SELECT 
  COALESCE(meeting_source, 'NULL') as source,
  COUNT(*) as count
FROM meetings 
GROUP BY meeting_source
ORDER BY count DESC;

-- Show constraint definition
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'meetings'::regclass 
AND conname = 'meetings_meeting_source_check';
