-- Immediate Data Cleanup for Current Situation
-- This script handles the specific case where Google Calendar is empty
-- but database contains historical data that needs to be properly categorized

-- ============================================================================
-- PART 1: ANALYZE CURRENT STATE
-- ============================================================================

-- Show current state before cleanup
SELECT 'BEFORE CLEANUP - Database State' as analysis;

SELECT 
    'meetings_summary' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN is_deleted = true THEN 1 END) as deleted_records,
    COUNT(CASE WHEN is_deleted = false OR is_deleted IS NULL THEN 1 END) as active_records
FROM meetings 
WHERE userid = 1;

SELECT 
    'clients_summary' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_records,
    COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_records
FROM clients 
WHERE advisor_id = 1;

-- Show sample of current meetings
SELECT 
    'current_meetings_sample' as info,
    id,
    title,
    starttime,
    COALESCE(is_deleted, false) as is_deleted,
    sync_status
FROM meetings 
WHERE userid = 1 
ORDER BY starttime DESC 
LIMIT 5;

-- ============================================================================
-- PART 2: MARK HISTORICAL MEETINGS AS ORPHANED
-- ============================================================================

-- Since Google Calendar is empty, all existing meetings should be marked as orphaned
-- This preserves the historical data but clearly indicates it's no longer in the calendar

UPDATE meetings 
SET 
    is_deleted = TRUE,
    deleted_at = NOW(),
    last_calendar_sync = NOW(),
    sync_status = 'orphaned'
WHERE userid = 1 
AND (is_deleted IS NULL OR is_deleted = FALSE);

-- Get count of updated meetings
SELECT 
    'meetings_marked_orphaned' as action,
    COUNT(*) as updated_count
FROM meetings 
WHERE userid = 1 
AND sync_status = 'orphaned';

-- ============================================================================
-- PART 3: UPDATE CLIENT STATUSES
-- ============================================================================

-- Update all clients to reflect that they have no active meetings
-- but preserve their historical meeting counts

UPDATE clients 
SET 
    is_active = FALSE,
    active_meeting_count = 0,
    last_meeting_date = (
        SELECT MAX(starttime) FROM meetings 
        WHERE client_id = clients.id
        AND sync_status = 'orphaned'
    ),
    last_activity_sync = NOW()
WHERE advisor_id = 1;

-- Show updated client statuses
SELECT 
    'updated_clients' as info,
    id,
    name,
    email,
    is_active,
    meeting_count,
    active_meeting_count,
    last_meeting_date
FROM clients 
WHERE advisor_id = 1
ORDER BY last_meeting_date DESC NULLS LAST;

-- ============================================================================
-- PART 4: HANDLE RELATED DATA
-- ============================================================================

-- Archive Ask Advicly threads since all meetings are now orphaned
UPDATE ask_threads 
SET 
    is_archived = TRUE,
    updated_at = NOW()
WHERE advisor_id = 1 
AND is_archived = FALSE;

-- Show archived threads count
SELECT 
    'archived_ask_threads' as action,
    COUNT(*) as archived_count
FROM ask_threads 
WHERE advisor_id = 1 
AND is_archived = TRUE;

-- ============================================================================
-- PART 5: CREATE CLEANUP SUMMARY
-- ============================================================================

-- Create a summary of the cleanup operation
DO $$
DECLARE
    meetings_orphaned INTEGER;
    clients_deactivated INTEGER;
    threads_archived INTEGER;
BEGIN
    -- Count orphaned meetings
    SELECT COUNT(*) INTO meetings_orphaned
    FROM meetings 
    WHERE userid = 1 AND sync_status = 'orphaned';
    
    -- Count deactivated clients
    SELECT COUNT(*) INTO clients_deactivated
    FROM clients 
    WHERE advisor_id = 1 AND is_active = FALSE;
    
    -- Count archived threads
    SELECT COUNT(*) INTO threads_archived
    FROM ask_threads 
    WHERE advisor_id = 1 AND is_archived = TRUE;
    
    -- Output summary
    RAISE NOTICE 'CLEANUP SUMMARY:';
    RAISE NOTICE '- Meetings marked as orphaned: %', meetings_orphaned;
    RAISE NOTICE '- Clients deactivated: %', clients_deactivated;
    RAISE NOTICE '- Ask Advicly threads archived: %', threads_archived;
    RAISE NOTICE 'All historical data preserved but marked as inactive.';
END $$;

-- ============================================================================
-- PART 6: VERIFICATION QUERIES
-- ============================================================================

-- Final state verification
SELECT 'AFTER CLEANUP - Database State' as analysis;

SELECT 
    'meetings_final_state' as table_name,
    COUNT(*) as total_meetings,
    COUNT(CASE WHEN sync_status = 'orphaned' THEN 1 END) as orphaned_meetings,
    COUNT(CASE WHEN sync_status = 'active' THEN 1 END) as active_meetings,
    COUNT(CASE WHEN is_deleted = true THEN 1 END) as deleted_meetings
FROM meetings 
WHERE userid = 1;

SELECT 
    'clients_final_state' as table_name,
    COUNT(*) as total_clients,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_clients,
    COUNT(CASE WHEN is_active = false AND meeting_count > 0 THEN 1 END) as historical_clients,
    COUNT(CASE WHEN meeting_count = 0 THEN 1 END) as clients_no_meetings
FROM clients 
WHERE advisor_id = 1;

-- Show what the frontend queries will return
SELECT 'FRONTEND QUERIES RESULTS' as info;

-- Meetings page query (should return 0 results)
SELECT 
    'meetings_page_query' as query_type,
    COUNT(*) as visible_meetings
FROM meetings 
WHERE userid = 1 
AND (is_deleted IS NULL OR is_deleted = FALSE);

-- Clients page query (should show clients with historical status)
SELECT 
    'clients_page_query' as query_type,
    c.name,
    c.email,
    c.is_active,
    c.active_meeting_count,
    c.meeting_count,
    c.last_meeting_date,
    CASE 
        WHEN c.is_active THEN 'Active'
        WHEN c.meeting_count > 0 THEN 'Historical'
        ELSE 'No Meetings'
    END as display_status
FROM clients c 
WHERE c.advisor_id = 1
ORDER BY c.is_active DESC, c.last_meeting_date DESC NULLS LAST;

-- ============================================================================
-- PART 7: RECOMMENDATIONS
-- ============================================================================

SELECT 'NEXT STEPS RECOMMENDATIONS' as info;

-- This would be shown as informational output
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'RECOMMENDATIONS FOR NEXT STEPS:';
    RAISE NOTICE '';
    RAISE NOTICE '1. FRONTEND BEHAVIOR:';
    RAISE NOTICE '   - Meetings page will show 0 meetings (correct)';
    RAISE NOTICE '   - Clients page will show clients with "Historical" status';
    RAISE NOTICE '   - All historical data is preserved but clearly marked';
    RAISE NOTICE '';
    RAISE NOTICE '2. WHEN NEW MEETINGS ARE ADDED TO GOOGLE CALENDAR:';
    RAISE NOTICE '   - Run comprehensive sync to detect and import them';
    RAISE NOTICE '   - Client statuses will automatically update via triggers';
    RAISE NOTICE '   - New meetings will have sync_status = "active"';
    RAISE NOTICE '';
    RAISE NOTICE '3. CLIENT MANAGEMENT:';
    RAISE NOTICE '   - Historical clients are preserved for reference';
    RAISE NOTICE '   - They will show "No active meetings" status';
    RAISE NOTICE '   - When new meetings are added, they will reactivate automatically';
    RAISE NOTICE '';
    RAISE NOTICE '4. DATA INTEGRITY:';
    RAISE NOTICE '   - All foreign key relationships maintained';
    RAISE NOTICE '   - Historical summaries and transcripts preserved';
    RAISE NOTICE '   - Ask Advicly threads archived but recoverable';
    RAISE NOTICE '';
END $$;
