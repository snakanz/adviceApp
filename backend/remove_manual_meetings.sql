-- Remove all manually uploaded meetings
-- This will delete meetings with meeting_source = 'manual' while preserving Google Calendar and Calendly meetings

-- First, let's see what we're about to delete (optional - for verification)
-- SELECT 
--   COUNT(*) as manual_meetings_count,
--   MIN(starttime) as earliest_manual_meeting,
--   MAX(starttime) as latest_manual_meeting
-- FROM meetings 
-- WHERE meeting_source = 'manual' OR meeting_source IS NULL;

-- Delete all manual meetings
DELETE FROM meetings 
WHERE meeting_source = 'manual' 
   OR meeting_source IS NULL 
   OR meeting_source = '';

-- Also clean up any orphaned client records that might have been created from manual uploads
-- (Only if they don't have any remaining meetings)
DELETE FROM clients 
WHERE id NOT IN (
  SELECT DISTINCT 
    CASE 
      WHEN attendees IS NOT NULL AND attendees != '' THEN
        -- Extract client emails from remaining meetings
        (SELECT jsonb_array_elements_text(
          CASE 
            WHEN jsonb_typeof(attendees::jsonb) = 'array' THEN attendees::jsonb
            ELSE '[]'::jsonb
          END
        ) LIMIT 1)
      ELSE NULL
    END
  FROM meetings 
  WHERE meeting_source IN ('google', 'calendly')
    AND attendees IS NOT NULL 
    AND attendees != ''
);

-- Reset any auto-increment sequences if needed
-- (This is optional and depends on your ID strategy)

-- Show summary of remaining meetings by source
SELECT 
  COALESCE(meeting_source, 'NULL') as source,
  COUNT(*) as count,
  MIN(starttime) as earliest,
  MAX(starttime) as latest
FROM meetings 
GROUP BY meeting_source
ORDER BY count DESC;
