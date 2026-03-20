#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xjqjzievgepqpgtggcjx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcWp6aWV2Z2VwcXBndGdnY2p4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTk4NjI1OSwiZXhwIjoyMDY3NTYyMjU5fQ.ylRp76JcY8k-pysVJ7jeP6brK8QiqO6M7xC6HqJxst0'
);

async function checkMigration() {
  console.log('🔍 Checking database schema...\n');
  
  // Test 1: Check if tenants table exists
  const { data, error } = await supabase
    .from('tenants')
    .select('count', { count: 'exact' })
    .limit(1);
  
  if (error && error.message.includes('does not exist')) {
    console.log('❌ tenants table does NOT exist - migration needed');
  } else if (error) {
    console.log('⚠️  Tenants error:', error.message);
  } else {
    console.log('✅ tenants table EXISTS');
  }

  // Test 2: Check if users.tenant_id exists
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('tenant_id')
    .limit(1);
  
  if (usersError && usersError.message.includes('tenant_id')) {
    console.log('❌ users.tenant_id column does NOT exist - migration needed');
  } else if (usersError) {
    console.log('⚠️  Users error:', usersError.message);
  } else {
    console.log('✅ users.tenant_id column EXISTS');
  }

  // Test 3: Check if calendar_connections table exists
  const { data: conns, error: connsError } = await supabase
    .from('calendar_connections')
    .select('count', { count: 'exact' })
    .limit(1);
  
  if (connsError && connsError.message.includes('does not exist')) {
    console.log('❌ calendar_connections table does NOT exist - migration needed');
  } else if (connsError) {
    console.log('⚠️  Calendar connections error:', connsError.message);
  } else {
    console.log('✅ calendar_connections table EXISTS');
  }

  console.log('\n' + '━'.repeat(60));
  console.log('To apply migration 020, copy and paste the contents of:');
  console.log('  MIGRATION_020_READY_TO_APPLY.sql');
  console.log('into the Supabase SQL Editor and run it.');
  console.log('━'.repeat(60));
}

checkMigration();

