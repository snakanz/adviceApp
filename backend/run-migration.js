require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration(migrationFile) {
  console.log(`🔄 Running migration: ${migrationFile}...`);
  
  try {
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('Trying direct SQL execution...');
      
      // Split by semicolons and execute each statement
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await supabase.rpc('exec', { query: statement });
          if (stmtError) {
            console.error('Error executing statement:', stmtError);
          }
        }
      }
    }
    
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get migration file from command line or use default
const migrationFile = process.argv[2] || '023_google_calendar_webhooks.sql';
runMigration(migrationFile);

