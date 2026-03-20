require('dotenv').config();
const { getSupabase } = require('./src/lib/supabase');

async function testMeetingsAPI() {
  console.log('🧪 Testing Meetings API Response...');
  
  const supabase = getSupabase();
  
  try {
    // Test the same query that the frontend uses
    console.log('\n📊 Querying meetings for user 1...');
    
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('userid', 1)
      .order('starttime', { ascending: false });
    
    if (error) {
      console.error('❌ Error querying meetings:', error);
      return;
    }
    
    console.log(`✅ Found ${meetings.length} total meetings`);
    
    // Group by meeting source
    const bySource = meetings.reduce((acc, meeting) => {
      const source = meeting.meeting_source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📋 Meetings by source:');
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} meetings`);
    });
    
    // Show some Calendly meetings
    const calendlyMeetings = meetings.filter(m => m.meeting_source === 'calendly');
    console.log(`\n📅 Calendly meetings (showing first 5 of ${calendlyMeetings.length}):`);
    
    calendlyMeetings.slice(0, 5).forEach((meeting, index) => {
      console.log(`${index + 1}. ${meeting.title}`);
      console.log(`   Start: ${meeting.starttime}`);
      console.log(`   Source: ${meeting.meeting_source}`);
      console.log(`   UUID: ${meeting.calendly_event_uuid}`);
      console.log('');
    });
    
    // Check if meetings have proper date formatting
    console.log('\n🕐 Date format check:');
    const sampleMeeting = calendlyMeetings[0];
    if (sampleMeeting) {
      console.log(`Sample meeting start time: ${sampleMeeting.starttime}`);
      console.log(`Parsed date: ${new Date(sampleMeeting.starttime)}`);
      console.log(`Is valid date: ${!isNaN(new Date(sampleMeeting.starttime))}`);
    }
    
    // Test the meetings categorization (past, today, upcoming)
    console.log('\n📊 Meeting categorization:');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    const past = meetings.filter(m => new Date(m.starttime) < today);
    const todayMeetings = meetings.filter(m => {
      const meetingDate = new Date(m.starttime);
      return meetingDate >= today && meetingDate < tomorrow;
    });
    const upcoming = meetings.filter(m => new Date(m.starttime) >= tomorrow);
    
    console.log(`  Past: ${past.length} meetings`);
    console.log(`  Today: ${todayMeetings.length} meetings`);
    console.log(`  Upcoming: ${upcoming.length} meetings`);
    
    // Check for any meetings with null or invalid dates
    const invalidDates = meetings.filter(m => !m.starttime || isNaN(new Date(m.starttime)));
    if (invalidDates.length > 0) {
      console.log(`\n⚠️  Found ${invalidDates.length} meetings with invalid dates`);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testMeetingsAPI();
