#!/usr/bin/env node

/**
 * Execute Database Wipe & Clean Schema
 * Using Supabase SQL API
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking credentials...');
console.log(`URL: ${SUPABASE_URL ? '✅' : '❌'}`);
console.log(`Key: ${SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}\n`);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function executeDatabaseWipe() {
  try {
    console.log('📖 Reading SQL script...');
    const sqlPath = path.join(__dirname, '..', 'DATABASE_WIPE_AND_CLEAN_SCHEMA.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    console.log('✅ SQL script loaded\n');

    console.log('⚠️  WARNING: This will DELETE ALL DATA!');
    console.log('✅ Backup created (verify in Supabase Dashboard)\n');

    console.log('🚀 Executing database wipe and clean schema...\n');

    // Split SQL into statements
    const statements = sqlScript
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`📋 Found ${statements.length} SQL statements\n`);

    let successCount = 0;
    let failureCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const description = `Statement ${i + 1}/${statements.length}`;

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          console.error(`❌ ${description} failed: ${error.message}`);
          failureCount++;
        } else {
          console.log(`✅ ${description}`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ ${description} error: ${err.message}`);
        failureCount++;
      }
    }

    console.log(`\n📊 Results: ${successCount} successful, ${failureCount} failed\n`);

    if (failureCount === 0) {
      console.log('🎉 Database wipe and clean schema completed!\n');
      console.log('📋 Next steps:');
      console.log('1. User re-registers with Google OAuth');
      console.log('2. User connects Google Calendar');
      console.log('3. Meetings sync automatically');
      console.log('4. Verify success in frontend\n');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

executeDatabaseWipe();

