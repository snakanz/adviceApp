-- ============================================================================
-- DELETE TEST USERS - For Testing Login/Onboarding Flow
-- ============================================================================
-- Run this in Supabase SQL Editor to remove test users and all their data
-- ⚠️ WARNING: This will permanently delete user data. Use only for testing!
-- ============================================================================

-- OPTION 1: Delete a specific user by email
-- Uncomment and replace with your test email:

-- DELETE FROM calendar_connections WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
-- DELETE FROM meetings WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
-- DELETE FROM clients WHERE user_id = (SELECT id FROM users WHERE email = 'holly@advicly.co.uk');
-- DELETE FROM auth.users WHERE email = 'holly@advicly.co.uk';
-- DELETE FROM users WHERE email = 'holly@advicly.co.uk';

-- ============================================================================

-- OPTION 2: Delete all test users (emails with +test, +mobile, etc.)
-- Uncomment to use:

-- DELETE FROM calendar_connections
-- WHERE user_id IN (
--   SELECT id FROM users
--   WHERE email LIKE '%+test%'
--      OR email LIKE '%+mobile%'
--      OR email LIKE '%+signup%'
--      OR email LIKE '%@example.com'
--      OR email LIKE '%@fake.com'
-- );

-- DELETE FROM meetings
-- WHERE user_id IN (
--   SELECT id FROM users
--   WHERE email LIKE '%+test%'
--      OR email LIKE '%+mobile%'
--      OR email LIKE '%+signup%'
--      OR email LIKE '%@example.com'
--      OR email LIKE '%@fake.com'
-- );

-- DELETE FROM clients
-- WHERE user_id IN (
--   SELECT id FROM users
--   WHERE email LIKE '%+test%'
--      OR email LIKE '%+mobile%'
--      OR email LIKE '%+signup%'
--      OR email LIKE '%@example.com'
--      OR email LIKE '%@fake.com'
-- );

-- DELETE FROM auth.users
-- WHERE email LIKE '%+test%'
--    OR email LIKE '%+mobile%'
--    OR email LIKE '%+signup%'
--    OR email LIKE '%@example.com'
--    OR email LIKE '%@fake.com';

-- DELETE FROM users
-- WHERE email LIKE '%+test%'
--    OR email LIKE '%+mobile%'
--    OR email LIKE '%+signup%'
--    OR email LIKE '%@example.com'
--    OR email LIKE '%@fake.com';

-- ============================================================================

-- OPTION 3: Delete users created in the last X hours
-- Useful for cleaning up recent test signups
-- Uncomment and adjust the time period:

-- DELETE FROM calendar_connections
-- WHERE user_id IN (
--   SELECT id FROM users
--   WHERE created_at > NOW() - INTERVAL '24 hours'
-- );

-- DELETE FROM meetings
-- WHERE user_id IN (
--   SELECT id FROM users
--   WHERE created_at > NOW() - INTERVAL '24 hours'
-- );

-- DELETE FROM clients
-- WHERE user_id IN (
--   SELECT id FROM users
--   WHERE created_at > NOW() - INTERVAL '24 hours'
-- );

-- DELETE FROM auth.users
-- WHERE created_at > NOW() - INTERVAL '24 hours';

-- DELETE FROM users
-- WHERE created_at > NOW() - INTERVAL '24 hours';

-- ============================================================================

-- OPTION 4: View users before deleting (SAFE - just a query)
-- Run this first to see what would be deleted:

SELECT
  u.id,
  u.email,
  u.name,
  u.onboarding_completed,
  u.onboarding_step,
  u.created_at,
  COUNT(DISTINCT cc.id) as calendar_connections,
  COUNT(DISTINCT m.id) as meetings,
  COUNT(DISTINCT c.id) as clients
FROM users u
LEFT JOIN calendar_connections cc ON cc.user_id = u.id
LEFT JOIN meetings m ON m.user_id = u.id
LEFT JOIN clients c ON c.user_id = u.id
WHERE u.email = 'holly@advicly.co.uk'
   -- OR u.email LIKE '%+test%'
   -- OR u.email LIKE '%@example.com'
   -- OR u.created_at > NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.email, u.name, u.onboarding_completed, u.onboarding_step, u.created_at
ORDER BY u.created_at DESC;

-- ============================================================================

-- OPTION 5: Complete cleanup for a specific user (RECOMMENDED)
-- This is the safest way - one user at a time
-- Replace 'test@example.com' with your test user email:

DO $$
DECLARE
  test_email TEXT := 'holly@advicly.co.uk'; -- ← CHANGE THIS
  test_user_id UUID;
BEGIN
  -- Get the user ID
  SELECT id INTO test_user_id FROM users WHERE email = test_email;

  IF test_user_id IS NOT NULL THEN
    -- Delete all related data
    DELETE FROM calendar_connections WHERE user_id = test_user_id;
    DELETE FROM meetings WHERE user_id = test_user_id;
    DELETE FROM clients WHERE user_id = test_user_id;
    DELETE FROM action_items WHERE user_id = test_user_id;
    DELETE FROM meeting_transcripts WHERE meeting_id IN (SELECT id FROM meetings WHERE user_id = test_user_id);

    -- Delete from auth.users (Supabase Auth)
    DELETE FROM auth.users WHERE email = test_email;

    -- Delete from users table
    DELETE FROM users WHERE id = test_user_id;

    RAISE NOTICE 'Successfully deleted user: %', test_email;
  ELSE
    RAISE NOTICE 'User not found: %', test_email;
  END IF;
END $$;

-- ============================================================================
-- USAGE INSTRUCTIONS:
-- ============================================================================
--
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Create a new query
-- 3. Choose ONE of the options above and uncomment it
-- 4. For OPTION 5 (recommended):
--    - Change test_email to your test user's email
--    - Run the query
-- 5. Refresh your Supabase dashboard to confirm deletion
-- 6. Now you can test signup/login flow from scratch!
--
-- ============================================================================
