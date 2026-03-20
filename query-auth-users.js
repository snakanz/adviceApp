// Query users from Supabase Auth (requires service role key)
require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

async function queryAuthUsers() {
  console.log('🔍 Checking Supabase Auth users...\n');
  
  const supabaseUrl = process.env.SUPABASE_URL || 'https://xjqjzievgepqpgtggcjx.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    console.log('⚠️  Service role key not found in environment variables.');
    console.log('📝 To check Auth users, you need the SUPABASE_SERVICE_ROLE_KEY');
    console.log('\nAlternatively, you can check in Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/xjqjzievgepqpgtggcjx/auth/users');
    return;
  }
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Query auth.users using admin API
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Error querying auth users:', error.message);
      return;
    }
    
    console.log('📊 SUPABASE AUTH USERS');
    console.log('═'.repeat(80));
    console.log(`Total Users: ${users?.length || 0}\n`);
    
    if (users && users.length > 0) {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   🆔 ID: ${user.id}`);
        console.log(`   📧 Email Confirmed: ${user.email_confirmed_at ? '✅' : '❌'}`);
        console.log(`   📅 Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log(`   🔑 Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);
        if (user.user_metadata?.name) {
          console.log(`   👤 Name: ${user.user_metadata.name}`);
        }
        console.log('');
      });
      
      console.log('═'.repeat(80));
      console.log(`\n✅ Successfully retrieved ${users.length} user(s) from Supabase Auth`);
    } else {
      console.log('No users found in Supabase Auth.');
    }
    
    // Also check custom users table
    console.log('\n\n🔍 Checking custom users table...\n');
    const { data: customUsers, error: customError, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' });
    
    if (customError) {
      console.log('❌ Error querying custom users table:', customError.message);
    } else {
      console.log(`📊 Custom users table: ${count || 0} records`);
      if (customUsers && customUsers.length > 0) {
        console.log('\nSample record:');
        console.log(JSON.stringify(customUsers[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

queryAuthUsers();

