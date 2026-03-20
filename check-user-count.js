// Check user count in Supabase database
require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

async function checkUserCount() {
  console.log('🔍 Checking user count in Supabase...\n');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get total user count
    const { count: totalUsers, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting users:', countError.message);
      return;
    }
    
    // Get detailed user information
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, createdat')
      .order('createdat', { ascending: false });
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
      return;
    }
    
    console.log('📊 USER COUNT SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total Users: ${totalUsers}`);
    console.log('═'.repeat(60));
    console.log('\n📋 USER LIST:\n');
    
    if (users && users.length > 0) {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'No name'}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Created: ${new Date(user.createdat).toLocaleDateString()}`);
        console.log('');
      });
    } else {
      console.log('No users found in the database.');
    }
    
    // Get additional statistics
    const { data: stats } = await supabase
      .from('users')
      .select('createdat');
    
    if (stats && stats.length > 0) {
      const dates = stats.map(s => new Date(s.createdat));
      const oldestUser = new Date(Math.min(...dates));
      const newestUser = new Date(Math.max(...dates));
      
      console.log('📈 STATISTICS:');
      console.log('─'.repeat(60));
      console.log(`Oldest user registered: ${oldestUser.toLocaleDateString()}`);
      console.log(`Newest user registered: ${newestUser.toLocaleDateString()}`);
      console.log('─'.repeat(60));
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkUserCount();

