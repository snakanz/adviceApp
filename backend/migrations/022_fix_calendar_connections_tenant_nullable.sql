-- Fix calendar_connections table to make tenant_id nullable
-- This allows backwards compatibility with existing users who don't have a tenant_id yet

-- ============================================================================
-- STEP 1: Make tenant_id nullable in calendar_connections
-- ============================================================================

ALTER TABLE calendar_connections 
ALTER COLUMN tenant_id DROP NOT NULL;

-- ============================================================================
-- STEP 2: Update foreign key constraint to allow NULL
-- ============================================================================

-- Drop the existing foreign key constraint
ALTER TABLE calendar_connections
DROP CONSTRAINT IF EXISTS calendar_connections_tenant_id_fkey;

-- Add new foreign key constraint that allows NULL
ALTER TABLE calendar_connections
ADD CONSTRAINT calendar_connections_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 3: Backfill tenant_id for calendar connections without one
-- ============================================================================

-- For calendar connections without a tenant_id, try to get it from the user
UPDATE calendar_connections cc
SET tenant_id = u.tenant_id
FROM users u
WHERE cc.user_id = u.id
  AND cc.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Log the changes
-- ============================================================================

DO $$
DECLARE
    null_tenant_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM calendar_connections;
    SELECT COUNT(*) INTO null_tenant_count FROM calendar_connections WHERE tenant_id IS NULL;
    
    RAISE NOTICE '✅ Fixed calendar_connections schema:';
    RAISE NOTICE '   - Total connections: %', total_count;
    RAISE NOTICE '   - Connections without tenant_id: %', null_tenant_count;
    RAISE NOTICE '   - tenant_id is now nullable for backwards compatibility';
END $$;

