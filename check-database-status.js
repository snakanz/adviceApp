// Check database status for users and calendar tokens
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseStatus() {
  console.log('🔍 Checking database status...\n');

  try {
    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, provider, created_at')
      .limit(5);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
    } else {
      console.log(`👥 Users in database: ${users.length}`);
      users.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id}, Provider: ${user.provider})`);
      });
    }

    // Check calendar tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('calendartoken')
      .select('userid, provider, expiresat, created_at')
      .limit(5);

    if (tokensError) {
      console.error('❌ Error fetching calendar tokens:', tokensError);
    } else {
      console.log(`\n🔑 Calendar tokens in database: ${tokens.length}`);
      tokens.forEach(token => {
        const isExpired = new Date(token.expiresat) <= new Date();
        console.log(`   - User ${token.userid}: ${token.provider} (${isExpired ? 'EXPIRED' : 'VALID'})`);
      });
    }

    // Check meetings
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, userid, title, starttime')
      .limit(3);

    if (meetingsError) {
      console.error('❌ Error fetching meetings:', meetingsError);
    } else {
      console.log(`\n📅 Meetings in database: ${meetings.length}`);
      meetings.forEach(meeting => {
        console.log(`   - ${meeting.title} (User: ${meeting.userid})`);
      });
    }

  } catch (error) {
    console.error('❌ Database connection error:', error);
  }
}

checkDatabaseStatus();
