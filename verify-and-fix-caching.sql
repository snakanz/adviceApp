-- Verification and Fix Script for AI Summary Smart Caching
-- Run this in Supabase SQL Editor to check status and fix issues

-- ============================================================================
-- STEP 1: Check if migration 032 was deployed
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'clients'
AND column_name = 'pipeline_data_updated_at';

-- Expected: Should return 1 row showing the column exists
-- If empty: Migration 032 was not run - run it from backend/migrations/032_add_pipeline_data_updated_at.sql


-- ============================================================================
-- STEP 2: Check trigger status
-- ============================================================================
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%pipeline_data%';

-- Expected: Should return 2 triggers:
--   1. trigger_update_pipeline_data_on_business_type_change (on client_business_types)
--   2. trigger_update_pipeline_data_on_meeting_change (on meetings)
-- After migration 033: Should also show trigger_update_pipeline_data_on_notes_change (on clients)


-- ============================================================================
-- STEP 3: Check current client data status
-- ============================================================================
SELECT
  id,
  name,
  pipeline_next_steps IS NOT NULL as has_summary,
  pipeline_next_steps_generated_at,
  pipeline_data_updated_at,
  updated_at,
  CASE
    WHEN pipeline_data_updated_at IS NULL THEN '⚠️  NULL (no tracked changes yet)'
    WHEN pipeline_next_steps_generated_at IS NULL THEN '❌ No summary generated yet'
    WHEN pipeline_data_updated_at <= pipeline_next_steps_generated_at THEN '✅ CACHED (will use cache)'
    ELSE '🔄 STALE (will regenerate)'
  END as cache_status,
  CASE
    WHEN pipeline_data_updated_at IS NOT NULL AND pipeline_next_steps_generated_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (pipeline_data_updated_at - pipeline_next_steps_generated_at))
    ELSE NULL
  END as seconds_difference
FROM clients
WHERE pipeline_next_steps IS NOT NULL
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 4: Fix Issue - Reset pipeline_data_updated_at to NULL for cached clients
-- ============================================================================
-- This ensures that clients with existing summaries will use the cache
-- Until their data actually changes (which will trigger the database triggers)

UPDATE clients
SET pipeline_data_updated_at = NULL
WHERE pipeline_next_steps IS NOT NULL
  AND pipeline_next_steps_generated_at IS NOT NULL
  AND (
    pipeline_data_updated_at IS NULL
    OR pipeline_data_updated_at <= pipeline_next_steps_generated_at
  );

-- Expected: Updates clients where summary exists and data hasn't changed
-- This ensures the cache logic treats them as "no changes yet"


-- ============================================================================
-- STEP 5: Verify fix worked
-- ============================================================================
SELECT
  COUNT(*) as total_clients_with_summaries,
  COUNT(CASE WHEN pipeline_data_updated_at IS NULL THEN 1 END) as will_use_cache,
  COUNT(CASE WHEN pipeline_data_updated_at > pipeline_next_steps_generated_at THEN 1 END) as will_regenerate
FROM clients
WHERE pipeline_next_steps IS NOT NULL;

-- Expected:
-- - will_use_cache should be high (most clients)
-- - will_regenerate should be 0 or very low (only clients with recent data changes)


-- ============================================================================
-- STEP 6: Test a single client manually
-- ============================================================================
-- Replace 'YOUR_CLIENT_ID' with an actual client ID to test
SELECT
  id,
  name,
  pipeline_data_updated_at,
  pipeline_next_steps_generated_at,
  CASE
    WHEN pipeline_data_updated_at IS NULL THEN 'Will use CACHE ✅'
    WHEN pipeline_data_updated_at <= pipeline_next_steps_generated_at THEN 'Will use CACHE ✅'
    ELSE 'Will REGENERATE 🔄'
  END as expected_behavior
FROM clients
WHERE id = 'YOUR_CLIENT_ID';


-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================
-- If cache is still not working after running this:
-- 1. Check backend logs when clicking into a client - look for the console.log messages
-- 2. Verify migration 032 is deployed (Step 1 should return a row)
-- 3. Verify triggers are created (Step 2 should return 2-3 rows)
-- 4. Deploy migration 033 to track pipeline notes changes
-- 5. Check browser console for: console.log('📊 AI Summary Response:', { cached: true/false })
