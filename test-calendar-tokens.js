const { getSupabase } = require('./backend/src/lib/supabase');

async function checkCalendarTokens() {
  console.log('🔍 Checking calendar tokens for all users...');
  
  try {
    // Check users table
    const { data: users, error: usersError } = await getSupabase()
      .from('users')
      .select('id, email, name, googleaccesstoken, googlerefreshtoken')
      .limit(10);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`📊 Found ${users?.length || 0} users:`);
    users?.forEach(user => {
      console.log(`  User ${user.id} (${user.email}):`, {
        hasAccessToken: !!user.googleaccesstoken,
        hasRefreshToken: !!user.googlerefreshtoken,
        accessTokenLength: user.googleaccesstoken?.length || 0
      });
    });
    
    // Check calendartoken table
    const { data: tokens, error: tokensError } = await getSupabase()
      .from('calendartoken')
      .select('*')
      .limit(10);
    
    if (tokensError) {
      console.error('❌ Error fetching calendar tokens:', tokensError);
    } else {
      console.log(`📊 Found ${tokens?.length || 0} calendar tokens:`);
      tokens?.forEach(token => {
        console.log(`  Token for user ${token.userid}:`, {
          hasAccessToken: !!token.accesstoken,
          hasRefreshToken: !!token.refreshtoken,
          provider: token.provider,
          expiresAt: token.expiresat
        });
      });
    }
    
    // Check meetings table
    const { data: meetings, error: meetingsError } = await getSupabase()
      .from('meetings')
      .select('id, googleeventid, userid, title, starttime, is_deleted')
      .limit(10);
    
    if (meetingsError) {
      console.error('❌ Error fetching meetings:', meetingsError);
    } else {
      console.log(`📊 Found ${meetings?.length || 0} meetings:`);
      meetings?.forEach(meeting => {
        console.log(`  Meeting ${meeting.id}:`, {
          googleEventId: meeting.googleeventid,
          userId: meeting.userid,
          title: meeting.title,
          startTime: meeting.starttime,
          isDeleted: meeting.is_deleted
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkCalendarTokens().then(() => {
  console.log('✅ Calendar token check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
