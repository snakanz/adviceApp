#!/usr/bin/env node

/**
 * Apply Migration 020 using direct SQL execution
 * Executes each SQL statement individually
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const statements = [
  // Create tenants table
  `CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    business_type TEXT,
    team_size INTEGER,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timezone TEXT DEFAULT 'UTC',
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Create index for tenants
  `CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON tenants(owner_id)`,

  // Create tenant_members table
  `CREATE TABLE IF NOT EXISTS tenant_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
  )`,

  // Create indexes for tenant_members
  `CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON tenant_members(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON tenant_members(user_id)`,

  // Create calendar_connections table
  `CREATE TABLE IF NOT EXISTS calendar_connections (
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
  )`,

  // Create indexes for calendar_connections
  `CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON calendar_connections(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_calendar_connections_tenant_id ON calendar_connections(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider)`,

  // Add tenant_id to users table
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE`,
  `CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)`,

  // Add tenant_id to meetings table
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE`,
  `CREATE INDEX IF NOT EXISTS idx_meetings_tenant_id ON meetings(tenant_id)`,

  // Add tenant_id to clients table
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE`,
  `CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id)`
];

async function executeMigration() {
  console.log('🔄 APPLYING MIGRATION 020: MULTI-TENANT ONBOARDING');
  console.log('━'.repeat(80));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const stmtName = stmt.substring(0, 50).replace(/\n/g, ' ') + '...';
    
    try {
      console.log(`\n[${i + 1}/${statements.length}] Executing: ${stmtName}`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        // Check if it's an "already exists" error (non-critical)
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log('   ⚠️  Already exists (skipping)');
          successCount++;
        } else {
          console.error('   ❌ Error:', error.message);
          errorCount++;
        }
      } else {
        console.log('   ✅ Success');
        successCount++;
      }
    } catch (err) {
      console.error('   ❌ Exception:', err.message);
      errorCount++;
    }
  }

  console.log('\n' + '━'.repeat(80));
  console.log(`✅ Migration Complete: ${successCount} succeeded, ${errorCount} failed`);
  console.log('━'.repeat(80) + '\n');
}

executeMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

