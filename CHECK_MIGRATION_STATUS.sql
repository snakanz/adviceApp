-- ============================================================================
-- CHECK MIGRATION STATUS - UNIFIED QUERY
-- ============================================================================
-- Run this in Supabase SQL Editor to check if migrations have been completed
-- This version returns all checks in a single result set
-- ============================================================================

WITH checks AS (
  -- Check 1: Is users table using UUID?
  SELECT
      1 as check_order,
      'users.id column type' as check_name,
      data_type as result,
      CASE
          WHEN data_type = 'uuid' THEN '✅ MIGRATED'
          ELSE '❌ NOT MIGRATED - Run PHASE1_MULTI_TENANT_MIGRATION_FIXED.sql'
      END as status
  FROM information_schema.columns
  WHERE table_name = 'users'
  AND column_name = 'id'

  UNION ALL

  -- Check 2: Does calendar_integrations table exist?
  SELECT
      2 as check_order,
      'calendar_integrations table' as check_name,
      CASE
          WHEN EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_name = 'calendar_integrations'
          ) THEN 'EXISTS'
          ELSE 'MISSING'
      END as result,
      CASE
          WHEN EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_name = 'calendar_integrations'
          ) THEN '✅ MIGRATED'
          ELSE '❌ NOT MIGRATED - Run PHASE1_MULTI_TENANT_MIGRATION_PART2.sql'
      END as status

  UNION ALL

  -- Check 3: Are there any users in the new users table?
  SELECT
      3 as check_order,
      'users count' as check_name,
      COUNT(*)::text as result,
      CASE
          WHEN COUNT(*) > 0 THEN '✅ HAS DATA'
          ELSE '⚠️ NO USERS - Migration may not have run'
      END as status
  FROM users

  UNION ALL

  -- Check 4: Check if backup tables exist
  SELECT
      4 as check_order,
      '_backup_users table' as check_name,
      CASE
          WHEN EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_name = '_backup_users'
          ) THEN 'EXISTS'
          ELSE 'MISSING'
      END as result,
      CASE
          WHEN EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_name = '_backup_users'
          ) THEN '✅ Migration was run (backup exists)'
          ELSE '⚠️ No backup found - migration may not have run'
      END as status

  UNION ALL

  -- Check 5: Check if old users table exists
  SELECT
      5 as check_order,
      '_old_users table' as check_name,
      CASE
          WHEN EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_name = '_old_users'
          ) THEN 'EXISTS'
          ELSE 'MISSING'
      END as result,
      CASE
          WHEN EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_name = '_old_users'
          ) THEN '✅ Migration was run (old table renamed)'
          ELSE '⚠️ Old table not found'
      END as status

  UNION ALL

  -- Check 6: Check RLS policies on users table
  SELECT
      6 as check_order,
      'RLS policies on users' as check_name,
      COUNT(*)::text as result,
      CASE
          WHEN COUNT(*) > 0 THEN '✅ RLS policies exist'
          ELSE '❌ NO RLS POLICIES - Run PART2 migration'
      END as status
  FROM pg_policies
  WHERE tablename = 'users'

  UNION ALL

  -- Check 7: Check RLS policies on calendar_integrations
  SELECT
      7 as check_order,
      'RLS policies on calendar_integrations' as check_name,
      COUNT(*)::text as result,
      CASE
          WHEN COUNT(*) > 0 THEN '✅ RLS policies exist'
          ELSE '❌ NO RLS POLICIES - Run PART2 migration'
      END as status
  FROM pg_policies
  WHERE tablename = 'calendar_integrations'
)
SELECT check_name, result, status
FROM checks
ORDER BY check_order;

-- ============================================================================
-- SUMMARY: What to do based on results
-- ============================================================================
-- 
-- If users.id is NOT uuid:
--   → Run PHASE1_MULTI_TENANT_MIGRATION_FIXED.sql
--
-- If calendar_integrations table is MISSING:
--   → Run PHASE1_MULTI_TENANT_MIGRATION_PART2.sql
--
-- If both are done:
--   → ✅ Migrations complete! Move to next step (environment variables)
-- ============================================================================

