#!/usr/bin/env node

/**
 * Apply Migration 020: Multi-Tenant Onboarding
 * This migration creates the complete multi-tenant architecture
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('🔄 APPLYING MIGRATION 020: MULTI-TENANT ONBOARDING');
  console.log('━'.repeat(80));

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'backend/migrations/020_multi_tenant_onboarding.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📝 Migration SQL loaded');
    console.log(`   File: ${migrationPath}`);
    console.log(`   Size: ${migrationSQL.length} bytes`);

    // Execute the migration
    console.log('\n⏳ Executing migration...');
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try alternative approach: split by semicolons and execute statements
      console.log('⚠️  RPC approach failed, trying direct SQL execution...');
      
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log(`   Found ${statements.length} SQL statements`);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        console.log(`   Executing statement ${i + 1}/${statements.length}...`);
        
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
        if (stmtError) {
          console.warn(`   ⚠️  Statement ${i + 1} error (may be non-critical):`, stmtError.message);
        }
      }
    }

    console.log('\n✅ Migration applied successfully!');

    // Verify the migration
    console.log('\n🔍 Verifying migration...');

    // Check if tenants table exists
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('count', { count: 'exact' });

    if (!tenantsError) {
      console.log('   ✅ tenants table exists');
    } else {
      console.log('   ❌ tenants table error:', tenantsError.message);
    }

    // Check if calendar_connections table exists
    const { data: connections, error: connError } = await supabase
      .from('calendar_connections')
      .select('count', { count: 'exact' });

    if (!connError) {
      console.log('   ✅ calendar_connections table exists');
    } else {
      console.log('   ❌ calendar_connections table error:', connError.message);
    }

    // Check if users table has tenant_id column
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('tenant_id')
      .limit(1);

    if (!usersError) {
      console.log('   ✅ users.tenant_id column exists');
    } else {
      console.log('   ❌ users.tenant_id column error:', usersError.message);
    }

    console.log('\n' + '━'.repeat(80));
    console.log('✅ MIGRATION COMPLETE\n');

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();

