-- ============================================================================
-- FIX RLS POLICIES - Remove Infinite Recursion
-- ============================================================================
-- This migration fixes the infinite recursion issue in tenant_members policies
-- by simplifying the policies to avoid circular dependencies
-- ============================================================================

-- Drop existing problematic policies
DROP POLICY IF EXISTS tenant_members_select_policy ON tenant_members;
DROP POLICY IF EXISTS tenant_members_insert_policy ON tenant_members;
DROP POLICY IF EXISTS tenant_members_update_policy ON tenant_members;
DROP POLICY IF EXISTS tenant_members_delete_policy ON tenant_members;

-- Create simpler, non-recursive policies for tenant_members

-- Policy: Users can see their own membership records
CREATE POLICY tenant_members_select_policy ON tenant_members
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy: Service role can insert (backend will handle this)
-- Users cannot directly insert themselves into tenants
CREATE POLICY tenant_members_insert_policy ON tenant_members
    FOR INSERT
    WITH CHECK (false); -- Only backend with service role can insert

-- Policy: Users cannot update tenant memberships
CREATE POLICY tenant_members_update_policy ON tenant_members
    FOR UPDATE
    USING (false);

-- Policy: Users cannot delete tenant memberships
CREATE POLICY tenant_members_delete_policy ON tenant_members
    FOR DELETE
    USING (false);

-- ============================================================================
-- Update tenants policies to be simpler
-- ============================================================================

-- Drop existing tenant policies
DROP POLICY IF EXISTS tenants_select_policy ON tenants;
DROP POLICY IF EXISTS tenants_update_policy ON tenants;
DROP POLICY IF EXISTS tenants_delete_policy ON tenants;
DROP POLICY IF EXISTS tenants_insert_policy ON tenants;

-- Create simpler tenant policies

-- Policy: Users can only see their own tenant (as owner)
CREATE POLICY tenants_select_policy ON tenants
    FOR SELECT
    USING (owner_id = auth.uid());

-- Policy: Only owners can update their tenants
CREATE POLICY tenants_update_policy ON tenants
    FOR UPDATE
    USING (owner_id = auth.uid());

-- Policy: Only owners can delete their tenants
CREATE POLICY tenants_delete_policy ON tenants
    FOR DELETE
    USING (owner_id = auth.uid());

-- Policy: Service role can insert (backend will handle this)
CREATE POLICY tenants_insert_policy ON tenants
    FOR INSERT
    WITH CHECK (false); -- Only backend with service role can insert

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies fixed - infinite recursion removed';
    RAISE NOTICE '📋 tenant_members policies now use simple user_id check';
    RAISE NOTICE '📋 tenants policies now use simple owner_id check';
    RAISE NOTICE '🔒 INSERT operations restricted to service role (backend)';
END $$;

