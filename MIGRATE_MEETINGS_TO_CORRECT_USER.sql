-- CRITICAL: Migrate Calendly meetings from wrong user to correct user
-- This fixes the multi-tenant data isolation bug

-- Step 1: Verify the situation
SELECT 'BEFORE MIGRATION:' as step;
SELECT 
  user_id,
  COUNT(*) as meeting_count,
  MIN(created_at) as first_meeting,
  MAX(created_at) as last_meeting
FROM meetings
WHERE meeting_source = 'calendly'
GROUP BY user_id
ORDER BY meeting_count DESC;

-- Step 2: Verify both users exist
SELECT 'Users in database:' as step;
SELECT id, email, created_at FROM users 
WHERE id IN ('4c903cdf-85ba-4608-8be9-23ec8bbbaa7d', '87b22d98-9347-48bc-b34a-b194ca0fd55f')
ORDER BY created_at;

-- Step 3: Migrate meetings to correct user
SELECT 'MIGRATING MEETINGS...' as step;
UPDATE meetings 
SET user_id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d'
WHERE user_id = '87b22d98-9347-48bc-b34a-b194ca0fd55f'
AND meeting_source = 'calendly';

-- Step 4: Verify migration
SELECT 'AFTER MIGRATION:' as step;
SELECT 
  user_id,
  COUNT(*) as meeting_count,
  MIN(created_at) as first_meeting,
  MAX(created_at) as last_meeting
FROM meetings
WHERE meeting_source = 'calendly'
GROUP BY user_id
ORDER BY meeting_count DESC;

-- Step 5: Check for any orphaned meetings
SELECT 'Checking for orphaned meetings (should be empty):' as step;
SELECT COUNT(*) as orphaned_count
FROM meetings
WHERE user_id = '87b22d98-9347-48bc-b34a-b194ca0fd55f';

-- Step 6: Delete duplicate user
SELECT 'DELETING DUPLICATE USER...' as step;
DELETE FROM users 
WHERE id = '87b22d98-9347-48bc-b34a-b194ca0fd55f';

-- Step 7: Final verification
SELECT 'FINAL VERIFICATION:' as step;
SELECT 
  'Correct user' as user_type,
  id,
  email,
  (SELECT COUNT(*) FROM meetings WHERE user_id = users.id AND meeting_source = 'calendly') as calendly_meetings
FROM users
WHERE id = '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d';

SELECT 'MIGRATION COMPLETE!' as result;
