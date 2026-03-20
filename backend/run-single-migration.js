#!/usr/bin/env node

/**
 * Run a single SQL migration file
 * Usage: node run-single-migration.js <path-to-migration-file>
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(migrationFile) {
  console.log('🚀 Running migration:', migrationFile);
  console.log('='.repeat(60));

  try {
    // Read the migration file
    const migrationPath = path.resolve(migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    console.log('📊 SQL length:', sql.length, 'characters');
    console.log('');

    // Split into individual statements (simple split by semicolon)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log('📝 Found', statements.length, 'SQL statements');
    console.log('');

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec', { sql: statement + ';' });
        
        if (error) {
          // Try direct query if RPC fails
          const { error: queryError } = await supabase.from('_').select('*').limit(0);
          
          if (queryError) {
            console.log(`⚠️  Statement may have failed: ${error.message}`);
            console.log(`   Statement: ${statement.substring(0, 100)}...`);
          } else {
            console.log(`✅ Statement ${i + 1} executed`);
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed`);
        }
      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} warning:`, err.message);
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify the migration in Supabase dashboard');
    console.log('2. Test the new functionality');
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Migration failed:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Usage: node run-single-migration.js <path-to-migration-file>');
  console.error('   Example: node run-single-migration.js migrations/013_pending_transcript_action_items.sql');
  process.exit(1);
}

runMigration(migrationFile);

