-- CLEANUP FAKE/TEST CLIENTS - Remove clients that don't have any meetings
-- This script removes only clients that have no associated meetings
-- Preserves all clients who have meetings (from Google Calendar or imports)

-- ============================================================================
-- SAFETY CHECK - Show what will be deleted
-- ============================================================================

SELECT 'BEFORE DELETION - Clients without meetings:' as info;

-- Show clients that will be deleted (those without meetings)
SELECT 
    c.id,
    c.name,
    c.email,
    c.created_at,
    COUNT(m.id) as meeting_count
FROM clients c
LEFT JOIN meetings m ON c.id = m.client_id AND m.userid = c.advisor_id
WHERE c.advisor_id = 1  -- Your user ID
GROUP BY c.id, c.name, c.email, c.created_at
HAVING COUNT(m.id) = 0  -- Only clients with no meetings
ORDER BY c.created_at;

-- Show total counts
SELECT 
    'summary_before' as info,
    COUNT(*) as total_clients,
    COUNT(CASE WHEN meeting_count > 0 THEN 1 END) as clients_with_meetings,
    COUNT(CASE WHEN meeting_count = 0 THEN 1 END) as clients_without_meetings
FROM (
    SELECT 
        c.id,
        COUNT(m.id) as meeting_count
    FROM clients c
    LEFT JOIN meetings m ON c.id = m.client_id AND m.userid = c.advisor_id
    WHERE c.advisor_id = 1
    GROUP BY c.id
) client_stats;

-- ============================================================================
-- DELETE CLIENTS WITHOUT MEETINGS
-- ============================================================================

-- Delete clients that have no associated meetings
DELETE FROM clients 
WHERE advisor_id = 1  -- Your user ID
AND id NOT IN (
    SELECT DISTINCT client_id 
    FROM meetings 
    WHERE userid = 1 
    AND client_id IS NOT NULL
);

-- ============================================================================
-- VERIFICATION - Show final state
-- ============================================================================

SELECT 'AFTER DELETION - Remaining clients:' as info;

-- Show remaining clients (should only be those with meetings)
SELECT 
    c.id,
    c.name,
    c.email,
    c.created_at,
    COUNT(m.id) as meeting_count
FROM clients c
LEFT JOIN meetings m ON c.id = m.client_id AND m.userid = c.advisor_id
WHERE c.advisor_id = 1
GROUP BY c.id, c.name, c.email, c.created_at
ORDER BY c.created_at;

-- Show final summary
SELECT 
    'summary_after' as info,
    COUNT(*) as total_clients,
    COUNT(CASE WHEN meeting_count > 0 THEN 1 END) as clients_with_meetings,
    COUNT(CASE WHEN meeting_count = 0 THEN 1 END) as clients_without_meetings
FROM (
    SELECT 
        c.id,
        COUNT(m.id) as meeting_count
    FROM clients c
    LEFT JOIN meetings m ON c.id = m.client_id AND m.userid = c.advisor_id
    WHERE c.advisor_id = 1
    GROUP BY c.id
) client_stats;

-- Success message
SELECT '🎉 CLEANUP COMPLETE! Only clients with meetings remain in the database.' as result;
SELECT 'The Clients page will now only show clients from Google Calendar sync or imported meetings.' as note;
