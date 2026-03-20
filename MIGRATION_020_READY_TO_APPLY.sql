-- ============================================================================
-- MIGRATION 020: MULTI-TENANT ONBOARDING - READY TO APPLY
-- ============================================================================
-- Copy and paste this entire file into Supabase SQL Editor and run
-- This creates the complete multi-tenant architecture
-- ============================================================================

-- Step 1: Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    business_type TEXT,
    team_size INTEGER,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timezone TEXT DEFAULT 'UTC',
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants(owner_id);

-- Step 2: Create tenant_members table
CREATE TABLE IF NOT EXISTS tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON tenant_members(user_id);

-- Step 3: Create calendar_connections table
CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'calendly')),
    provider_account_email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    calendly_user_uri TEXT,
    calendly_organization_uri TEXT,
    calendly_webhook_id TEXT,
    google_channel_id TEXT,
    google_resource_id TEXT,
    google_webhook_expiration TIMESTAMP WITH TIME ZONE,
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status TEXT,
    sync_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, provider_account_email)
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_tenant_id ON calendar_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);

-- Step 4: Add tenant_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- Step 5: Add tenant_id to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_meetings_tenant_id ON meetings(tenant_id);

-- Step 6: Add tenant_id to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);

-- Step 7: Verify migration
SELECT 'Migration 020 applied successfully!' as status;
SELECT 'Tables created:' as info;
SELECT tablename FROM pg_tables WHERE tablename IN ('tenants', 'tenant_members', 'calendar_connections') AND schemaname = 'public';
SELECT 'Columns added to users:' as info;
SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id';

