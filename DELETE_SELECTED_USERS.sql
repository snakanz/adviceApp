-- ============================================================================
-- DELETE SELECTED USERS
-- ============================================================================
-- Users to delete (from screenshot):
-- 1. Amelia Test (testamelia314@gmail.com) - UID: 5d04b552-44b3-47b7-b968-c36d48c27a46
-- 2. Nelson Greenwood (snaka.ntg@gmail.com) - UID: 60c71ae9-33c7-4720-b1d0-d4d5675ff45d
-- 3. Nelson Greenwood (nelson@greenwood.co.nz) - UID: 7532ec39-aa84-41b7-a352-853ff331d133
-- 4. Nelson Greenwood (nelson@advicly.co.uk) - UID: 9f427114-fa21-4086-8384-dd76d38b63e3
-- ============================================================================

-- OPTION 1: Delete by UID (Most Precise)
-- Copy and run this in Supabase SQL Editor

DO $$
DECLARE
  user_ids UUID[] := ARRAY[
    '5d04b552-44b3-47b7-b968-c36d48c27a46'::UUID,  -- testamelia314@gmail.com
    '60c71ae9-33c7-4720-b1d0-d4d5675ff45d'::UUID,  -- snaka.ntg@gmail.com
    '7532ec39-aa84-41b7-a352-853ff331d133'::UUID,  -- nelson@greenwood.co.nz
    '9f427114-fa21-4086-8384-dd76d38b63e3'::UUID   -- nelson@advicly.co.uk
  ];
  current_user_id UUID;
  user_email TEXT;
  deleted_count INT := 0;
BEGIN
  FOREACH current_user_id IN ARRAY user_ids
  LOOP
    -- Get email for logging
    SELECT email INTO user_email FROM users WHERE id = current_user_id;

    -- Delete related data first (in correct order to avoid foreign key violations)
    DELETE FROM email_templates WHERE user_id = current_user_id;
    DELETE FROM calendar_connections WHERE user_id = current_user_id;
    DELETE FROM meetings WHERE user_id = current_user_id;
    DELETE FROM clients WHERE user_id = current_user_id;

    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = current_user_id;

    -- Delete from users table
    DELETE FROM users WHERE id = current_user_id;

    deleted_count := deleted_count + 1;
    RAISE NOTICE 'Deleted user: % (UID: %)', user_email, current_user_id;
  END LOOP;

  RAISE NOTICE 'Successfully deleted % users', deleted_count;
END $$;

-- ============================================================================

-- OPTION 2: Delete by Email (Alternative)
-- If UIDs don't work, use this:

DO $$
DECLARE
  user_emails TEXT[] := ARRAY[
    'testamelia314@gmail.com',
    'snaka.ntg@gmail.com',
    'nelson@greenwood.co.nz',
    'nelson@advicly.co.uk'
  ];
  current_email TEXT;
  current_user_id UUID;
  deleted_count INT := 0;
BEGIN
  FOREACH current_email IN ARRAY user_emails
  LOOP
    -- Get user ID
    SELECT id INTO current_user_id FROM users WHERE email = current_email;

    IF current_user_id IS NOT NULL THEN
      -- Delete related data (in correct order to avoid foreign key violations)
      DELETE FROM email_templates WHERE user_id = current_user_id;
      DELETE FROM calendar_connections WHERE user_id = current_user_id;
      DELETE FROM meetings WHERE user_id = current_user_id;
      DELETE FROM clients WHERE user_id = current_user_id;

      -- Delete from auth.users
      DELETE FROM auth.users WHERE email = current_email;

      -- Delete from users table
      DELETE FROM users WHERE id = current_user_id;

      deleted_count := deleted_count + 1;
      RAISE NOTICE 'Deleted user: %', current_email;
    ELSE
      RAISE NOTICE 'User not found: %', current_email;
    END IF;
  END LOOP;

  RAISE NOTICE 'Successfully deleted % users', deleted_count;
END $$;

-- ============================================================================

-- OPTION 3: Preview Before Delete (SAFE - Just a SELECT)
-- Run this first to see what will be deleted:

SELECT
  u.id as uid,
  u.email,
  u.name as display_name,
  u.onboarding_completed,
  u.created_at,
  COUNT(DISTINCT cc.id) as calendar_connections,
  COUNT(DISTINCT m.id) as meetings,
  COUNT(DISTINCT c.id) as clients
FROM users u
LEFT JOIN calendar_connections cc ON cc.user_id = u.id
LEFT JOIN meetings m ON m.user_id = u.id
LEFT JOIN clients c ON c.user_id = u.id
WHERE u.id IN (
  '5d04b552-44b3-47b7-b968-c36d48c27a46',  -- testamelia314@gmail.com
  '60c71ae9-33c7-4720-b1d0-d4d5675ff45d',  -- snaka.ntg@gmail.com
  '7532ec39-aa84-41b7-a352-853ff331d133',  -- nelson@greenwood.co.nz
  '9f427114-fa21-4086-8384-dd76d38b63e3'   -- nelson@advicly.co.uk
)
GROUP BY u.id, u.email, u.name, u.onboarding_completed, u.created_at
ORDER BY u.created_at DESC;

-- ============================================================================
-- STEP BY STEP INSTRUCTIONS:
-- ============================================================================
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Create new query
-- 3. First, run OPTION 3 (preview) to verify users
-- 4. Then run OPTION 1 (delete by UID) - This is the safest
-- 5. Check the output messages to confirm deletion
-- 6. Refresh your Supabase Authentication page to verify
-- ============================================================================

-- ============================================================================
-- QUICK DELETE (One-liner for each user)
-- ============================================================================
-- Copy these one at a time if you prefer:

-- Delete Amelia Test
DELETE FROM email_templates WHERE user_id = '5d04b552-44b3-47b7-b968-c36d48c27a46';
DELETE FROM calendar_connections WHERE user_id = '5d04b552-44b3-47b7-b968-c36d48c27a46';
DELETE FROM meetings WHERE user_id = '5d04b552-44b3-47b7-b968-c36d48c27a46';
DELETE FROM clients WHERE user_id = '5d04b552-44b3-47b7-b968-c36d48c27a46';
DELETE FROM auth.users WHERE id = '5d04b552-44b3-47b7-b968-c36d48c27a46';
DELETE FROM users WHERE id = '5d04b552-44b3-47b7-b968-c36d48c27a46';

-- Delete Nelson Greenwood (snaka.ntg@gmail.com)
DELETE FROM email_templates WHERE user_id = '60c71ae9-33c7-4720-b1d0-d4d5675ff45d';
DELETE FROM calendar_connections WHERE user_id = '60c71ae9-33c7-4720-b1d0-d4d5675ff45d';
DELETE FROM meetings WHERE user_id = '60c71ae9-33c7-4720-b1d0-d4d5675ff45d';
DELETE FROM clients WHERE user_id = '60c71ae9-33c7-4720-b1d0-d4d5675ff45d';
DELETE FROM auth.users WHERE id = '60c71ae9-33c7-4720-b1d0-d4d5675ff45d';
DELETE FROM users WHERE id = '60c71ae9-33c7-4720-b1d0-d4d5675ff45d';

-- Delete Nelson Greenwood (nelson@greenwood.co.nz)
DELETE FROM email_templates WHERE user_id = '7532ec39-aa84-41b7-a352-853ff331d133';
DELETE FROM calendar_connections WHERE user_id = '7532ec39-aa84-41b7-a352-853ff331d133';
DELETE FROM meetings WHERE user_id = '7532ec39-aa84-41b7-a352-853ff331d133';
DELETE FROM clients WHERE user_id = '7532ec39-aa84-41b7-a352-853ff331d133';
DELETE FROM auth.users WHERE id = '7532ec39-aa84-41b7-a352-853ff331d133';
DELETE FROM users WHERE id = '7532ec39-aa84-41b7-a352-853ff331d133';

-- Delete Nelson Greenwood (nelson@advicly.co.uk)
DELETE FROM email_templates WHERE user_id = '9f427114-fa21-4086-8384-dd76d38b63e3';
DELETE FROM calendar_connections WHERE user_id = '9f427114-fa21-4086-8384-dd76d38b63e3';
DELETE FROM meetings WHERE user_id = '9f427114-fa21-4086-8384-dd76d38b63e3';
DELETE FROM clients WHERE user_id = '9f427114-fa21-4086-8384-dd76d38b63e3';
DELETE FROM auth.users WHERE id = '9f427114-fa21-4086-8384-dd76d38b63e3';
DELETE FROM users WHERE id = '9f427114-fa21-4086-8384-dd76d38b63e3';

-- ============================================================================
