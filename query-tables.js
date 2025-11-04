// Query all tables in Supabase database
const { createClient } = require('@supabase/supabase-js');

// Using production credentials from wrangler.toml
const supabaseUrl = 'https://xjqjzievgepqpgtggcjx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcWp6aWV2Z2VwcXBndGdnY2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5ODYyNTksImV4cCI6MjA2NzU2MjI1OX0.dWBeOIQ-Je3FfKtT4npLZgmIkaMUtquXrk64Jeg6yxk';

async function queryTables() {
  console.log('🔍 Querying all tables from Supabase...\n');
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Query information_schema to get all tables in the public schema
    const { data: tables, error } = await supabase
      .rpc('get_tables_info');
    
    if (error) {
      console.log('⚠️  RPC function not available. Trying direct query...\n');
      
      // Try querying pg_tables directly (might be blocked by RLS)
      const { data: pgTables, error: pgError } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');
      
      if (pgError) {
        console.log('❌ Cannot query pg_tables:', pgError.message);
        console.log('\n📝 Alternative: Run this SQL in Supabase SQL Editor:\n');
        console.log('SELECT table_name');
        console.log('FROM information_schema.tables');
        console.log("WHERE table_schema = 'public'");
        console.log('ORDER BY table_name;');
        console.log('\n🔗 SQL Editor: https://supabase.com/dashboard/project/xjqjzievgepqpgtggcjx/sql/new');
        return;
      }
      
      console.log('📊 TABLES IN PUBLIC SCHEMA');
      console.log('═'.repeat(80));
      console.log(`Total Tables: ${pgTables?.length || 0}\n`);
      
      if (pgTables && pgTables.length > 0) {
        pgTables.forEach((table, index) => {
          console.log(`${index + 1}. ${table.tablename}`);
        });
      }
      
      return;
    }
    
    console.log('📊 TABLES IN DATABASE');
    console.log('═'.repeat(80));
    console.log(`Total Tables: ${tables?.length || 0}\n`);
    
    if (tables && tables.length > 0) {
      tables.forEach((table, index) => {
        console.log(`${index + 1}. ${table.table_name || table.tablename}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.log('\n📝 Please run this SQL in Supabase SQL Editor:\n');
    console.log('SELECT table_name');
    console.log('FROM information_schema.tables');
    console.log("WHERE table_schema = 'public'");
    console.log('ORDER BY table_name;');
    console.log('\n🔗 SQL Editor: https://supabase.com/dashboard/project/xjqjzievgepqpgtggcjx/sql/new');
  }
}

queryTables();

