-- ============================================================================
-- MULTI-TENANT ONBOARDING MIGRATION
-- ============================================================================
-- This migration creates the complete multi-tenant architecture for Advicly
-- including tenants, tenant members, and calendar connections tables.
-- It also adds tenant_id to all existing data tables for proper isolation.
--
-- IMPORTANT: This assumes users table already has UUID id column and 
-- onboarding tracking columns (onboarding_completed, onboarding_step, etc.)
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE TENANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    business_type TEXT, -- 'Financial Advisor', 'Wealth Manager', etc.
    team_size INTEGER,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Settings
    timezone TEXT DEFAULT 'UTC',
    currency TEXT DEFAULT 'USD',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster owner lookups
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants(owner_id);

-- Add comment
COMMENT ON TABLE tenants IS 'Business/organization tenants for multi-tenant architecture';

-- ============================================================================
-- STEP 2: CREATE TENANT_MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    
    -- Permissions (for future use)
    permissions JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a user can only be in a tenant once
    UNIQUE(tenant_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON tenant_members(user_id);

-- Add comment
COMMENT ON TABLE tenant_members IS 'Maps users to tenants with their roles';

-- ============================================================================
-- STEP 3: CREATE CALENDAR_CONNECTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to user and tenant
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Calendar provider info
    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'calendly')),
    provider_account_email TEXT, -- Email of the calendar account
    
    -- OAuth tokens (encrypted at application level)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Calendly-specific fields
    calendly_user_uri TEXT,
    calendly_organization_uri TEXT,
    calendly_webhook_id TEXT,
    
    -- Google Calendar webhook fields
    google_channel_id TEXT,
    google_resource_id TEXT,
    google_webhook_expiration TIMESTAMP WITH TIME ZONE,
    
    -- Status flags
    is_primary BOOLEAN DEFAULT FALSE, -- Primary calendar for this user
    is_active BOOLEAN DEFAULT TRUE,
    sync_enabled BOOLEAN DEFAULT TRUE,
    
    -- Sync tracking
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status TEXT, -- 'success', 'failed', 'in_progress'
    sync_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique calendar connection per user/provider/account
    UNIQUE(user_id, provider, provider_account_email)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_tenant_id ON calendar_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);

-- Add comment
COMMENT ON TABLE calendar_connections IS 'Calendar integration connections for users (Google, Outlook, Calendly)';

-- ============================================================================
-- STEP 4: ADD TENANT_ID TO EXISTING TABLES
-- ============================================================================

-- Add tenant_id to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- Add tenant_id to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_meetings_tenant_id ON meetings(tenant_id);

-- Add tenant_id to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);

-- Add tenant_id to advisor_tasks table (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advisor_tasks') THEN
        ALTER TABLE advisor_tasks 
        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_advisor_tasks_tenant_id ON advisor_tasks(tenant_id);
    END IF;
END $$;

-- Add tenant_id to client_documents table (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_documents') THEN
        ALTER TABLE client_documents 
        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_client_documents_tenant_id ON client_documents(tenant_id);
    END IF;
END $$;

-- Add tenant_id to ask_threads table (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ask_threads') THEN
        ALTER TABLE ask_threads 
        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_ask_threads_tenant_id ON ask_threads(tenant_id);
    END IF;
END $$;

-- Add tenant_id to transcript_action_items table (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_action_items') THEN
        ALTER TABLE transcript_action_items 
        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_transcript_action_items_tenant_id ON transcript_action_items(tenant_id);
    END IF;
END $$;

-- ============================================================================
-- STEP 5: ADD CALENDAR_CONNECTION_ID TO MEETINGS TABLE
-- ============================================================================

-- Link meetings to the calendar connection they came from
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS calendar_connection_id UUID REFERENCES calendar_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_calendar_connection_id ON meetings(calendar_connection_id);

-- ============================================================================
-- STEP 6: CREATE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see tenants they own or are members of
CREATE POLICY tenants_select_policy ON tenants
    FOR SELECT
    USING (
        owner_id = auth.uid() OR
        id IN (
            SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        )
    );

-- Policy: Only owners can update their tenants
CREATE POLICY tenants_update_policy ON tenants
    FOR UPDATE
    USING (owner_id = auth.uid());

-- Policy: Only owners can delete their tenants
CREATE POLICY tenants_delete_policy ON tenants
    FOR DELETE
    USING (owner_id = auth.uid());

-- Policy: Any authenticated user can create a tenant
CREATE POLICY tenants_insert_policy ON tenants
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Enable RLS on tenant_members table
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see members of tenants they belong to
CREATE POLICY tenant_members_select_policy ON tenant_members
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
        )
    );

-- Policy: Only owners and admins can add members
CREATE POLICY tenant_members_insert_policy ON tenant_members
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Policy: Only owners and admins can update members
CREATE POLICY tenant_members_update_policy ON tenant_members
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Policy: Only owners and admins can remove members
CREATE POLICY tenant_members_delete_policy ON tenant_members
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Enable RLS on calendar_connections table
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own calendar connections
CREATE POLICY calendar_connections_select_policy ON calendar_connections
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy: Users can only create their own calendar connections
CREATE POLICY calendar_connections_insert_policy ON calendar_connections
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can only update their own calendar connections
CREATE POLICY calendar_connections_update_policy ON calendar_connections
    FOR UPDATE
    USING (user_id = auth.uid());

-- Policy: Users can only delete their own calendar connections
CREATE POLICY calendar_connections_delete_policy ON calendar_connections
    FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- STEP 7: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's tenant_id
CREATE OR REPLACE FUNCTION get_user_tenant_id(user_uuid UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT tenant_id FROM users WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is tenant owner
CREATE OR REPLACE FUNCTION is_tenant_owner(user_uuid UUID, tenant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenants 
        WHERE id = tenant_uuid AND owner_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ Multi-tenant onboarding migration completed successfully!';
    RAISE NOTICE '📋 Created tables: tenants, tenant_members, calendar_connections';
    RAISE NOTICE '📋 Added tenant_id to: users, meetings, clients, and other tables';
    RAISE NOTICE '🔒 Enabled RLS policies for tenant isolation';
END $$;

