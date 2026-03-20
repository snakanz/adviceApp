#!/usr/bin/env node
/**
 * Supabase Connection Test Script
 * Run: node test-supabase-connection.js
 * 
 * Requires environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)
 */

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

async function testSupabaseConnection() {
  console.log('\n🔌 SUPABASE CONNECTION TEST');
  console.log('='.repeat(50));

  // Get credentials
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  // Check environment variables
  console.log('\n📋 Environment Check:');
  console.log(`  SUPABASE_URL: ${supabaseUrl ? '✅ SET' : '❌ MISSING'}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : '❌ MISSING'}`);
  console.log(`  SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING'}`);

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Missing required Supabase credentials!');
    console.log('\nPlease create backend/.env with:');
    console.log('  SUPABASE_URL=https://your-project.supabase.co');
    console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    process.exit(1);
  }

  console.log(`\n🌐 Connecting to: ${supabaseUrl}`);

  // Create client
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Test 1: Basic connection with a simple query
    console.log('\n📡 Test 1: Basic Connection');
    const start = Date.now();
    const { data, error } = await supabase.from('users').select('count').limit(1);
    const elapsed = Date.now() - start;

    if (error) {
      console.log(`  ❌ Failed: ${error.message}`);
      if (error.code === 'PGRST301') {
        console.log('  ℹ️  This might be an RLS policy issue');
      }
    } else {
      console.log(`  ✅ Connected successfully (${elapsed}ms)`);
    }

    // Test 2: List tables
    console.log('\n📊 Test 2: Check Available Tables');
    const tables = ['users', 'clients', 'meetings', 'calendar_connections', 'subscriptions'];
    
    for (const table of tables) {
      const { count, error: tableError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (tableError) {
        console.log(`  ❌ ${table}: ${tableError.message}`);
      } else {
        console.log(`  ✅ ${table}: ${count ?? 0} rows`);
      }
    }

    // Test 3: Auth service check
    console.log('\n🔐 Test 3: Auth Service');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.log(`  ⚠️  Auth check: ${authError.message}`);
    } else {
      console.log(`  ✅ Auth service responding`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ SUPABASE CONNECTION TEST COMPLETE\n');

  } catch (err) {
    console.error('\n❌ Connection failed:', err.message);
    process.exit(1);
  }
}

testSupabaseConnection();

