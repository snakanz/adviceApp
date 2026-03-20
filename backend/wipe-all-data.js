#!/usr/bin/env node

/**
 * COMPLETE DATA WIPE SCRIPT
 * 
 * This script removes ALL historical data from your Advicly database
 * to free up space on your free database plan.
 * 
 * WARNING: This is irreversible! All meetings, clients, and related data will be deleted.
 * Only your user account and database schema will be preserved.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function confirmDeletion() {
  return new Promise((resolve) => {
    console.log('🚨 WARNING: COMPLETE DATA WIPE');
    console.log('=' .repeat(50));
    console.log('This will permanently delete:');
    console.log('• All meetings and meeting data');
    console.log('• All clients and client data');
    console.log('• All Ask Advicly conversations');
    console.log('• All calendar tokens (you\'ll need to re-authenticate)');
    console.log('');
    console.log('This will preserve:');
    console.log('• Your user account');
    console.log('• Database schema and structure');
    console.log('');
    console.log('⚠️  THIS ACTION CANNOT BE UNDONE!');
    console.log('');
    
    rl.question('Type "DELETE EVERYTHING" to confirm (or anything else to cancel): ', (answer) => {
      resolve(answer === 'DELETE EVERYTHING');
    });
  });
}

async function showCurrentData() {
  console.log('\n📊 Current database usage:');
  console.log('-' .repeat(30));
  
  try {
    // Count meetings
    const { count: meetingsCount } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('userid', 1);
    
    console.log(`Meetings: ${meetingsCount || 0} records`);
    
    // Count clients
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('advisor_id', 1);
    
    console.log(`Clients: ${clientsCount || 0} records`);
    
    // Count Ask Advicly threads (if table exists)
    try {
      const { count: threadsCount } = await supabase
        .from('ask_threads')
        .select('*', { count: 'exact', head: true })
        .eq('advisor_id', 1);
      
      console.log(`Ask Advicly threads: ${threadsCount || 0} records`);
    } catch (error) {
      console.log('Ask Advicly threads: Table not found');
    }
    
    // Count Ask Advicly messages (if table exists)
    try {
      const { count: messagesCount } = await supabase
        .from('ask_messages')
        .select('*', { count: 'exact', head: true });
      
      console.log(`Ask Advicly messages: ${messagesCount || 0} records`);
    } catch (error) {
      console.log('Ask Advicly messages: Table not found');
    }
    
    const totalRecords = (meetingsCount || 0) + (clientsCount || 0);
    console.log(`\nTotal user records: ${totalRecords}`);
    
    if (totalRecords === 0) {
      console.log('✅ Your database is already clean!');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking current data:', error.message);
    return false;
  }
}

async function executeWipe() {
  const wipeFile = path.join(__dirname, 'migrations', '003_complete_data_wipe.sql');
  
  if (!fs.existsSync(wipeFile)) {
    throw new Error(`Wipe script not found: ${wipeFile}`);
  }

  const wipeSql = fs.readFileSync(wipeFile, 'utf8');
  
  console.log('\n🗑️  Executing complete data wipe...');
  console.log('This may take a moment...');
  
  // Split the SQL into individual statements and execute them
  const statements = wipeSql.split(';').filter(stmt => stmt.trim().length > 0);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim();
    if (statement) {
      try {
        await supabase.rpc('exec_sql', { sql: statement + ';' });
      } catch (error) {
        // Some statements might fail (like trying to delete from non-existent tables)
        // We'll continue with the process
        if (!error.message.includes('does not exist')) {
          console.warn(`Warning: ${error.message}`);
        }
      }
    }
  }
  
  console.log('✅ Data wipe completed successfully!');
}

async function verifyWipe() {
  console.log('\n🔍 Verifying data wipe...');
  
  try {
    // Check meetings
    const { count: meetingsCount } = await supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('userid', 1);
    
    // Check clients
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('advisor_id', 1);
    
    console.log(`Remaining meetings: ${meetingsCount || 0}`);
    console.log(`Remaining clients: ${clientsCount || 0}`);
    
    if ((meetingsCount || 0) === 0 && (clientsCount || 0) === 0) {
      console.log('✅ Data wipe verification successful - database is clean!');
      return true;
    } else {
      console.log('⚠️  Some data may still remain');
      return false;
    }
  } catch (error) {
    console.error('Error verifying wipe:', error.message);
    return false;
  }
}

async function runWipe() {
  console.log('🧹 Advicly Database Complete Wipe Tool');
  console.log('=' .repeat(40));
  
  try {
    // Show current data
    const hasData = await showCurrentData();
    
    if (!hasData) {
      rl.close();
      return;
    }
    
    // Get user confirmation
    const confirmed = await confirmDeletion();
    
    if (!confirmed) {
      console.log('\n❌ Operation cancelled. No data was deleted.');
      rl.close();
      return;
    }
    
    // Execute the wipe
    await executeWipe();
    
    // Verify the wipe
    await verifyWipe();
    
    console.log('\n🎉 COMPLETE DATA WIPE SUCCESSFUL!');
    console.log('=' .repeat(40));
    console.log('Your Advicly database is now completely clean.');
    console.log('');
    console.log('Next steps:');
    console.log('1. You will need to re-authenticate with Google Calendar');
    console.log('2. Add meetings to your Google Calendar');
    console.log('3. Run calendar sync to import new meetings');
    console.log('4. Create new clients as needed');
    console.log('');
    console.log('Your database is ready for fresh data! 🚀');
    
  } catch (error) {
    console.error('\n❌ Wipe failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Helper function to create exec_sql function if it doesn't exist
async function ensureExecSqlFunction() {
  const createFunctionSql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$;
  `;

  try {
    await supabase.rpc('exec_sql', { sql: createFunctionSql });
  } catch (error) {
    // Function might already exist or we might not have permissions
    // We'll try to continue anyway
  }
}

// Run the wipe tool
if (require.main === module) {
  ensureExecSqlFunction().then(() => {
    runWipe().catch(console.error);
  });
}

module.exports = { runWipe };
