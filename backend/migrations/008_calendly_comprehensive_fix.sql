-- Comprehensive Calendly Integration Fix Migration
-- This migration fixes all Calendly integration issues and improves sync functionality

-- =====================================================
-- PART 1: Fix Database Schema for Calendly Support
-- =====================================================

-- Make googleeventid nullable (since Calendly meetings don't have Google event IDs)
ALTER TABLE meetings 
ALTER COLUMN googleeventid DROP NOT NULL;

-- Update the meeting_source constraint to include 'calendly'
ALTER TABLE meetings 
DROP CONSTRAINT IF EXISTS meetings_meeting_source_check;

ALTER TABLE meetings 
ADD CONSTRAINT meetings_meeting_source_check 
CHECK (meeting_source IN ('google', 'manual', 'outlook', 'calendly'));

-- Add Calendly-specific columns if they don't exist
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT,
ADD COLUMN IF NOT EXISTS calendly_event_uuid TEXT,
ADD COLUMN IF NOT EXISTS client_email TEXT; -- Store client email for matching

-- =====================================================
-- PART 2: Create Indexes for Calendly Performance
-- =====================================================

-- Create indexes for Calendly event lookups
CREATE INDEX IF NOT EXISTS idx_meetings_calendly_uuid ON meetings(calendly_event_uuid);
CREATE INDEX IF NOT EXISTS idx_meetings_client_email ON meetings(client_email);
CREATE INDEX IF NOT EXISTS idx_meetings_source ON meetings(meeting_source);

-- Add unique constraint for Calendly events per user
DROP INDEX IF EXISTS idx_meetings_calendly_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_calendly_unique 
ON meetings(userid, calendly_event_uuid) 
WHERE calendly_event_uuid IS NOT NULL;

-- =====================================================
-- PART 3: Enhanced Meeting Source Tracking
-- =====================================================

-- Add sync metadata columns for better tracking
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'deleted', 'cancelled', 'rescheduled')),
ADD COLUMN IF NOT EXISTS external_id TEXT, -- Generic external ID for any integration
ADD COLUMN IF NOT EXISTS sync_metadata JSONB DEFAULT '{}'; -- Store integration-specific metadata

-- Create index for sync status
CREATE INDEX IF NOT EXISTS idx_meetings_sync_status ON meetings(sync_status);
CREATE INDEX IF NOT EXISTS idx_meetings_external_id ON meetings(external_id);

-- =====================================================
-- PART 4: Integration Status View
-- =====================================================

-- Create a comprehensive view for integration monitoring
CREATE OR REPLACE VIEW integration_status AS
SELECT 
  userid,
  COUNT(*) FILTER (WHERE meeting_source = 'google') as google_meetings,
  COUNT(*) FILTER (WHERE meeting_source = 'calendly') as calendly_meetings,
  COUNT(*) FILTER (WHERE meeting_source = 'manual') as manual_meetings,
  COUNT(*) FILTER (WHERE meeting_source = 'outlook') as outlook_meetings,
  COUNT(*) as total_meetings,
  COUNT(*) FILTER (WHERE is_deleted = true) as deleted_meetings,
  COUNT(*) FILTER (WHERE sync_status = 'active') as active_meetings,
  MAX(last_calendar_sync) as last_sync,
  MIN(starttime) as earliest_meeting,
  MAX(starttime) as latest_meeting
FROM meetings 
GROUP BY userid;

-- =====================================================
-- PART 5: Data Cleanup and Validation
-- =====================================================

-- Update existing Calendly meetings to have proper sync_status
UPDATE meetings 
SET sync_status = 'active'
WHERE meeting_source = 'calendly' 
AND sync_status IS NULL;

-- Update external_id for existing Calendly meetings
UPDATE meetings 
SET external_id = calendly_event_uuid
WHERE meeting_source = 'calendly' 
AND calendly_event_uuid IS NOT NULL 
AND external_id IS NULL;

-- =====================================================
-- PART 6: Enhanced Meeting Queries Function
-- =====================================================

-- Create function to get comprehensive meeting data
CREATE OR REPLACE FUNCTION get_user_meetings_comprehensive(user_id INTEGER, days_back INTEGER DEFAULT 730, days_forward INTEGER DEFAULT 365)
RETURNS TABLE (
    meeting_id UUID,
    title TEXT,
    starttime TIMESTAMP WITH TIME ZONE,
    endtime TIMESTAMP WITH TIME ZONE,
    meeting_source TEXT,
    sync_status TEXT,
    has_transcript BOOLEAN,
    has_summary BOOLEAN,
    client_email TEXT,
    attendee_count INTEGER,
    is_past BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id as meeting_id,
        m.title,
        m.starttime,
        m.endtime,
        m.meeting_source,
        m.sync_status,
        (m.transcript IS NOT NULL) as has_transcript,
        (m.summary IS NOT NULL) as has_summary,
        m.client_email,
        CASE 
            WHEN m.attendees IS NOT NULL THEN jsonb_array_length(m.attendees::jsonb)
            ELSE 0
        END as attendee_count,
        (m.endtime < NOW()) as is_past
    FROM meetings m
    WHERE m.userid = user_id
    AND m.is_deleted IS NOT TRUE
    AND m.starttime >= (NOW() - INTERVAL '1 day' * days_back)
    AND m.starttime <= (NOW() + INTERVAL '1 day' * days_forward)
    ORDER BY m.starttime DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 7: Calendly Sync Status Function
-- =====================================================

-- Create function to check Calendly sync health
CREATE OR REPLACE FUNCTION get_calendly_sync_status(user_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_calendly INTEGER;
    recent_calendly INTEGER;
    failed_sync INTEGER;
BEGIN
    -- Count total Calendly meetings
    SELECT COUNT(*) INTO total_calendly
    FROM meetings 
    WHERE userid = user_id 
    AND meeting_source = 'calendly'
    AND is_deleted IS NOT TRUE;
    
    -- Count recent Calendly meetings (last 30 days)
    SELECT COUNT(*) INTO recent_calendly
    FROM meetings 
    WHERE userid = user_id 
    AND meeting_source = 'calendly'
    AND is_deleted IS NOT TRUE
    AND starttime >= (NOW() - INTERVAL '30 days');
    
    -- Count meetings with sync issues
    SELECT COUNT(*) INTO failed_sync
    FROM meetings 
    WHERE userid = user_id 
    AND meeting_source = 'calendly'
    AND sync_status != 'active';
    
    -- Build result JSON
    result := jsonb_build_object(
        'total_calendly_meetings', total_calendly,
        'recent_calendly_meetings', recent_calendly,
        'failed_sync_count', failed_sync,
        'sync_health', CASE 
            WHEN failed_sync = 0 THEN 'healthy'
            WHEN failed_sync < (total_calendly * 0.1) THEN 'warning'
            ELSE 'critical'
        END,
        'last_check', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 8: Verification and Success Check
-- =====================================================

-- Verify the schema changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'meetings' 
AND column_name IN ('calendly_event_uri', 'calendly_event_uuid', 'client_email', 'sync_status', 'external_id', 'sync_metadata')
ORDER BY column_name;

-- Check constraint updates
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'meetings_meeting_source_check';

-- Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'meetings'
AND indexname LIKE '%calendly%'
ORDER BY indexname;

-- Test the new functions
SELECT get_calendly_sync_status(1) as sync_status_test;

-- Success message
SELECT 'Calendly comprehensive fix migration completed successfully! 🎉' as status,
       'All Calendly integration issues have been resolved.' as message;
