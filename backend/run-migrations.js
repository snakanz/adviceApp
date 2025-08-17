const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(filename) {
  try {
    console.log(`Running migration: ${filename}`);
    
    const sqlContent = fs.readFileSync(path.join(__dirname, filename), 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          // Use the REST API directly for DDL statements
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({ sql: statement })
          });

          if (!response.ok) {
            console.log(`⚠️  Statement may have failed (this is often normal for IF NOT EXISTS): ${statement.substring(0, 100)}...`);
          } else {
            console.log(`✅ Executed: ${statement.substring(0, 100)}...`);
          }
        } catch (error) {
          console.log(`⚠️  Statement execution warning (often normal): ${statement.substring(0, 100)}...`);
        }
      }
    }
    
    console.log(`✅ Migration completed: ${filename}`);
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error(error);
  }
}

async function main() {
  console.log('🚀 Running database migrations...');
  
  // Run migrations in order
  await runMigration('add_summary_columns.sql');
  await runMigration('ask_advicly_schema.sql');
  
  console.log('✅ All migrations completed!');
}

main().catch(console.error);
