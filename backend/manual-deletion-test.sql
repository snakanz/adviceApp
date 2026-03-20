-- Manual Calendar Deletion Test
-- Since you deleted all meetings from Google Calendar, 
-- this script simulates what the sync process would do

-- Step 1: Check current state
SELECT 
    'BEFORE UPDATE' as status,
    COUNT(*) as total_meetings,
    COUNT(CASE WHEN is_deleted = true THEN 1 END) as deleted_meetings,
    COUNT(CASE WHEN is_deleted = false THEN 1 END) as active_meetings
FROM meetings 
WHERE userid = 1;

-- Step 2: Show current meetings
SELECT 
    id,
    title,
    starttime,
    is_deleted,
    deleted_at,
    last_calendar_sync
FROM meetings 
WHERE userid = 1 
ORDER BY starttime DESC 
LIMIT 10;

-- Step 3: Mark all meetings as deleted (simulating Google Calendar sync)
-- This is what the sync process would do when it detects meetings are gone from Google Calendar
UPDATE meetings 
SET 
    is_deleted = true,
    deleted_at = NOW(),
    last_calendar_sync = NOW()
WHERE userid = 1 
AND is_deleted = false;

-- Step 4: Check state after update
SELECT 
    'AFTER UPDATE' as status,
    COUNT(*) as total_meetings,
    COUNT(CASE WHEN is_deleted = true THEN 1 END) as deleted_meetings,
    COUNT(CASE WHEN is_deleted = false THEN 1 END) as active_meetings
FROM meetings 
WHERE userid = 1;

-- Step 5: Show updated meetings
SELECT 
    id,
    title,
    starttime,
    is_deleted,
    deleted_at,
    last_calendar_sync
FROM meetings 
WHERE userid = 1 
ORDER BY starttime DESC 
LIMIT 10;

-- Step 6: Test the API query (what the frontend will see)
-- This simulates the query from /api/calendar/meetings/all
SELECT 
    'FRONTEND WILL SEE' as status,
    COUNT(*) as visible_meetings
FROM meetings 
WHERE userid = 1 
AND is_deleted = false  -- This is the key filter we added
AND starttime >= (NOW() - INTERVAL '90 days');

-- If you want to undo this test (restore meetings), uncomment the following:
-- UPDATE meetings 
-- SET 
--     is_deleted = false,
--     deleted_at = NULL
-- WHERE userid = 1 
-- AND is_deleted = true;
