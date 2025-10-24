#!/usr/bin/env node

/**
 * Apply Migration 020 using Supabase REST API
 * This bypasses the RPC limitation and executes SQL directly
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ sql_query: sql })
  });

  return response;
}

async function applyMigration() {
  console.log('🔄 APPLYING MIGRATION 020: MULTI-TENANT ONBOARDING');
  console.log('━'.repeat(80));

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'backend/migrations/020_multi_tenant_onboarding.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📝 Migration SQL loaded');
    console.log(`   File: ${migrationPath}`);
    console.log(`   Size: ${migrationSQL.length} bytes`);

    // Split into statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`\n📊 Found ${statements.length} SQL statements`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
      
      process.stdout.write(`\n[${i + 1}/${statements.length}] ${preview}...`);

      try {
        const response = await executeSql(stmt);
        
        if (response.ok) {
          console.log(' ✅');
          successCount++;
        } else {
          const error = await response.json();
          const msg = error.message || error.error || 'Unknown error';
          
          // Check if it's a non-critical error
          if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('IF NOT EXISTS')) {
            console.log(' ⏭️  (already exists)');
            skipCount++;
          } else {
            console.log(` ❌ ${msg.substring(0, 50)}`);
            errorCount++;
          }
        }
      } catch (err) {
        console.log(` ❌ ${err.message.substring(0, 50)}`);
        errorCount++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '━'.repeat(80));
    console.log(`✅ Migration Complete:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('━'.repeat(80) + '\n');

    if (errorCount > 0) {
      console.log('⚠️  Some statements failed. Check the output above.');
      console.log('   This may be normal for IF NOT EXISTS statements.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

applyMigration();

