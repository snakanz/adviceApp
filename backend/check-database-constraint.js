require('dotenv').config();
const { getSupabase } = require('./src/lib/supabase');

async function checkConstraint() {
  console.log('🔍 Checking database constraint for meetings table...');
  
  try {
    const supabase = getSupabase();
    
    console.log('📋 Skipping constraint check (requires direct SQL access)');
    
    // Test inserting a calendly meeting
    console.log('\n🧪 Testing Calendly meeting insertion...');
    
    const testMeeting = {
      userid: 1,
      title: 'Test Calendly Meeting',
      starttime: new Date().toISOString(),
      endtime: new Date(Date.now() + 3600000).toISOString(),
      meeting_source: 'calendly',
      attendees: JSON.stringify([{
        email: 'test@example.com',
        displayName: 'Test Client'
      }])
    };
    
    const { data: insertResult, error: insertError } = await supabase
      .from('meetings')
      .insert(testMeeting)
      .select();
    
    if (insertError) {
      console.error('❌ Failed to insert Calendly meeting:', insertError.message);
      console.log('🔧 This confirms the constraint needs to be updated');
    } else {
      console.log('✅ Successfully inserted Calendly meeting:', insertResult[0].id);
      
      // Clean up test meeting
      await supabase
        .from('meetings')
        .delete()
        .eq('id', insertResult[0].id);
      console.log('🧹 Cleaned up test meeting');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkConstraint();
