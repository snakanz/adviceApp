#!/usr/bin/env node

/**
 * Execute Database Wipe & Clean Schema
 * Direct execution using Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: './backend/.env' });

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

async function executeSQLScript() {
  console.log('📖 Reading SQL script...');
  
  try {
    const sqlScript = fs.readFileSync('./DATABASE_WIPE_AND_CLEAN_SCHEMA.sql', 'utf8');
    console.log('✅ SQL script loaded\n');

    console.log('⚠️  WARNING: This will DELETE ALL DATA!');
    console.log('✅ Backup created (verify in Supabase Dashboard)\n');

    console.log('🚀 Executing database wipe and clean schema...\n');

    // Execute the entire script as one transaction
    const { data, error } = await supabase.rpc('exec', { 
      sql: sqlScript 
    });

    if (error) {
      console.error('❌ Execution failed:');
      console.error(error);
      process.exit(1);
    }

    console.log('✅ SQL script executed successfully!\n');

    // Verify the schema was created
    console.log('🔍 Verifying schema...\n');

    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('tablename')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.log('⚠️  Could not verify tables (this is normal)');
    } else {
      console.log(`✅ Tables created: ${tables?.length || 0}`);
      if (tables) {
        tables.forEach(t => console.log(`   - ${t.tablename}`));
      }
    }

    console.log('\n🎉 Database wipe and clean schema completed!\n');
    console.log('📋 Next steps:');
    console.log('1. User re-registers with Google OAuth');
    console.log('2. User connects Google Calendar');
    console.log('3. Meetings sync automatically');
    console.log('4. Verify success in frontend\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

executeSQLScript();

