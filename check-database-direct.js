// Direct database check using environment variables
require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

async function checkDatabase() {
  console.log('🔍 Checking database directly...');
  
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
    // Check users
    console.log('\n📊 USERS:');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, googleaccesstoken, googlerefreshtoken')
      .limit(5);
    
    if (usersError) {
      console.error('❌ Users error:', usersError);
    } else {
      console.log(`Found ${users?.length || 0} users:`);
      users?.forEach(user => {
        console.log(`  - ${user.email} (ID: ${user.id})`);
        console.log(`    Has Google tokens: ${!!user.googleaccesstoken}`);
      });
    }
    
    // Check calendar tokens
    console.log('\n📊 CALENDAR TOKENS:');
    const { data: tokens, error: tokensError } = await supabase
      .from('calendartoken')
      .select('*')
      .limit(5);
    
    if (tokensError) {
      console.error('❌ Calendar tokens error:', tokensError);
    } else {
      console.log(`Found ${tokens?.length || 0} calendar tokens:`);
      tokens?.forEach(token => {
        console.log(`  - User ${token.userid}: ${token.provider}`);
        console.log(`    Expires: ${token.expiresat}`);
        console.log(`    Has tokens: ${!!token.accesstoken}`);
      });
    }
    
    // Check meetings
    console.log('\n📊 MEETINGS:');
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, googleeventid, userid, title, starttime, is_deleted, sync_status')
      .order('starttime', { ascending: false })
      .limit(10);
    
    if (meetingsError) {
      console.error('❌ Meetings error:', meetingsError);
    } else {
      console.log(`Found ${meetings?.length || 0} meetings:`);
      meetings?.forEach(meeting => {
        console.log(`  - ${meeting.title} (${meeting.starttime})`);
        console.log(`    User: ${meeting.userid}, Event ID: ${meeting.googleeventid}`);
        console.log(`    Deleted: ${meeting.is_deleted}, Status: ${meeting.sync_status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabase().then(() => {
  console.log('\n✅ Database check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
