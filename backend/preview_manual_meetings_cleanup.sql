-- PREVIEW: Manual Meetings Cleanup
-- Run this first to see what will be deleted before actually deleting

-- 1. Show current meeting distribution by source
SELECT 
  COALESCE(meeting_source, 'NULL/Empty') as source,
  COUNT(*) as meeting_count,
  MIN(starttime) as earliest_meeting,
  MAX(starttime) as latest_meeting
FROM meetings 
GROUP BY meeting_source
ORDER BY meeting_count DESC;

-- 2. Show sample manual meetings that will be deleted
SELECT 
  id,
  title,
  starttime,
  meeting_source,
  CASE 
    WHEN LENGTH(attendees) > 100 THEN LEFT(attendees, 100) || '...'
    ELSE attendees
  END as attendees_preview
FROM meetings 
WHERE meeting_source = 'manual' 
   OR meeting_source IS NULL 
   OR meeting_source = ''
ORDER BY starttime DESC
LIMIT 10;

-- 3. Count meetings by user that will be deleted
SELECT 
  userid,
  COUNT(*) as manual_meetings_to_delete
FROM meetings 
WHERE meeting_source = 'manual' 
   OR meeting_source IS NULL 
   OR meeting_source = ''
GROUP BY userid
ORDER BY manual_meetings_to_delete DESC;

-- 4. Show total counts
SELECT 
  'TOTAL MEETINGS' as category,
  COUNT(*) as count
FROM meetings
UNION ALL
SELECT 
  'MANUAL MEETINGS TO DELETE' as category,
  COUNT(*) as count
FROM meetings 
WHERE meeting_source = 'manual' 
   OR meeting_source IS NULL 
   OR meeting_source = ''
UNION ALL
SELECT 
  'GOOGLE MEETINGS TO KEEP' as category,
  COUNT(*) as count
FROM meetings 
WHERE meeting_source = 'google'
UNION ALL
SELECT 
  'CALENDLY MEETINGS TO KEEP' as category,
  COUNT(*) as count
FROM meetings 
WHERE meeting_source = 'calendly';

-- AFTER REVIEWING THE ABOVE, RUN THE ACTUAL DELETION:
-- 
-- DELETE FROM meetings 
-- WHERE meeting_source = 'manual' 
--    OR meeting_source IS NULL 
--    OR meeting_source = '';
--
-- -- Verify deletion worked:
-- SELECT 
--   COALESCE(meeting_source, 'NULL/Empty') as source,
--   COUNT(*) as remaining_count
-- FROM meetings 
-- GROUP BY meeting_source
-- ORDER BY remaining_count DESC;
