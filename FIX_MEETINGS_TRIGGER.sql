-- Fix the update_client_stats trigger to work with the actual meetings table schema

-- First, let's see what triggers exist on the meetings table
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'meetings';

-- Drop the problematic trigger temporarily
DROP TRIGGER IF EXISTS update_client_stats_trigger ON meetings;

-- Create a new version of the update_client_stats function that works with client_id instead of clientname
CREATE OR REPLACE FUNCTION update_client_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if we have a client_id
    IF COALESCE(NEW.client_id, OLD.client_id) IS NOT NULL THEN
        WITH client_stats AS (
            SELECT 
                COUNT(*) as total_meetings,
                COUNT(CASE WHEN starttime >= NOW() - INTERVAL '90 days' THEN 1 END) as recent_meetings,
                MAX(starttime) as last_meeting
            FROM meetings 
            WHERE client_id = COALESCE(NEW.client_id, OLD.client_id)
            AND (is_deleted IS NULL OR is_deleted = false)
        )
        UPDATE clients 
        SET 
            meeting_count = client_stats.total_meetings,
            active_meeting_count = client_stats.recent_meetings,
            is_active = (client_stats.recent_meetings > 0),
            last_meeting_date = client_stats.last_meeting,
            updated_at = NOW()
        FROM client_stats
        WHERE id = COALESCE(NEW.client_id, OLD.client_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER update_client_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_client_stats();

-- Test: Try to insert a meeting without client_id (should work now)
INSERT INTO meetings (
  googleeventid, 
  userid, 
  title, 
  starttime, 
  endtime, 
  summary,
  attendees,
  created_at,
  updated_at
) VALUES (
  'test-meeting-456',
  1,
  'Test Meeting After Fix',
  '2025-08-23T14:00:00',
  '2025-08-23T15:00:00',
  'This should work now',
  '[]',
  NOW(),
  NOW()
);

-- Check if it worked
SELECT COUNT(*) as total_meetings FROM meetings;
SELECT * FROM meetings WHERE googleeventid LIKE 'test-meeting%';
