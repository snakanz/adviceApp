-- SIMPLE DATA WIPE - Copy and paste this into Supabase SQL Editor
-- This will delete ALL your historical data to free up database space
-- WARNING: This cannot be undone!

-- Show what will be deleted first
SELECT 'BEFORE DELETION:' as info;
SELECT 'Meetings to delete:' as info, COUNT(*) as count FROM meetings WHERE userid = 1;
SELECT 'Clients to delete:' as info, COUNT(*) as count FROM clients WHERE advisor_id = 1;

-- Delete Ask Advicly data (if exists)
DELETE FROM ask_messages 
WHERE thread_id IN (SELECT id FROM ask_threads WHERE advisor_id = 1);

DELETE FROM ask_threads WHERE advisor_id = 1;

-- Delete all meetings for your account
DELETE FROM meetings WHERE userid = 1;

-- Delete all clients for your account  
DELETE FROM clients WHERE advisor_id = 1;

-- Delete calendar tokens (you'll need to re-authenticate)
DELETE FROM calendartoken WHERE userid = '1';

-- Reset the meetings ID sequence to start from 1
SELECT setval(pg_get_serial_sequence('meetings', 'id'), 1, false);

-- Verify deletion
SELECT 'AFTER DELETION:' as info;
SELECT 'Remaining meetings:' as info, COUNT(*) as count FROM meetings WHERE userid = 1;
SELECT 'Remaining clients:' as info, COUNT(*) as count FROM clients WHERE advisor_id = 1;
SELECT 'Your user account preserved:' as info, COUNT(*) as count FROM users WHERE id = 1;

-- Success message
SELECT '🎉 DATA WIPE COMPLETE! Your database is now clean and ready for fresh data.' as result;
