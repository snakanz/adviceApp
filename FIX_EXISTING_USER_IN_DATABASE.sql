-- Fix: Add existing Supabase auth user to database users table
-- This fixes the issue where user exists in Supabase Authentication but not in the database

-- Step 1: Check if user already exists in database
SELECT 'Checking if user exists in database...' as step;
SELECT id, email, name FROM users WHERE email = 'snaka1003@gmail.com';

-- Step 2: If user doesn't exist, insert them
-- The UUID 4c903cdf-85ba-4608-8be9-23ec8bbbaa7d is from Supabase Authentication
INSERT INTO users (id, email, name, provider, providerid, created_at, updated_at)
VALUES (
  '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d'::uuid,
  'snaka1003@gmail.com',
  'Nelson Greenwood',
  'google',
  '4c903cdf-85ba-4608-8be9-23ec8bbbaa7d',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Verify user was created
SELECT 'User in database after insert:' as step;
SELECT id, email, name, provider, created_at FROM users WHERE email = 'snaka1003@gmail.com';

-- Step 4: Verify RLS is working
SELECT 'Checking RLS policies on users table:' as step;
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Step 5: Summary
SELECT 'DONE: User should now be able to log in and complete onboarding' as result;

