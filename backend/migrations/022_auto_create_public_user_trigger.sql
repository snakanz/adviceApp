-- ============================================================================
-- MIGRATION: AUTO-CREATE PUBLIC.USERS TRIGGER
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- PURPOSE:
-- Automatically create a row in public.users whenever a new user signs up
-- via ANY method (email/password, Google OAuth, Microsoft OAuth, etc.)
--
-- WHY THIS IS NEEDED:
-- - Google/Microsoft OAuth: Backend callbacks create public.users ✅
-- - Email/Password signup: No backend callback, user row never created ❌
-- - This trigger ensures ALL signup methods create the user row
--
-- WHAT THIS PREVENTS:
-- 1. Users signing up via email/password getting stuck on login
-- 2. App crashes when trying to read non-existent user data  
-- 3. Onboarding failures due to missing user records
-- 4. "User not found" errors after successful authentication
-- 5. Inconsistent user creation across different signup methods
--
-- AFFECTED USERS BEFORE THIS FIX:
-- - Ed Horler (eh@1oakgroup.com) - signed up via email, got stuck
-- ============================================================================

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_email TEXT;
  user_provider TEXT;
BEGIN
  -- Extract email from the new auth user
  user_email := NEW.email;
  
  -- Extract name from user metadata (Google/Microsoft set this, email signup might not)
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(user_email, '@', 1)  -- Fallback to email username
  );
  
  -- Get the provider (google, azure, email, etc.)
  user_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  
  -- Check if user already exists in public.users
  -- (OAuth callbacks might have already created it - avoid duplicates)
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    -- Insert the new user with default onboarding state
    INSERT INTO public.users (
      id,
      email,
      name,
      provider,
      providerid,
      onboarding_completed,
      onboarding_step,
      timezone,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      user_email,
      user_name,
      user_provider,
      NEW.id::TEXT,
      FALSE,
      0,
      'UTC',
      NOW(),
      NOW()
    );
    
    RAISE LOG '[AUTO-USER-TRIGGER] Created public.users row for: % (%) via %', 
      user_email, NEW.id, user_provider;
  ELSE
    RAISE LOG '[AUTO-USER-TRIGGER] User already exists, skipping: % (%)', 
      user_email, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 3: Create the trigger on auth.users (fires AFTER INSERT)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Step 4: Grant necessary permissions to auth admin
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.users TO supabase_auth_admin;

-- Step 5: Verify the trigger was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE '✅ SUCCESS: Auto-user trigger created successfully!';
    RAISE NOTICE '   All new signups will now automatically get a public.users row.';
  ELSE
    RAISE EXCEPTION '❌ FAILED: Trigger was not created!';
  END IF;
END $$;

