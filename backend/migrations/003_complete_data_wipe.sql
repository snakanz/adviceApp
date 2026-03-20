-- COMPLETE DATA WIPE - Start Fresh
-- This script removes ALL historical data while preserving user account and schema
-- WARNING: This is irreversible - all meetings, clients, and related data will be deleted

-- ============================================================================
-- SAFETY CHECK - Show what will be deleted
-- ============================================================================

SELECT 'BEFORE DELETION - Data to be removed:' as info;

-- Show meetings count
SELECT 
    'meetings' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN userid = 1 THEN 1 END) as user_records
FROM meetings;

-- Show clients count  
SELECT 
    'clients' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN advisor_id = 1 THEN 1 END) as user_records
FROM clients;

-- Show Ask Advicly data if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads') THEN
        PERFORM 1; -- Table exists, we'll show counts below
    END IF;
END $$;

SELECT 
    'ask_threads' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN advisor_id = 1 THEN 1 END) as user_records
FROM ask_threads
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads');

SELECT 
    'ask_messages' as table_name,
    COUNT(*) as total_records
FROM ask_messages
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_messages');

-- ============================================================================
-- STEP 1: DELETE ASK ADVICLY DATA (if exists)
-- ============================================================================

-- Delete Ask Advicly messages first (foreign key dependency)
DELETE FROM ask_messages 
WHERE thread_id IN (
    SELECT id FROM ask_threads WHERE advisor_id = 1
)
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_messages');

-- Delete Ask Advicly threads
DELETE FROM ask_threads WHERE advisor_id = 1
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads');

-- Show deletion results
SELECT 'Ask Advicly data deleted' as status;

-- ============================================================================
-- STEP 2: DELETE ALL MEETINGS DATA
-- ============================================================================

-- Delete all meetings for user 1 (your account)
DELETE FROM meetings WHERE userid = 1;

-- Show deletion results
SELECT 
    'meetings_after_deletion' as table_name,
    COUNT(*) as remaining_records,
    COUNT(CASE WHEN userid = 1 THEN 1 END) as user_records
FROM meetings;

-- ============================================================================
-- STEP 3: DELETE ALL CLIENTS DATA  
-- ============================================================================

-- Delete all clients for user 1 (your account)
DELETE FROM clients WHERE advisor_id = 1;

-- Show deletion results
SELECT 
    'clients_after_deletion' as table_name,
    COUNT(*) as remaining_records,
    COUNT(CASE WHEN advisor_id = 1 THEN 1 END) as user_records
FROM clients;

-- ============================================================================
-- STEP 4: CLEAN UP ANY OTHER USER-RELATED DATA
-- ============================================================================

-- Clean up calendar tokens (will force re-authentication)
DELETE FROM calendartoken WHERE userid = '1';

-- Note: We keep the users table record so you don't lose your account

-- ============================================================================
-- STEP 5: RESET AUTO-INCREMENT SEQUENCES (if any)
-- ============================================================================

-- Reset meetings sequence to start from 1 again
SELECT setval(pg_get_serial_sequence('meetings', 'id'), 1, false);

-- ============================================================================
-- STEP 6: VERIFICATION - Show final state
-- ============================================================================

SELECT 'AFTER COMPLETE WIPE - Final state:' as info;

-- Verify all data is gone
SELECT 
    'meetings_final' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN userid = 1 THEN 1 END) as user_records
FROM meetings;

SELECT 
    'clients_final' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN advisor_id = 1 THEN 1 END) as user_records
FROM clients;

SELECT 
    'ask_threads_final' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN advisor_id = 1 THEN 1 END) as user_records
FROM ask_threads
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads');

SELECT 
    'ask_messages_final' as table_name,
    COUNT(*) as total_records
FROM ask_messages
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_messages');

-- Show what's preserved
SELECT 
    'users_preserved' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN id = 1 THEN 1 END) as your_account
FROM users;

-- ============================================================================
-- STEP 7: SUMMARY AND NEXT STEPS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 COMPLETE DATA WIPE SUCCESSFUL!';
    RAISE NOTICE '';
    RAISE NOTICE 'WHAT WAS DELETED:';
    RAISE NOTICE '✅ All meetings and meeting data';
    RAISE NOTICE '✅ All clients and client data';
    RAISE NOTICE '✅ All Ask Advicly threads and messages';
    RAISE NOTICE '✅ Calendar tokens (will need to re-authenticate)';
    RAISE NOTICE '';
    RAISE NOTICE 'WHAT WAS PRESERVED:';
    RAISE NOTICE '✅ Your user account';
    RAISE NOTICE '✅ Database schema and structure';
    RAISE NOTICE '✅ All triggers and functions';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. You will need to re-authenticate with Google';
    RAISE NOTICE '2. Add meetings to your Google Calendar';
    RAISE NOTICE '3. Run calendar sync to import new meetings';
    RAISE NOTICE '4. Create new clients as needed';
    RAISE NOTICE '';
    RAISE NOTICE 'Your database is now completely clean and ready for fresh data!';
    RAISE NOTICE '';
END $$;
