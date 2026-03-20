-- ============================================================================
-- PIPELINE DATA MIGRATION: Single Source of Truth
-- ============================================================================
-- This migration copies existing pipeline data from the clients table
-- to the client_business_types table to establish a single source of truth.
--
-- WHAT THIS DOES:
-- 1. Migrates existing business_type, business_amount, and iaf_expected data
--    from clients table to client_business_types table
-- 2. Only migrates clients that have business_type set
-- 3. Skips clients that already have entries in client_business_types
-- 4. Preserves all existing data (non-destructive)
--
-- SAFE TO RUN MULTIPLE TIMES:
-- - Uses INSERT ... ON CONFLICT DO NOTHING to prevent duplicates
-- - Only migrates data that doesn't already exist
--
-- RUN THIS IN: Supabase SQL Editor
-- ============================================================================

-- Step 1: Show current state (for verification)
SELECT 
  'Clients with business_type in clients table' as description,
  COUNT(*) as count
FROM clients
WHERE business_type IS NOT NULL;

SELECT 
  'Existing entries in client_business_types table' as description,
  COUNT(*) as count
FROM client_business_types;

-- Step 2: Migrate data from clients table to client_business_types table
-- Only migrate clients that have business_type set and don't already have an entry
INSERT INTO client_business_types (
  client_id,
  business_type,
  business_amount,
  iaf_expected,
  contribution_method,
  regular_contribution_amount,
  notes,
  created_at,
  updated_at
)
SELECT 
  c.id as client_id,
  c.business_type,
  c.business_amount,
  c.iaf_expected,
  -- Map regular_contribution_type to contribution_method
  CASE 
    WHEN c.regular_contribution_type IS NOT NULL AND c.regular_contribution_type != '' 
    THEN 'Regular Monthly Contribution'
    ELSE NULL
  END as contribution_method,
  c.regular_contribution_amount,
  c.notes,
  NOW() as created_at,
  NOW() as updated_at
FROM clients c
WHERE 
  -- Only migrate clients with business_type set
  c.business_type IS NOT NULL 
  AND c.business_type != ''
  -- Skip clients that already have this business type in client_business_types
  AND NOT EXISTS (
    SELECT 1 
    FROM client_business_types cbt 
    WHERE cbt.client_id = c.id 
    AND cbt.business_type = c.business_type
  );

-- Step 3: Verify migration results
SELECT 
  'Clients migrated to client_business_types' as description,
  COUNT(*) as count
FROM client_business_types;

-- Step 4: Show sample of migrated data
SELECT 
  c.name as client_name,
  c.email as client_email,
  cbt.business_type,
  cbt.business_amount,
  cbt.iaf_expected,
  cbt.contribution_method,
  cbt.regular_contribution_amount
FROM client_business_types cbt
JOIN clients c ON c.id = cbt.client_id
ORDER BY cbt.created_at DESC
LIMIT 10;

-- Step 5: Verify data consistency
-- Show clients with data in both tables
SELECT 
  c.name,
  c.email,
  c.business_type as clients_table_type,
  c.business_amount as clients_table_amount,
  c.iaf_expected as clients_table_iaf,
  cbt.business_type as business_types_table_type,
  cbt.business_amount as business_types_table_amount,
  cbt.iaf_expected as business_types_table_iaf
FROM clients c
LEFT JOIN client_business_types cbt ON cbt.client_id = c.id
WHERE c.business_type IS NOT NULL
ORDER BY c.name
LIMIT 20;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- Next steps:
-- 1. Review the verification queries above
-- 2. Confirm data was migrated correctly
-- 3. Test the application to ensure pipeline data displays correctly
-- 4. Once confirmed, you can optionally clean up the old columns in clients table
--    (but keep them for now as backup)
-- ============================================================================

-- OPTIONAL: Clean up old columns (DO NOT RUN YET - keep as backup)
-- Uncomment these lines ONLY after confirming everything works:
/*
ALTER TABLE clients DROP COLUMN IF EXISTS business_type;
ALTER TABLE clients DROP COLUMN IF EXISTS business_amount;
ALTER TABLE clients DROP COLUMN IF EXISTS iaf_expected;
ALTER TABLE clients DROP COLUMN IF EXISTS regular_contribution_type;
ALTER TABLE clients DROP COLUMN IF EXISTS regular_contribution_amount;
*/

