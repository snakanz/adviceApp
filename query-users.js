// Query all users from Supabase database
const { createClient } = require('@supabase/supabase-js');

// Using production credentials from wrangler.toml
const supabaseUrl = 'https://xjqjzievgepqpgtggcjx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcWp6aWV2Z2VwcXBndGdnY2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5ODYyNTksImV4cCI6MjA2NzU2MjI1OX0.dWBeOIQ-Je3FfKtT4npLZgmIkaMUtquXrk64Jeg6yxk';

async function queryUsers() {
  console.log('🔍 Querying all users from Supabase...\n');
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Get all users with their details
    const { data: users, error, count } = await supabase
      .from('users')
      .select('id, email, name, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error querying users:', error.message);
      console.error('Details:', error);
      return;
    }
    
    console.log('📊 USER LIST');
    console.log('═'.repeat(80));
    console.log(`Total Users: ${count || users?.length || 0}\n`);
    
    if (users && users.length > 0) {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'No name set'}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🆔 ID: ${user.id}`);
        console.log(`   📅 Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log('');
      });
      
      console.log('═'.repeat(80));
      console.log(`\n✅ Successfully retrieved ${users.length} user(s)`);
    } else {
      console.log('No users found in the database.');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error('Stack:', error.stack);
  }
}

queryUsers();

